# Adversarial review of NEW_CONFIG.md

**Reviewed:** 2026-07-30, against HEAD `a76af7751`
**Method:** every claim in the proposal was verified against the codebase before being
criticized. Findings only, ranked by severity. Each finding cites the proposal claim,
the code evidence (`file:line`), and a concrete failure scenario.

Resolution status is tracked in the **Decisions needed** section at the end.

---

## Blockers

### B1. The "no collisions exist today" flattening claim is false — collisions already exist, including inside single capabilities

**Claim** (Motivation §, Resolved decision 5): "collisions are impossible to author
because the factory's option type is a single interface, and we control both halves …
We accept the permanent no-collision discipline … enforced by a test."

**Evidence:** that test would fail on day one:

- **`telemetry`** — the application-entry orchestration property is
  `{ instrumentations }` only (`packages/foundation/lib/schema.js:996-1027`), while
  service, db, and gateway define a top-level capability `telemetry` that is the
  *full* OTel object (`applicationName`, `exporter`, `skip`, …;
  `packages/service/lib/schema.js:1280`, `packages/db/lib/schema.js:491`,
  `packages/gateway/lib/schema.js:341`, shape at `foundation/lib/schema.js:749-813`
  with `additionalProperties: false` — it *rejects* `instrumentations`). The
  proposal's own orchestration list includes "`telemetry.instrumentations`", so
  `service({ telemetry: … })` has two incompatible meanings under one key.
- **`outputDirectory`** — collides *within a single capability*: remix, nuxt, nitro,
  and react-router each have both `application.outputDirectory` (buildable block,
  `packages/basic/lib/schema.js:28`, default `dist`) and
  `<capability>.outputDirectory` (`packages/remix/lib/schema.js:13`,
  `packages/nitro/lib/schema.js:13`, `packages/nuxt/lib/schema.js:13`, default
  `build`). Hoisting both per the stated rule maps two different internal keys onto
  one factory option. Same class: `nitro.entrypoint`
  (`packages/nitro/lib/schema.js:16`, a file path) vs the runtime's `entrypoint` (an
  app id, `foundation/lib/schema.js:1059`) — and internally `prepareApplication`
  writes a *boolean* `application.entrypoint` (`packages/runtime/lib/config.js:283`).
- **Same-name/different-shape at adjacent levels**, guaranteed to recreate the exact
  "paste from the wrong doc page" failure the proposal claims to kill: capability
  `server` is `fastifyServer` (27 props) for service/db/gateway but the 6-prop
  `server` for frontend caps (`foundation/lib/schema.js:387` vs `:503`), while the
  top-level `server` in the same file is the runtime listener; `logger` at root
  (runtime logger, extended with `captureStdio`/`pino` in
  `packages/runtime/lib/schema.js:6-36`) vs `logger` inside the factory (per-app pino
  config); `watch` root (boolean) vs capability `watch` (object with
  `allow`/`ignore`, `basic/lib/schema.js:83-93`); and `gateway({ applications: [...] })`
  (`packages/gateway/lib/schema.js:196`) sitting inside a root
  `applications: [...]` array — with the bare-root-export rule
  (`export default gateway({...})` auto-wrapped as `{ applications: [def] }`), the
  same key name means two unrelated arrays of `{ id, … }` objects in one file.

**Failure scenario:** `service({ telemetry: { instrumentations: ['pg'] } })` — the
factory cannot decide whether this is entry telemetry or capability telemetry;
whichever mapping is chosen silently drops the other interpretation for some user.

### B2. `wattpm dev` config reload silently serves a stale config under ESM `import()`

**Claim:** "Everything downstream of config loading (validation, transform, workers,
ITC, management API) is untouched" and the loading mechanism is
`import(pathToFileURL(configPath))` in the main process.

**Evidence:** `wattpm dev` watches the config file and reloads **in the same process**
by re-calling `create(root, configurationFile, …)`
(`packages/wattpm/lib/commands/execution.js:61-71`). With JSON,
`loadConfigurationFile` re-reads bytes from disk
(`foundation/lib/configuration.js:242-249`). With `import()`, the ESM module cache
returns the *old* evaluation — the user edits `watt.config.ts`, sees "The
configuration file has changed, reloading the application ...", and the runtime
restarts with the unchanged config. Node has no supported ESM cache invalidation;
query-string busting leaks the module graph on every reload *and does not invalidate
transitive imports* (a `./config/shared.ts` helper stays cached forever), and the
`FileWatcher` only watches `configurationFile` itself, so edits to imported files
don't even trigger the reload. The "rs" stdin reload path (`execution.js:73-81`) has
the same bug.

### B3. The migrate codemod's "v3-era configs only" scope is incoherent — nothing ever produces v3-era files on disk

**Claim** (§`wattpm migrate`, Resolved decision 6): configs "whose detected version is
older than 3.0.0" are "refused with instructions to upgrade the project to
Platformatic v3 first (whose loader upgrades v1/v2 shapes via its own semgrator
chains)".

**Evidence:** version detection comes from the `$schema` URL
(`foundation/lib/configuration.js:33-37, 155-180`), which the proposal itself calls
"version-pinned (goes stale on every release)". The v3 loader's semgrator chains
(`packages/runtime/lib/upgrade.js`; version files
`packages/runtime/lib/versions/{v1.5.0,v1.36.0,v2.0.0,v3.0.0}.js`) upgrade old shapes
**in memory only** — `loadConfiguration` never writes back
(`foundation/lib/configuration.js:575-585`), and there is no
`wattpm upgrade`/config-rewrite command anywhere in `packages/wattpm`,
`wattpm-utils`, or `cli` (verified by grep). So a project that has run happily on v3
for a year with `"$schema": "https://platformatic.dev/schemas/v2.8.0/…"` on disk is,
by the codemod's own detection rule, a pre-3.0.0 config. `wattpm migrate` refuses it
and tells the user to do something ("upgrade to v3") they have *already done* and
which changes zero bytes on disk. Dead end for exactly the long-lived projects
migration tooling exists for. Either migrate must accept any shape the v3 *loader*
accepts (i.e. carry the v1/v2 semgrator chains, contradicting "none of the pre-v3
upgrade machinery ships in v4"), or the refusal message needs a rewrite step that
does not exist.

---

## Major

### M1. The ambient-`.env` change breaks per-app `.env` overriding runtime `.env` defaults

**Claim** (§Env files): "`.env` handling is preserved but simplified … applies the
result to `process.env` (file values never overriding real env, as today)" while
`kEnvFileFallbackKeys` is deleted.

**Evidence:** today the layering is three-valued, not two-valued:
runtime-`.env`-only keys are tagged as *fallback* keys
(`foundation/lib/configuration.js:399-401`), passed to workers as
`envFileFallbackKeys` (`packages/runtime/lib/runtime.js:2513-2515`), and the worker
deliberately lets the application's own `.env` override them — but not real env vars
(`packages/runtime/lib/worker/main.js:245-262`:
`if (!(key in process.env) || envFileFallbackKeys.has(key))`). Once the root `.env`
is folded into `process.env` ambiently and the tag machinery is deleted, "came from a
file" is indistinguishable from "real environment": root `.env` `LOG_LEVEL=info` +
`web/api/.env` `LOG_LEVEL=debug` yields `debug` in the api worker today and `info` in
v4. Bonus regression from same-process dev reload (B2): a variable *removed* from
`.env` persists in `process.env` across reloads and now masquerades as real env
forever.

### M2. The claimed replacement for `{*_URL}` resolution does not exist — the codemod's `process.env.PLT_X_URL` translation yields `undefined`

**Claim** (§Env files, item 5): "Its runtime equivalent — workers resolving sibling
URLs via `http://<id>.plt.local` and **the injected `PLT_<ID>_URL` worker env vars**
— is unaffected."

**Evidence:** there are no injected `PLT_<ID>_URL` env vars. Grep for `PLT_.*_URL`
across `packages/runtime/lib` and `packages/basic/lib` returns zero injection sites.
The *only* mechanism is `fetchApplicationUrl` passed as `onMissingEnv` when the
**worker** parses the app's config file
(`packages/runtime/lib/worker/controller.js:31-37` and `:144-147`): any unset
`{FOO_URL}` placeholder in a capability config resolves to `http://<appid>.plt.local`
at config-parse time. That is precisely the interpolation machinery v4 deletes. The
codemod rule "`{PLT_X}` placeholders become `process.env.PLT_X` references" converts
a working `"url": "{PLT_API_URL}"` into `process.env.PLT_API_URL` — evaluated in the
main process where that variable is not set — producing `undefined`/`''` with no
error. Every config relying on the `onMissingEnv` fallback (important enough to get a
dedicated warning path, `foundation/lib/configuration.js:526-560`, and a recent fix
in commit `a76af7751`) migrates to a silently broken config.

### M3. Internal contradiction about where per-app `watt.config.ts` is evaluated — and arbitrary code now runs N+1 times

**Claim:** §Loading mechanism: "Per-app `watt.config.ts` files are evaluated the same
way **by the worker controller**." Resolved decision 2: "Worker-side re-evaluation of
per-app config files is designed-for but **not publicly committed**" in v4.0.
§Precedence: root and per-app definitions are deep-merged in the root (main process).

**Evidence:** these three statements can't all hold. Today the app config file is
parsed in the main process for type detection (`packages/runtime/lib/config.js:249-254`)
*and* re-parsed inside each worker (`worker/controller.js:142-149`) — harmless for
JSON, which is pure. If per-app `watt.config.ts` keeps the worker-side path, an app
with `workers: 4` evaluates arbitrary user code 5 times (main for
merge/type-detection + once per worker thread, each with its own ESM cache) — the
documented **async** config form doing a secrets fetch does 5 fetches, and any
non-deterministic value diverges between main's merged view and each worker's view.
If instead evaluation is main-only, the inline-vs-file symmetry breaks:
`applicationConfig.config` is a file path today and the worker needs a new channel
for inline factory options across `workerData` (`runtime.js:2493-2516`) — a protocol
change the proposal doesn't design, on the same boundary it claims is "untouched".

### M4. The hard-cliff casualty list materially undercounts in-tree consumers

**Claim** (§Config-writing tooling): "Three code paths write config files today:
`wattpm create`, `wattpm import`, and the CLI's temporary-config fallback."

**Evidence — at least four more, each individually breaking:**

- **`wattpm patch-config`**
  (`packages/wattpm-utils/lib/commands/patch-config.js:24-28, 109-127`): applies
  RFC-6902 JSON Patch to the root config *and every application config* and writes
  them back via `getStringifier`. There is no "apply a JSON patch and write back" for
  a TS module. The related runtime plumbing (`configPatch` through `workerData`,
  `runtime.js:2499`; applied in `packages/basic/lib/config.js:57-65`) assumes
  patchable per-app config. The proposal never mentions this command.
- **`next pack`** writes a **capability-dialect** `watt.json` (with a `next` block)
  into the deployment bundle (`packages/next/lib/pack.js:69-74`). The v4 runtime
  refuses capability-dialect files outright — so v4's own pack output would be
  unbootable until pack is rewritten; it's not in the implementation plan.
- **`wattpm install`/external flow** writes `watt.json` + mutates `package.json` in
  every application directory
  (`packages/wattpm-utils/lib/commands/external.js:158, 177, 326, 336`) — a fourth
  writer beyond `import`'s root-config append.
- **Generated user code** embeds JSON-config assumptions: the service generator's
  scaffolded app does `JSON.parse(await readFile(join(…, 'watt.json')))`
  (`packages/service/lib/generator.js:124, 155`).

Plus scale context the plan should own: ~868 JSON config fixtures under test trees
and ~60 foundation loader tests; and the external `watt-admin` (invoked via npx from
`packages/wattpm/lib/commands/admin.js:22`) consumes `GET /config`
(`packages/runtime/lib/management-api.js:102-112`), whose payload loses
`$schema`/`module` — a cross-repo coordination the proposal doesn't mention.

### M5. "Single-app → multi-app is a file move" collides with pnpm strict dependency resolution

**Claim** (Goals 4, §One dialect): promoting an app into a monorepo "is a file move,
not a rewrite", and "the `next({ … })` expression moves verbatim".

**Evidence:** a root `watt.config.ts` doing `import { next } from '@platformatic/next'`
must resolve the capability from the **root** package. Today capability deps live in
each app's `package.json`, and resolution is deliberately scoped to the app directory
with an explicit error telling users to add the dep *there*
(`packages/basic/lib/modules.js:22-50`, error at `:44-45`; `wattpm import` adds the
dep to the app's `package.json`, `external.js:177`). Under pnpm's default strict
layout, a dependency declared only in `web/frontend/package.json` is not importable
from the workspace root. So the inline-at-root style — and the reverse move —
requires relocating/duplicating dependencies across `package.json`s. The codemod
(which converts capability-dialect configs into root inline factories) must edit
`package.json` dependency graphs; neither this nor the failure mode ("Cannot find
package '@platformatic/next' imported from watt.config.ts" at root) appears anywhere
in the proposal.

### M6. The hard-cliff detector cannot catch schema-less v3 files — `{PLT_X}` placeholders load as literal strings instead of erroring

**Claim** (§File resolution): old configs are "detected by `$schema`/`module` or the
presence of removed properties like `runtime`, `web`, `services`" and refused "with a
clear error".

**Evidence:** the proposal itself says `$schema` is "the thing users most frequently
delete or mangle". A v3 runtime-dialect `watt.json` with `$schema` deleted, using
`applications` (not `web`/`services`) and no `runtime` block, contains **no** removed
property — it passes shape detection as v4. Its `"port": "{PORT}"`,
`"level": "{PLT_SERVER_LOGGER_LEVEL}"` values then sail through v4 validation,
because the schemas deliberately admit strings everywhere a placeholder used to be
legal (`overridableValue`, `foundation/lib/schema.js:1-11`; `server.port`
`anyOf [integer, string]` `:393-395`; `logger.level` even has a dedicated
`pattern: '^\\{.+\\}$'` branch `:266`). Result: not the promised clean
"run `npx wattpm migrate`" error but a runtime trying to listen on port `"{PORT}"`.
The existing code even documents this failure class — `parseWorkers` carries a "check
your environment variable" hint for exactly `/\{.*\}/`-shaped values
(`packages/runtime/lib/config.js:56`). A robust refusal heuristic must scan string
values for the placeholder pattern; the proposal doesn't specify one.

### M7. "Types generated from the schemas" inherit the placeholder-string unions the proposal is deleting

**Claim** (§Validation and types): "TypeScript types … are generated from the schemas
by the existing `gen-types` pipeline, so types and validation cannot drift", giving
"strictly more" than `$schema` autocomplete.

**Evidence:** the v3 schemas are saturated with `anyOf: [T, { type: 'string' }]`
escapes that exist *only* to admit `{PLT_X}` placeholders: `workers`
(`foundation/lib/schema.js:42-65`), `watch` (`:1281-1290`), `restartOnError`,
`startTimeout`-family, `health.*` via `overridableValue` (`:657-676`),
`managementApi`, `metrics.enabled`, `strictEnv`, `logger.level`'s `^\{.+\}$` pattern
(`:266`), etc. "v3 schemas minus" the six listed properties keeps all of these, so
the generated `WattConfig` says `watch?: boolean | string`,
`workers?: number | string | {…}` — typed autocomplete that happily accepts the
stringly-typed garbage the whole proposal exists to eliminate, while AJV
`coerceTypes` keeps silently coercing at runtime. Fixing this means auditing every
`anyOf` in every schema (foundation + 14 capabilities) — a large workstream absent
from the implementation plan, and one that breaks the "types cannot drift" invariant
the moment hand-tightened types diverge from the still-lax schemas.

---

## Minor

### m1. Type stripping is not sufficient for all supported project shapes

- A package with an explicit `"type": "commonjs"` (common in older Node apps, exactly
  the `wattpm import` audience) disables module-syntax detection: an ESM-syntax
  `watt.config.ts` there fails to load. The `.mts` fallback exists in the search
  order, but the codemod must *choose* `.mts` per-package; unaddressed.
- Non-erasable syntax (enums, namespaces, parameter properties) fails without
  `--experimental-transform-types`; `tsconfig` `paths` are ignored; `.ts` inside
  `node_modules` is refused (`ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING`), so a
  published shared-config preset package cannot ship `.ts`. None of these limits are
  documented as constraints on what users may write in `watt.config.ts`.

### m2. Pipeline order and the "enters at validate" story are misstated

The proposal says "AJV … → `transform()` → `kMetadata` attachment". Actual order in
`loadConfiguration` is validate → **kMetadata** → transform
(`foundation/lib/configuration.js:587-611`), and `transform` *depends* on
`config[kMetadata].root` for autoload and path resolution
(`packages/runtime/lib/config.js:233, 381`). The serializability checker must run
*before* metadata attachment (the `kMetadata.env` object is symbol-keyed and non-JSON
by design); the spec as written would build the wrong thing.

### m3. "Deep-merged … mirroring today's `autoload.mappings` behavior" — today's merge is shallow

`packages/runtime/lib/config.js:406`:
`{ ...application, ...applications[existingApplicationId] }` — a shallow spread, root
winning per-key wholesale. Deep merge is a behavior change, and deep-merging
capability option objects (arrays like gateway's `applications`, `commands`) has no
defined semantics.

### m4. `ApplicationDefinition` symbol tag across duplicated `@platformatic/basic` instances

`[kApplication]: true` with a plain `Symbol()` breaks when the project's
`@platformatic/next` and the CLI's runtime resolve different copies/versions of
`basic` (routine with mixed minor versions in non-hoisted layouts). Needs
`Symbol.for` or duck-typing on `module` — the sketch specifies neither.

### m5. The exclusion lists the codemod must faithfully invert are themselves buggy

`runtimeUnwrappablePropertiesList` contains `'applications'` twice and does **not**
exclude `'services'` (`foundation/lib/schema.js:1616-1625`), so `runtime.services` is
schema-legal in a wrapped config today (`additionalProperties: false` at `:1654`
blocks only what's excluded). The migrate codemod's "unwrap `runtime` blocks" step
must decide what a legal-but-weird `runtime.services` meant.

### m6. `?autogenerated=true` has a live consumer whose replacement is unspecified

`wattpm import` parses the marker out of the `$schema` URL to decide the "single app
at root" shape (`packages/wattpm-utils/lib/commands/external.js:112-128`). "Gone —
zero-config no longer writes files" removes the producer; the in-memory synthesis
path must replicate the consumer's behavior and the proposal doesn't say how import
behaves in a zero-config tree in v4.

### m7. JSON-in-v4 users lose versioning entirely, not just `$schema`

With the "in-hot-path semgrator wiring" deleted and code configs "never
auto-upgraded", a **v4-shape `watt.json`** (the blessed machine-generated format) has
no version marker and no upgrade path for any 4.x→5 config-shape change — the
codemod problem recurs at the next major with strictly less information than
`$schema` provided today.

---

## Claims verified as accurate (non-obvious confirmations)

- `wrapInRuntimeConfig` is at `packages/runtime/lib/config.js:131` as cited; the YAML
  brace-quoting pre-pass (`foundation/lib/configuration.js:39-55`), the three
  `$schema` URL formats (`:33-37`), and the `#loadExtensions` import precedent
  (`packages/runtime/lib/runtime.js:4343`) all check out.
- The Node ≥ 22.19 floor claim matches `engines` in
  `packages/{wattpm,runtime}/package.json`.
- `.github/` workflows have zero config-file dependencies; YAML/JSON5/TOML fixtures
  number only 11 — the *non-JSON format* cliff is genuinely cheap. The expensive
  cliff is everything in M4.

---

## Decisions needed

Each item revises or extends a decision in NEW_CONFIG.md's "Resolved decisions".
Status updated as they are ruled on.

| # | Finding(s) | Decision | Status |
|---|---|---|---|
| D1 | B1 | Factory option shape, revisited: flattening is unsound as specced. Namespaced `config:` key, curated per-capability rename maps, or another scheme | **resolved**: orchestration props live only on the application entry; the entry's `config` property (today a file path) also accepts a factory result inline. Factory carries only the per-app capability config, with the capability block flattened and the `application` block kept nested (keeps `outputDirectory` unambiguous). Per-app file exports the identical factory expression. Root `config` wins wholesale over a per-app file, like v3's `config` path |
| D2 | B2 | Dev-mode config reload mechanism for ESM configs: subprocess evaluation, module-graph watching + cache busting, or full-process restart on config change | **resolved**: every config load runs in a throwaway worker thread — fresh ESM cache per load, serialized result posted back, `module.register` hook collects the transitive import list so the watcher covers helper files. Also quarantines `.env` mutation and config crashes/hangs from the main process (partially addresses M1's reload pollution) |
| D3 | B3, M6 | Migrate scope + cliff detection: what `wattpm migrate` accepts (loader-equivalent vs `$schema`-version-gated), and how the v4 runtime detects schema-less v3 files (placeholder scan) | **resolved**: `wattpm-utils@4` depends on `@platformatic/foundation@3` and runs the real v3 `loadConfiguration` (all formats, v1/v2 semgrator chains, in-memory upgrade), then emits v4 `watt.config.ts` — migrate accepts anything that boots on v3; no fork, no runtime machinery. Cliff detection: superseded by D7(b) — with JSON dropped entirely, any `.json` config is legacy by extension alone; no shape or placeholder scanning needed |
| D4 | M1, M2 | Env design: replacement for the three-valued `.env` layering, and a real mechanism for inter-app URL references (`{*_URL}`) in v4 | **resolved** (two axes): **(a)** env layering simplifies to two-valued — `real env > root .env > app .env`; root `.env` becomes indistinguishable from real env once loaded, app `.env` no longer overrides root-file defaults; `kEnvFileFallbackKeys` plumbing deleted; `wattpm migrate` warns per key present in both files, runtime logs a one-time boot warning on shadowed keys. **(b)** inter-app URLs are literal `http://<id>.plt.local` strings in config (no helper); the runtime injects real `PLT_<ID>_URL` env vars into every worker so existing app code reading them keeps working; codemod emits literals for id-matching placeholders, `process.env.X` otherwise |
| D5 | M3 | Where per-app `watt.config.ts` evaluates in v4.0, and the `workerData` channel for inline factory options | **resolved**: single main-side evaluation — the D2 eval worker evaluates the root config and every per-app `watt.config.ts` in one pass, producing one validated plain object; app workers receive `resolvedConfig` (data) via `workerData` and never import config files. Worker controller's file-scanning/`$schema` resolution is deleted; the "worker boot untouched" claim is dropped from the proposal. Per-app config evaluation sees the root env, never the worker env (documented) |
| D6 | M4 | Fate of `wattpm patch-config`, `next pack` output format, external/install flow, and `watt-admin` coordination under the hard cliff | **resolved**: the `wattpm patch-config` CLI is **removed** in v4 (zero consumers found in-tree, in `watt-extra`, or in `icc-3`); the programmatic `runtime.setApplicationConfigPatch` API **survives with identical semantics** — it is load-bearing for ICC via `watt-extra` (`lib/watt.js` feature-detects and calls it) — applied under D5 to the resolved per-app object at worker-spawn time. Mechanical plan additions (no decision needed): `next pack` emits v4-shape output + boot test; external/install flow emits v4 per-app form. **Amendment (user ruling): the management-API `GET /config` endpoint is removed in v4** — watt-admin (its only known consumer) must migrate to another mechanism, coordinated cross-repo; watt-extra is unaffected (uses programmatic `getRuntimeConfig`). **Generated-user-code sub-item closed on 2026-07-31 coverage audit**: v4 generator templates stop `JSON.parse`-ing `watt.json` in scaffolded test helpers, and `migrate` scans app sources for references to files it would delete, downgrading those deletions to warnings |
| D7 | M7, m7 | Schema tightening (remove placeholder `anyOf` unions from v4 schemas) and whether v4-shape `watt.json` carries a version marker | **resolved** (two axes): **(a)** full schema audit lands in v4.0 — all ~120 `anyOf`/`oneOf` sites classified, placeholder-only string branches deleted (14 `overridableValue` sites are mechanical), genuine unions kept, `migrate` gains the per-property target-type table as a byproduct; v4.0 is the only free moment since no v4 configs exist yet. **(b)** **JSON configs are dropped entirely** — the only format is `watt.config.{ts,js,mts,mjs}`; machine writers (pack, install, migrate, ICC) emit dependency-free plain-object `export default {…}` files with a mandatory stamped `$schema` property read only for version detection. Any `.json` config found = legacy by definition → migrate hint, dissolving M6's shape/placeholder detection into an extension check; `getParser` and the JSON loader path are deleted |
| D8 | M5 | Root-vs-app dependency placement for capability imports (pnpm strict resolution); codemod edits to `package.json` | **resolved**: standard ESM resolution, per-app default — v3 dependency placement is unchanged for every existing workflow (root: `wattpm` only; apps: their capability; runtime resolution untouched). `migrate` and scaffolding emit per-app `watt.config.ts` files + a thin autoload root, so no `package.json` edits ever happen in migration. Root-inline factories are a new opt-in style requiring the capability in the root manifest, enforced by a targeted error naming both fixes (add root dep, or move to a per-app file). No loader-hook magic; editor and runtime resolution always agree |
| D9 | m1–m6 | Batch of mechanical fixes to fold into the proposal (pipeline order, shallow merge semantics, `Symbol.for`, `.mts` selection, `runtime.services` handling, zero-config `import` behavior) | **resolved** (all six accepted): m1 — erasable-syntax-only documented; scaffolding/migrate emit `.mts` when the target package is `"type": "commonjs"`. m2 — spec order corrected to serializability check → validate → `kMetadata` → `transform`. m3 — merge stays shallow/per-key/root-wins (v3 semantics); D1's `config` boundary makes cross-half merging impossible anyway. m4 — `ApplicationDefinition` discriminated by duck-typing on `module` (forced by D7(b): plain-object configs are first-class); no symbol tags. m5 — `migrate` treats `runtime.services` like `runtime.applications` + warn; v3-branch fix for the buggy exclusion list. m6 — `?autogenerated=true` producer and consumer both die; `wattpm import` in a configless tree scaffolds a thin autoload root `watt.config.ts` |
