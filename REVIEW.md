# Adversarial review of NEW_CONFIG.md — round 2 (revision 3)

**Reviewed:** 2026-07-31, against HEAD `9eade402c` on `feat/new-config-proposal`
**Method:** round 2 explicitly did not re-report round-1 findings; it attacked the
round-1 *resolutions* and the new surface introduced by revisions 2–3. All evidence
verified against the code.

Resolution status is tracked in the **Decisions needed** table at the end. Minors and
nits are fixed directly in the proposal without a decision round.

---

## Blockers

### B1. One filename + auto-wrap destroys upward config resolution; the "keeps its semantics" claim is unsatisfiable

**Claim:** "The recursive upward search (`findConfigurationFileRecursive`) keeps its
semantics over the new filenames", while "detection is an extension check — no shape
heuristics", and the loader auto-wraps "a bare `ApplicationDefinition` as
`{ applications: [{ config: def }] }`".

**Code:** v3's upward search is *not* filename-based: `findRuntimeConfigurationFile`
(`packages/foundation/lib/cli.js:215-229`) first searches with a schema filter
`'@platformatic/runtime'`, and `findConfigurationFileRecursive`
(`packages/foundation/lib/configuration.js:196-240`) **loads every candidate and
inspects `$schema`** to skip capability configs and keep ascending. That is exactly
what lets `cd web/api && wattpm dev`
(`packages/wattpm/lib/commands/execution.js:35`) skip `web/api/watt.json` (schema
`@platformatic/node`) and find the runtime root.

**Failure:** in v4 the per-app file and the root file share the same four names and
one dialect. Distinguishing "per-app `ApplicationDefinition` export" from "root
`WattConfig`" requires *evaluating the file* (an eval-worker spawn per directory
level of the walk), which the proposal forbids itself from doing and never budgets.
Worse, the auto-wrap feature converts the wrong outcome into a silent success:
`wattpm dev` run inside `web/api/` finds `web/api/watt.config.ts`, auto-wraps the
bare `node({...})` export, and boots the app **standalone — no gateway, no siblings,
no mesh, wrong env** — where v3 booted the whole runtime. A silent regression in one
of the most common workflows, caused by two rev-3 decisions (unified filename +
auto-wrap) interacting.

### B2. The per-app capability pipeline (validation + transform) has no specified home, and `setApplicationConfigPatch` semantics are provably *not* identical

**Claim:** workers "receive their fully-resolved config as data"; patches are
"applied with `fast-json-patch` to the resolved per-app object at worker-spawn time"
with "identical semantics" (Goal 7).

**Code:** today the *entire* capability config pipeline runs worker-side, per
capability: every capability's `create` calls
`loadConfiguration(source, schema, { transform, ... })`
(`packages/node/index.js:25-28`, `packages/next/index.js:94-95`,
`packages/vite/index.js:59-60`). The config patch is applied at the **start of
basic's `transform`**, i.e. to the raw, pre-normalization config
(`packages/basic/lib/config.js:56-64`), and capability transforms consume worker
context (`options.telemetryConfig` at `node/index.js:8`;
`workerData?.config?.watch` at `basic/lib/config.js:68`).

**Failure:** (a) the proposal deletes worker-side parsing but never says where
capability-schema AJV validation (with `resolvePath`/`resolveModule` keywords that
need the *app* root — `configuration.js:259-302`) and capability `transform` now
run. If main-side: capability modules are imported and their transforms executed
serially in the main process for N apps — a boot-latency and isolation cost the
eval-worker section explicitly avoids for the *root* config while silently
reintroducing it for every app; and plain `{ module: 'x' }` configs get validated
nowhere on the factory path. (b) ICC patch documents are written against the raw
pre-transform shape (e.g. a patch touching `/watch` meets `true`, not the normalized
`{ enabled: true }`; paths are pre-`resolvePath`, pre-defaults). Applying the same
ops to the *resolved* object is a different document — patches that work on v3 will
mismatch or corrupt on v4. Goal 7 ("identical semantics") is stated as a hard
requirement and is not met as designed.

---

## Major

### M1. "GET /config's only known consumer is watt-admin" is factually false — three in-tree consumers, two of which also *write* the config file

`client.getRuntimeConfig` issues `GET /api/v1/config`
(`packages/control/lib/index.js:242-247`). In-tree consumers: `wattpm config`
(`packages/wattpm/lib/commands/management.js:186`), `wattpm applications:add` and
`applications:remove` (`packages/wattpm/lib/commands/applications.js:31,110`). The
latter two then call `updateConfigFile(config.__metadata.path, …)`
(`applications.js:7,66,113`) and rewrite the running project's config with the JSON
stringifier — a config *writer* absent from the magicast plan. These commands break
twice (endpoint removed; `.ts` file unwritable by `saveConfigurationFile`) and
appear nowhere in the breaking-changes list or the plan.

### M2. Capability CLI commands (`createCommands`) are built entirely on `application.config`-as-path + the deleted v3 loader

`wattpm <app>:command` dispatch passes the app's config **file path** as the
command's second argument (`packages/wattpm/index.js:185-210`);
`loadApplicationsCommands` loads each `application.config` file with foundation's
loader (`packages/runtime/index.js:124-127`); db's commands then do
`loadConfiguration(configFile, schema, { transform })` and even
`utimesSync(configFile)` to trigger a watch-restart
(`packages/db/lib/commands/migrations-apply.js:1-44`).

**Failure:** `wattpm db:migrations:apply`, `db:seed`, `db:types`, `db:schema` all
break: no path to pass, no file loader to call, no file to touch. Bonus regression:
`loadApplicationsCommands` runs on every unknown-command dispatch and on
`wattpm help` (`packages/wattpm/lib/commands/help.js:43`) — in v4 that means
spawning an eval worker and **executing arbitrary user config code (including async
secret-fetching factories) to print help**, where v3 parsed inert JSON.

### M3. The eval-worker protocol `{ config, importedFiles }` loses the resolved environment, and config-time `process.env` writes are silently discarded

The runtime's worker-env seeding comes from the loaded env map:
`this.#env = config[kMetadata].env` (`packages/runtime/lib/runtime.js:244`), cloned
into every worker's `env` (`runtime.js:2458, 2519`); that map is built by `loadEnv`
inside `loadConfiguration` (`configuration.js:511, 596-601`).

**Failure:** in v4 `loadEnv` runs inside the eval worker and its result is applied
to the *worker's* `process.env` — then the worker exits. The stated payload has no
`env` member, so either (a) app workers never see root-`.env` values
(`process.env.DATABASE_URL` from the root `.env` becomes `undefined` in every app —
a hard regression), or (b) the main process re-runs `loadEnv` — in which case any
`process.env.X = '…'` assignment made *by config code* (the natural idiom the
code-first pitch invites) evaporates with the throwaway thread, silently. The
design needs the env map (and a decision about config-performed mutations) in the
protocol; rev 3 specifies neither.

### M4. The two-valued-precedence boot warning has no data source — it needs exactly the machinery being deleted

The worker applies its app `.env` only when
`!(key in process.env) || envFileFallbackKeys.has(key)`
(`packages/runtime/lib/worker/main.js:250-259`), with the fallback-key list shipped
in `workerData` (`runtime.js:2513-2515`).

**Failure:** to warn "this app `.env` key is shadowed *by the root `.env`*" — and
not spam a warning for every key shadowed by the real environment, which was always
the case in v3 too — the worker must know which `process.env` keys originated from
the root file rather than the real env. That per-key provenance *is*
`kEnvFileFallbackKeys`, reincarnated as warning metadata. The proposal deletes the
mechanism and keeps a feature that depends on it.

### M5. `PLT_<ID>_URL` injection: ordering vs app `.env` unspecified, stale v3 `.env` entries shadow it, and id normalization collides

Worker env is seeded at spawn (`runtime.js:2458, 2519`); the worker then applies
its app `.env` only for keys **not already present** (`worker/main.js:252-259`);
`env` blocks apply last (`main.js:264-269`). Application `id` has no schema pattern
(`foundation/lib/schema.js:865-867`).

**Failures:** (a) if injection goes into the spawn env, an app's own `.env` setting
`PLT_API_URL` can never override it — "explicitly configured wins" holds only for
`env` blocks; defining the `.env` case requires per-key provenance again (M4).
(b) v3 generators emit `PLT_*_URL` entries into root `.env` files; migrate keeps
`.env` files — so stale `PLT_API_URL=http://localhost:3001` leftovers silently win
over the injected mesh URL. (c) `api-v2` and `api_v2` are both legal ids and both
normalize to `PLT_API_V2_URL`; the winner is unspecified and there is no declared
boot-time collision error.

### M6. Migrate has no rule for `{PLT_ROOT}` — a placeholder the generators put in most real projects

`PLT_ROOT` is injected by the loader itself, not by users: `env.PLT_ROOT = root`
(`configuration.js:512`); the scaffolding generators emit `{PLT_ROOT}/...` paths
into real configs (`packages/generators/lib/utils.js:94,106`), and docs recommend
it.

**Failure:** migrate's stated table would emit `process.env.PLT_ROOT ?? …`, and
nothing sets `PLT_ROOT` in v4 → db `migrations.dir`, plugin paths etc. resolve to
`undefined` at boot for the very configs the generators produced. Needs a third
rule (relative path / `ctx.root`), currently absent.

### M7. The vendored legacy reader's real closure includes 13 capabilities' v3 schemas and transforms — none of which are in the move list

The upgrade chains live in four packages, not foundation:
`packages/runtime/lib/versions/`, `packages/service/lib/versions/`,
`packages/db/lib/versions/`, `packages/gateway/lib/versions/`. "Loading as
production v3 would" additionally means per-capability **schema validation**
(defaults injection, `resolvePath`/`resolveModule` mutations) and per-capability
**transforms** (db resolves migrations/types paths, next/vite compute directories).
The v4 versions of those packages ship *audited, changed* schemas, so the frozen
reader cannot borrow them.

**Failure:** guaranteeing "anything that boots on v3 migrates" requires vendoring
v3 snapshots of ~13 capability schemas + their transforms + the four upgrade
chains — several times the size of `configuration.js`, spanning packages the move
list never names. Either the scope statement is wrong or migrate quietly downgrades
to "parse + upgrade + best-effort mapping", which cannot honor the "exactly as
production v3" promise. Related in-tree leak: `replaceEnv` is also used at
*request time* by the gateway (`packages/gateway/lib/capability.js:108`) — code
that must be rewritten, not relocated.

### M8. Explicit (non-autoload) application entries silently lose per-app config discovery

Today, discovery for entries without `config` happens **worker-side**:
`listRecognizedConfigurationFiles().find(...)`
(`packages/runtime/lib/worker/controller.js:134-138`) — it covers
explicitly-listed `applications` entries, not just autoload.

**Failure:** a v4 config with `applications: [{ id: 'api', path: 'web/api' }]` and
an existing `web/api/watt.config.ts` ignores the per-app file (only autoload is
stated to trigger per-app loading) — the app boots on bare defaults with no error.
Migrate's own output (autoload style) is safe, but hand-written v4 configs hit
this.

---

## Minor — fixed directly in the proposal

- **m1.** `module.register` (async hooks) misses CJS `require()` graphs — a
  `watt.config.js` in a `"type": "commonjs"` package is CJS. → Proposal now
  specifies the sync `module.registerHooks` API.
- **m2.** Config files were the only undebuggable user code (throwaway worker dies
  before inspector attach), and the eval cost was unacknowledged. → Proposal now
  documents the cost budget and adds a debug escape hatch (`wattpm config` prints
  the resolved config; `--debug-config` evaluates in-process for stepping).
- **m3.** In-memory config objects (programmatic `create(root, object)`,
  zero-config synthesis) bypass the eval worker. → Proposal now specifies the
  main-side object path (same pipeline, no import, `loadEnv` without mutating main
  `process.env`).
- **m4.** `wattpm build` evaluated `defineConfig(({ production }) => …)` with
  `production: false` while building production artifacts. → `production` is now
  `true` for `build` as well; documented.
- **m5.** The proposal misstated v3 `*_URL` semantics (v3 resolves any missing
  `*_URL` to the *current app's* URL, ignoring the key name; the root config gets
  `''`). → Section corrected; migrate now warns that unset-URL behavior changes.
- **m6.** `coerceTypes` survived after its justification (placeholder strings)
  died, re-exposing documented AJV coercion hazards. → v4 validates with
  `coerceTypes: false`; schema audit guarantees serializable defaults.
- **m7.** The `{ module }` escape hatch implied that capabilities which never
  updated for v4 still work; they don't (v3 capabilities re-load config files
  themselves). → Text now states the v4 create-contract is required; v3-only
  capabilities are unsupported (breaking-changes list updated).
- **m8.** Breaking-changes list gaps. → Added: entry `config`-as-path and
  `autoload.mappings[].config` removed/retyped; `getApplicationDetails` payload
  type change; `/api/v1/applications/:id/config` removal (aligned with
  `GET /config`); command fates cross-referenced to the open M1/M2 decisions.

## Nits — fixed directly in the proposal

- **n1.** External/resolve flow writes `{PLT_APPLICATION_X_PATH}` placeholder
  entries — outside magicast's literal-only safe shape; "resolve unchanged" was
  only true of the runtime half. → v4 external flow writes literal relative paths;
  claim scoped to the runtime half.
- **n2.** The import-graph watcher had no owning step in the implementation plan.
  → Added to the loader and wattpm steps.
- **n3.** Appendix A narrowed `ApplicationEntry.telemetry` to `{ instrumentations }`
  while the runtime merges full per-app telemetry at spawn. → Type widened to match.

---

## Decisions needed

| # | Finding(s) | Decision | Status |
|---|---|---|---|
| D1 | B1 | Root vs per-app file disambiguation: distinct filenames, explicit root marker, drop auto-wrap, or evaluate-during-walk — and what `cd web/api && wattpm dev` does in v4 | open |
| D2 | B2 | Where the per-app capability pipeline (validation, transform) runs, and the shape `setApplicationConfigPatch` documents target (raw vs resolved) | open |
| D3 | M1 | Fate of `wattpm config`, `applications:add`/`applications:remove`, and the management-API config endpoints they consume/write through | open |
| D4 | M2 | Capability CLI commands (`db:*`) contract in v4, and stopping config evaluation on `wattpm help`/unknown-command dispatch | open |
| D5 | M3 | Eval-worker protocol: env map member, and the policy for config-time `process.env` mutations | open |
| D6 | M4 | Shadowed-key boot warning: keep minimal provenance, move the warning to migrate-only, or drop it | open |
| D7 | M5 | URL injection rules: ordering vs app `.env`, stale v3 `.env` shadowing, id-normalization collisions | open |
| D8 | M6 | Migrate rule for `{PLT_ROOT}` (relative paths / config-time `root` context) | open |
| D9 | M7 | Migrate scope honesty: vendor v3 capability schemas+transforms, or re-scope to best-effort mapping; gateway's runtime `replaceEnv` use | open |
| D10 | M8 | Per-app config discovery for explicit (non-autoload) entries | open |
