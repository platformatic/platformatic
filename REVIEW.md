# Adversarial review of NEW_CONFIG.md — round 9

**Reviewed:** 2026-08-05, against HEAD `99445761d` on `feat/new-config-proposal`
**Method:** four independent adversarial passes (loading/ports, environment model,
migration, contract/ecosystem), each targeting the text written by the round-8
resolutions in `1c194ca4b`. Findings deduplicated; every source claim re-verified.
Round-8 findings are resolved and not re-litigated — round 8 itself is recoverable
at `9c8bcd507`.

**Headline: three of the five blockers are defects the round-8 decisions
introduced.** D7 (env blocks visible to per-app evaluation) excluded root-inline
entries — but D19 *mandates* root-inline emission for exactly the configs that
carry `env` blocks. D17 (`envfile` errors alongside an inline `config`) collides
with the same mandate. D9 (non-entrypoint `server.port` listens) plus D28's
migrate strip cancel each other. Each was a locally sound decision whose
interaction with another was not checked.

> **Superseded by the entrypoint removal.** After this review was written, the
> branch was rebased onto `origin/v4`, which carries `e2da15eda` — "feat!: Remove
> entrypoint in favor of applications exposure. (#5014)". That commit deletes
> `entrypoint`, the root `server` block, the entry-level `server` block,
> `useHttp` and `server.portAssignment`, and moves listener ownership into each
> capability's own configuration (`packages/runtime/lib/versions/v4.0.0.js`).
> Every finding below that turns on entrypoint selection, entrypoint/root
> `server` merge order, the non-entrypoint listener, the multi-worker fallback,
> ephemeral-entrypoint mechanics or `portAssignment` is therefore about machinery
> that no longer exists. The affected decision rows are marked **superseded** in
> the table, each with its reason; the findings themselves are kept verbatim as
> history. Nothing else is affected — the loader, env-model, migration and
> contract findings stand.

---

## Blockers

### B1. Root-inline emission silently drops every placeholder v3 resolved from an `env` block — and the sentence asserting otherwise is false

`:1560-1567` states such placeholders "need **no special handling**", because the
two excluded positions "match v3, which never resolved those from `env` blocks
either". Verified false for root-inline *application* entries:

- `env` is **not** in `runtimeUnwrappablePropertiesList`
  (`foundation/lib/schema.js:1616-1625` — the list is `$schema`, `entrypoint`,
  `applications`, `application`, `autoload`, `applications`, `web`,
  `resolvedApplicationsBasePath`), so `runtime.env` is schema-legal in a wrapped
  config and `wrapInRuntimeConfig` hoists it to the wrapped root via
  `omitProperties(runtimeConfig, runtimeUnwrappablePropertiesList)`
  (`runtime/lib/config.js:163`).
- The wrapped entry's `config` is **the same file path** (`config.js:167-169`), so
  `worker/main.js:264-269` applies the blocks and `worker/controller.js:143-148`
  then re-reads that file with tokens intact and `replaceEnv` against the
  populated `process.env`.

So v3 resolves it. And `:1521-1525` makes root-inline emission **mandatory** for
any app whose directory coincides with the root — which is every Level 1/1b
wrapped single-app project and every `path: '.'` entry:

```json
{ "$schema": ".../@platformatic/next/3.65.0.json",
  "cache": { "adapter": "redis", "url": "{PLT_REDIS_URL}" },
  "runtime": { "env": { "PLT_REDIS_URL": "redis://cache:6379" },
               "application": { "workers": 2 } } }
```

v3 → `redis://cache:6379`. Migrate emits Level 1b with
`next({ cache: { url: process.env.PLT_REDIS_URL ?? '' } })` inline in the root
file — an excluded position — yielding `''`. In-tree instance:
`packages/runtime/fixtures/graceful-close-header/`.

**Fix direction:** the root worker's **resolution pass** (`:344-349`) already
re-enters every function-valued `applications[].config` *after* the root export is
unwrapped, so the blocks are knowable there. Define the resolution pass's context
env as including the root/entry `env` blocks, and have migrate emit the callback
form for any root-inline entry whose config references a block key. Delete the
"match v3" sentence.

### B2. A root-directory application declaring `envfile` has no legal v4 output — migrate cannot convert a shape that boots on v3

Three rules intersect with no escape:

- `:1521-1525` — root-inline emission is **mandatory** for same-directory apps;
- `:1146-1148` / breaking change 21 — `envfile` alongside an inline `config` is a
  **boot error** (the D17 judgment call);
- per-app style is refused — two v4 candidates in one directory (`:504-508`).

`envfile` is an ordinary application property (`foundation/lib/schema.js:948`) and
is **not** in `applicationsUnwrappablePropertiesList` (verified: the list is `id`,
`enabled`, `path`, `config`, `url`, `gitBranch`, `dependencies`, `useHttp`,
`management`), so `runtime.application.envfile` is legal and
`wrapInRuntimeConfig` spreads it straight into the entry (`config.js:170`). v3
honours it (`worker/main.js:235-237`). In-tree instance:
`packages/runtime/fixtures/env-config/platformatic.json`.

Migrate has three moves, all illegal, and its only `envfile` rule (`:1583-1585`)
is a path rewrite that is a no-op here. Migrate is a stable-4.0 release gate for
"anything that boots on v3" (`:1407-1408`), so this is a gate failure.

**Fix direction:** relax the D17 error to be legal when the entry's directory *is*
the root config's directory — there the root eval worker **is** the app's eval
worker, so `envfile` can govern both views exactly as intended. Otherwise give
migrate a promote-and-report rule reusing the root-`envfile` machinery.

### B3. The non-entrypoint `server.port` strip cancels the `useHttp → port: 0` rewrite, killing gateway WebSocket proxying

Two rules land in adjacent sentences with no stated ordering:

- `:1575-1578` — `useHttp: true` becomes `server: { port: 0 }`;
- `:1581-1584` — "`server.port` is **stripped from non-entrypoint applications**".

`useHttp` is meaningful *only* on non-entrypoints: `worker/main.js:274-283` reaches
the `useHttp` branch only in the `else` of `applicationConfig.entrypoint`, and
`worker/controller.js:218` gates listening on `useHttp` alone. So every
application rule 1 applies to is one rule 2 strips.

A v3 non-entrypoint with `useHttp: true` — the documented prerequisite for the
gateway's WebSocket proxying (`:711-715`, breaking change 19) — emerges from
migrate with **no listener at all**. The capability `port: 0` exists to preserve
is the one it destroys.

**Fix direction:** scope the strip to ports migrate *carried over from v3*, never
to a `port: 0` it synthesized, and state the ordering explicitly.

### B4. The new non-entrypoint fixed-port listener has no multi-worker mechanism — and is inert on every macOS and Windows machine

`:701-708` makes a non-entrypoint's `server.port` a real listener (D9). `:716-724`
offers two multi-worker mechanisms. Both are structurally entrypoint-only, and one
is platform-gated:

- the warn-and-fall-back-to-one-worker guard requires `application.entrypoint`
  (`runtime/lib/runtime.js:676-686`), and its message literally reads
  `"…is set as the entrypoint, but reusePort is not available…"`;
- `portAssignment` computes from the **root** server block
  (`runtime.js:2413-2415`), which a non-entrypoint never receives
  (`worker/main.js:274-283` yields `serverConfig = null`);
- `features.node.reusePort` is **false on `win32` and `darwin`**
  (`foundation/lib/node.js:77`), and `basic/lib/capability.js:106` ANDs
  `reuseTcpPorts` with it.

So `{ id: 'api', workers: 3, config: node({ server: { port: 8081 } }) }` on a Mac:
worker 0 binds, workers 1–2 die on `EADDRINUSE` — while `:727-729` claims that
only happens "when `reuseTcpPorts` is `false` and `portAssignment` is `shared`",
both of which the user set correctly.

**Fix direction:** either extend both mechanisms to per-application `server` blocks
(a real plumbing change, not "survives unchanged"), or restrict the new
non-entrypoint listener to `workers === 1` and make `workers > 1` with a fixed
non-entrypoint port a load-time error pointing at `port: 0`.

### B5. The env root is cwd-dependent in the production container the doc names as typical — and the standalone warning can never fire there

D2 made the project root the **root config file's directory**, falling back to the
boundary. But the boundary is itself cwd-derived: with no `.git`/workspace marker,
"the **nearest directory containing an ordinary `package.json` is the boundary** —
config files above it are never considered" (`:736-739`).

```
/app/package.json            (no "workspaces", no .git — the doc's own example)
/app/watt.config.ts
/app/.env                    DATABASE_URL=postgres://prod/app
/app/web/api/package.json
/app/web/api/watt.config.ts
```

`cd /app && wattpm start` → project root `/app`, `.env` read. `cd /app/web/api &&
wattpm start` → `web/api` has a `package.json`, so it *is* the boundary; `/app`'s
root config is "never considered"; project root becomes `web/api`; `/app/.env` is
never read. The same per-app file evaluates two ways, contradicting `:1101-1102`
and `:1113-1116`. v3 read it either way (`foundation/lib/configuration.js:358-372`
climbed to the filesystem root).

The same mechanism silences the safety net: the standalone warning fires only when
"a root config exists further up" (`:601-607`), which the walk provably cannot see
here — so a container that starts from an app directory boots standalone with no
warning, in exactly the topology the migration guide's working-directory note
exists to protect.

**Fix direction:** decouple root-config *location* from execution eligibility. The
package.json-eligibility rules exist to stop stray ancestor configs from
executing; an ancestor config inside the same project tree is not stray. Locate
the root config by filename up to the boundary marker (`.git`/workspace) or the
filesystem root, and keep the eligibility rules as an execution guard only.

---

## Majors

### M1. The equivalence check's pre-transform comparand is blind to the four things it was widened to verify

D23 kept "validated but pre-transform" while justifying the root comparison by
`runtime` unwrapping, alias merging, `autoload`, `entrypoint`, and `useHttp`
relocation. Three of those happen **inside** the v3 transform, and v4 does them
**before** its transform: autoload expansion (`runtime/lib/config.js:377-431` vs
the root eval worker, "the **only** place autoload expansion runs"), the `enabled`
splice (`config.js:413-417` vs D4's root worker), entrypoint detection
(`config.js:443-465` vs the eval pass). So on every autoload project the v3 side
has `{ autoload: … }` and no `applications` array while the v4 side has a fully
expanded list.

Symmetrically, four of the seven exclusions are unreachable pre-transform, and the
doc's own citations prove it: pprof `preload` (`config.js:502`),
`inspectorOptions` (`:419-420`), `restartOnError` (`:484-493`), root `watch`
(`:320-325`) — all inside `transform`. `kMetadata` is a symbol no string-keyed
deep-equal reaches.

**Fix direction:** compare **post-transform** and keep the exclusion list (which
was written for a post-transform comparison), or keep pre-transform and run only
the *structural* half of the runtime transform on the v3 side while deleting the
four dead exclusions.

### M2. The resolved view's vendored replica omits the worker-boot env layer, so per-app comparisons are made against the wrong v3 value

`:1464-1471` enumerates the replica as "the runtime's config machinery (wrapping,
autoload expansion, entrypoint detection) and a module → frozen-schema/transform
map". The layer that actually determines what a v3 app config resolves to —
`worker/main.js:234-269` (envfile / app `.env` honouring `envFileFallbackKeys`,
then both `env` blocks) plus `worker/controller.js:94-100,143-148`'s
`onMissingEnv`/`strictEnv` wiring — is absent. Every app referencing a
block-supplied variable then compares `''` against `''` and passes, including
B1's failure.

**Fix direction:** add the worker env layering and per-app load context to the
enumerated closure; state that the resolved view is built per-application under
that application's simulated worker environment.

### M3. The two views apply blocks and files in opposite orders, and one violates the ladder

Step 2 has the eval worker apply "the root and entry `env` blocks, **then** app env
files" (`:808-813`); the worker-boot reader does the reverse (`:879-883`). Both
ladders put blocks above app files. Blocks-then-files only satisfies the ladder if
a block-written key is protected from the file pass — it is not, when the key was
already root-file-sourced:

root `.env` `API_URL=http://root` (so `API_URL ∈ envFileKeys`); root block
`API_URL: 'http://block'`; `web/api/.env` `API_URL=http://app`. Eval: block →
`http://block`, then the app-file rule (apply when absent **or** file-sourced,
`worker/main.js:256`) overwrites with `http://app`. Boot: files, then block →
`http://block`. The two views disagree.

**Fix direction:** apply files-then-blocks in both readers, or state that a
block-written key leaves the file-sourced set — adding "block-sourced" as a fourth
provenance class. Say it once, in "Env files".

### M4. `envFileKeys` cannot be computed where the doc computes it

`:769-772` (D21) has every eval worker "constructed with an **explicit `env`** —
the computed layered view". `:778-783` (untouched) still has the root worker "run
`loadEnv` … [and] apply the result to its own `process.env`", posting back
`envFileKeys`. Both cannot hold: if the main process supplies the layered view,
an in-worker `loadEnv` sees a `process.env` already containing every file key, and
`fallbackKeys = Object.keys(envFromFile).filter(key => !(key in baseEnv))`
(`foundation/lib/configuration.js:399`) returns `[]` — collapsing every rung that
depends on real-vs-file provenance.

**Fix direction:** move `loadEnv` and provenance computation into the main process
(the only place the real environment is still separable), producing
`{ env, envFileKeys }` before any worker is constructed; delete "the root worker
runs `loadEnv`".

### M5. Stale normative sentence: the per-application `env` block is still documented as runtime-only

`:1002-1003` still reads "configures the worker's **runtime environment only**",
directly contradicting `:1132-1135`. The round-8 commit updated the second and
never touched the first. A reader in "Loading mechanism" gets the pre-D7 model.

**Fix direction:** rewrite or delete `:1001-1004`.

### M6. "Evaluation env is determined by directories, never by boot style" is now false — and it is newly written text

`:1101-1102` and `:1113-1116` are contradicted by `:1149-1153` in the same section:
a standalone boot "applies no root orchestration" and so evaluates "with no blocks
applied". A per-app file reading a block-supplied variable evaluates to one value
at the root and `''` standalone. Boot style now determines part of the evaluation
env; only the *file* layer is directory-determined.

**Fix direction:** narrow the claim to "env **files** are determined by
directories", and state the block asymmetry next to it rather than 40 lines later.

### M7. "Stale `PLT_*_URL` lines remain structurally harmless" is false at evaluation time, and cites a mechanism that does not exist there

`:1200-1204` claims enforcement "through the eval-worker protocol's `envFileKeys`
snapshot plus the `injectedKeys` list". But the config-evaluation ladder has no
`injected` rung — the doc says so at `:1073-1075`. Injection is a runtime act.
`gateway({ applications: [{ origin: process.env.PLT_API_URL }] })` with a stale
`PLT_API_URL` in `web/gateway/.env` bakes the stale origin into the resolved
config, while the same key at runtime is `http://api.plt.local`.

**Fix direction:** scope the claim to the worker environment, and strip
`PLT_*_URL` keys from eval workers' env so the two views agree by omission.

### M8. The shallow root-wins merge contradicts "orchestration is always root-lexical" — the premise D7 rests on

`:1077-1080` justifies env-block visibility with "orchestration is always
root-lexical — a per-app file exports an `ApplicationDefinition`, and factories
reject orchestration properties". `:285-289` says the opposite: root entry and
per-app file "orchestration keys merge **shallowly, per-key, root winning**". If a
per-app file can contribute orchestration, `env`/`envfile` are not knowable before
that app's evaluation and the ordering is circular.

The cited v3 semantics are also mislabelled: `runtime/lib/config.js:400-409` is
entry-versus-entry (autoload-discovered merged with explicitly-listed, explicit
winning) — both root-lexical. It was never root-entry-versus-per-app-file.
`:1838` repeats the mislabel.

**Fix direction:** restate `:285-289` as the entry-versus-entry merge it is, and
say plainly that a per-app file contributes capability configuration only.

### M9. `NODE_ENV=production` under `build` is presented as v3 parity; v3 leaves it unset

Breaking change 20 says "exactly as in v3 (`worker/controller.js:126-129`), under
`start` and `build` alike". The v3 default fires only on `appConfig.isProduction`,
and `wattpm build` passes no production flag
(`wattpm/lib/commands/build.js:41-43` → `runtime.js:251` → `false`). Builds run
through real workers, so the check runs and does nothing. v4 makes `production`
true under build, newly injecting `NODE_ENV=production` into every build
subprocess — changing webpack/babel/rollup output.

**Fix direction:** drop the parity claim for `build`; list it as a breaking change
next to BC 17's `enabled` admission.

### M10. Dropping v3's file-presence guard changes which application faces the network

`:665-672` drops the `!application.config` guard (`runtime/lib/config.js:447-450`).
In v3 a config-file-less app with `@platformatic/gateway` in its dependencies is
skipped from gateway detection, so a root without `entrypoint` boots **mesh-only**
(`config.js:463-465` throws only for a *named* miss). In v4 that app becomes the
entrypoint and binds the runtime's port. Not in breaking changes; migrate is not
specified to pin the v3-resolved entrypoint. The same paragraph also drops
`context.allowMissingEntrypoint` (`config.js:463`) without comment.

**Fix direction:** add a breaking-change entry; have migrate emit the v3-resolved
`entrypoint` explicitly (including its absence); say what replaces
`allowMissingEntrypoint`.

### M11. The claim check lost containment, so it no longer fires from a subdirectory of a zero-config app

D1's rewrite reads "cwd is a **proper descendant** of the root config file's
directory *and* that root config **claims it as an application** (an entry's
`path`, or a non-excluded subdirectory of `autoload.path`)" — by the parenthetical,
"it" is cwd, and containment is gone. `cd web/frontend/src && wattpm dev` on a
zero-config autoloaded app: `web/frontend/src` is neither an entry `path` nor a
subdirectory of `autoload.path`, so the full runtime boots — while its sibling
that owns a `watt.config.ts` scopes correctly from its own `src`. That is exactly
the asymmetry the same bullet forbids. Neither side is specified to be
realpath-normalized either, so `web/* → packages/*` symlink layouts fail the check.

**Fix direction:** restore containment ("at or below a directory the root config
claims") and specify `realpath` on both sides. The root-directory exemption then
stops being subsumed and must be kept explicitly.

### M12. `--config` leaves the standalone re-scope undefined — the migration guide's own recommended fix has two possible outcomes

`--config` "no walk runs" (`:754-756`) vs breaking change 17's unconditional "run
inside an application directory they act on that application standalone". The
guide tells operators to "point at the project root" (`:632-635`), whose literal
implementation is `--config`:

```dockerfile
WORKDIR /app/web/api
CMD ["wattpm", "start", "--config", "/app/watt.config.ts"]
```

Full runtime, or `api` standalone with every root setting discarded — both
defensible from the text.

**Fix direction:** state that `--config` suppresses the standalone re-scope (cwd
stops being a scope selector when the config is named), and name `--config` in the
migration guide.

### M13. "Topmost by filename" decides the project root before classification can know it is a root config

Step (1) locates the topmost `watt.config.*` **by filename alone** and names it
"the root config, whose directory is the project root", while classification
happens later (step 3). The topmost file may classify as an `ApplicationDefinition`
— then there is no root config and both the claim check and the env root are
undefined. And with two independent Watt projects under one boundary, the topmost
belongs to the wrong one, re-creating the intermediate-directory problem D11 was
chosen to eliminate.

**Fix direction:** define the root config as the topmost file that *classifies* as
a root config at or above the deciding file, stopping at the deciding file when it
is itself a root config — a nested root config is its own project root.

### M14. `port: 0` on the entrypoint does not mean "one ephemeral port", and the pinning is doubly conditional

`:713-715` asserts both. Workers are set up in parallel from the same config
(`runtime.js:2380-2388`); each computes `{ port: 0 }` (`basic/lib/utils.js:21-29`)
and binds an independent port; `#url` is overwritten by whichever reports last
(`runtime.js:3260-3261`). `SO_REUSEPORT` shares nothing when the requested port is
0. And `#entrypointPort` is used only under `stopBeforeStart`
(`runtime.js:3545-3557`) *and* gated on `config.server` being truthy (`:3555`) —
which under D12's "no port default" is precisely when no `server` block exists.

**Fix direction:** specify the machinery (worker 0 binds, the runtime broadcasts
the bound port with `reusePort`), or state that an ephemeral entrypoint is
single-listener and `workers > 1` warns.

### M15. `portAssignment: 'perWorkerIncrement'` is not inert on `port: 0` — it hands workers ports 1, 2, 3

`:723-724` claims both port properties "are inert on an ephemeral (`port: 0`)
entrypoint". `runtime.js:2413-2415` has no guard on the port value, so
`{ port: 0, portAssignment: 'perWorkerIncrement' }, workers: 3` gives worker 1
port `1` and worker 2 port `2` — `EACCES` for any non-root process.

**Fix direction:** make the combination a load-time validation error, or define it
as ephemeral-per-worker. Remove the "inert" claim.

### M16. The application-level `reuseTcpPorts` never reaches the `SO_REUSEPORT` decision

`:716-718` introduces it as "an **application-** and root-level property". The
entry-level value (`foundation/lib/schema.js:898`, inside `export const
application`) is consumed only at `runtime.js:3547` to select the restart
strategy. The capability reads a *different* property —
`basic/lib/capability.js:106`: `(this.config.reuseTcpPorts ??
this.runtimeConfig.reuseTcpPorts)`, where `this.config` is the **capability**
config, and no capability schema exposes it at top level. So `{ id: 'api',
reuseTcpPorts: false }` still enables `SO_REUSEPORT`, contradicting the stated
`EADDRINUSE` condition.

**Fix direction:** state that the entry-level property must be plumbed into the
worker's capability context in v4 (a new wire, not a survival), and correct the
`EADDRINUSE` condition until it exists.

### M17. Remote applications have no `path` at load time, so the uniform per-app pass cannot run for them

`{ id: 'legacy', url: '…git' }` has no `path` in configuration, and the doc's own
new text says `resolve` "writes **nothing** to the configuration … The runtime
derives the same path **at boot** (`runtime.js:2357-2361`)". But v4 needs the path
*during* loading to find the per-app file, run the detector, and validate. v3
tolerated the gap explicitly (`config.js:243-244`: `if (application.url &&
!application.path) application.type = 'unknown'`). So `wattpm resolve && wattpm
start` on the doc's own remote-app example hits the detector's "no JS sources"
error or silently skips discovery.

**Fix direction:** move the `resolvedApplicationsBasePath` backfill into the root
eval worker's expansion step, beside `enabled`; report a not-yet-resolved
directory as "run `wattpm resolve`", not as a detector error.

### M18. `db.cache` collides with the "shared block" `cache` — and `cache` is not a shared block

`:392-396` lists `cache` among "the shared blocks … kept at their v3 positions",
and `:398-403` adds a build-time collision assertion. Verified: `db`'s block
contains a `cache` property (boolean), and top-level `cache` exists in **exactly
one** capability schema — `next`. So flattening `db` hoists `cache: boolean` onto a
key the doc reserves, and the assertion fails on an in-tree capability at 4.0.
Worse, `db({ cache: true })` and `next({ cache: { adapter: 'redis' } })` would mean
incompatible things at one key — the hazard `:281-283` says the split prevents.

**Fix direction:** drop `cache` from the shared-block list; state the rule as
"flattened keys must not collide with each other **or** with any retained
top-level key of that capability's own schema"; record the `db.cache` decision in
the audit.

### M19. "The main process never has to import the full capability package" is contradicted by two decisions in the same commit

`:826-829` justifies the `/schema` subpath that way. But D6 put the capability
`transform` main-side for `exec`, and `transform` lives on the **main entry**
(`db/index.js:32` re-exports it from a module that also pulls `DatabaseCapability`
and the whole `sql-*` graph; `service/index.js:10`). Capability-command *dispatch*
already imports the full package main-side (`runtime/index.js:127-130` →
`pkg.createCommands`). So `wattpm db:migrations:apply` imports
`@platformatic/db` twice in the process the subpath exists to keep light.

**Fix direction:** scope the claim to the boot path, and state which exports the
`exec` path may take from the main entry (`transform`, `createCommands`) versus the
subpath.

### M20. The useHttp rule's "the app's own `server` block wins" is wrong for the service/db/gateway family

`:1576-1578` cites `basic/lib/capability.js:89` (own-wins) and applies it
universally. `service/lib/capability.js:222` re-applies the context **last**, so
the context wins — the divergence the doc already documents at `:682-686` for the
entrypoint path. A v3 gateway with `useHttp: true` and `server.port: 3005`
effectively runs on port 0; migrate keeps 3005, which in v4 is a real fixed
listener that every worker races for.

**Fix direction:** make the rule capability-family-aware.

### M21. The third-party gate blocks every `@platformatic/composer` project — the projects the rename table exists to migrate

The gate keys off the lexical module list, which `:1412-1417` explicitly says
retains the pre-upgrade name; the closure holds gateway's frozen schema, not
composer's; and the gate runs "**before step 1 writes anything**", i.e. before any
rename. So every composer project stops with "hand-conversion required" while
breaking change 23 promises migrate renames it.

**Fix direction:** normalize the module list through the rename table before the
gate consults it.

### M22. The `*_URL` carve-out is scoped by config position, but v3 scopes it by loader pass — a wrapped config is both

D30 carved `*_URL` in *application* configs out of `requiredEnv`. For a wrapped
single-app config the application config **is** the root file:
`runtime/index.js:65-68` loads it with `replaceEnv` on, **no** `onMissingEnv`, and
`configuration.js:540`'s `config.runtime?.strictEnv` fallback live — so an unset
`{PLT_CACHE_URL}` in the capability half throws on v3. Migrate applies the
carve-out and emits `?? ''`; the project now boots with an empty cache URL.

**Fix direction:** scope the carve-out to *unwrapped* application config files.

### M23. Root `envfile` promote-and-rename leaks secrets into an unignored filename, and the printed undo cannot restore it

`.env.v3-unused` matches neither `.env` nor `.env*.local` — the exact patterns the
doc's own scaffolding writes (`:1063`) — so a gitignored `.env` of production
credentials is renamed into a tracked-by-default path, and the summary then tells
the user to review with `git diff`. The dirty check blocks only on untracked
*legacy candidates*, and the printed undo (`git restore … && rm …`) neither
resurrects an untracked original nor renames `.env.v3-unused` back.

**Fix direction:** rename to `.env.v3-unused.local`, record the promotion in the
manifest, add the rename/restore pair to the printed undo, and extend the dirty
check to an untracked `.env` when a root `envfile` is present.

### M24. Step 2's install joins the transaction but `node_modules` does not

D22 put the install inside the transaction, rolling back `package.json` and the
lockfile. That does not undo what the package manager wrote to `node_modules`.
After a 3b rollback the tree has v3 `.json` configs (step 5 never ran) and an
installed v4 runtime that refuses them — the project boots on neither version, and
nothing instructs the user to re-install.

**Fix direction:** state that rollback re-runs the package manager against the
restored lockfile, reporting the exact command on failure.

### M25. Emitted per-app files land in directories with no `package.json`, where the factory import cannot resolve

Step 2 adds "every emitted factory's app-local `@platformatic/*` dependency …
placement is still never changed", while factory imports use "standard ESM
resolution from the importing file — no loader hooks". In v3 an app directory
needs neither a `package.json` nor the dependency (`configuration.js:615-624`
falls back to the runtime-bundled copy). 199 of the 584 v3-shaped config files in
`packages/` sit in a directory with no sibling `package.json`.

**Fix direction:** state the rule — create a minimal `package.json` (a placement
change needing its own consent and a breaking-changes note), or emit such apps
root-inline with the dependency at the root. Either way qualify "placement is
never changed".

### M26. `management` is typed `boolean`; the object form is what gates the ITC hot-add path the doc now relies on

Appendix A types it `boolean` at both levels. The schema is
`boolean | { enabled, operations }`, and `worker/main.js:343-352` reads exactly
that. Since `:1325-1329` makes the ITC `management:addApplications` handler a
second live hot-add path "reachable from any application with `management: true`",
erasing `operations` removes the only mechanism for granting `management` while
denying `addApplications`.

**Fix direction:** type it fully at both levels; state that the new eval pass is
reachable only when `addApplications` is in the `operations` allowlist.

### M27. `ApplicationEntryOverrides = Omit<ApplicationEntry, 'config' | 'path'>` does not describe `autoload.mappings`

The schema's mapping shape omits **`path`, `url` and `gitBranch`** (three keys) and
carries `required: ['id']`, which `applications.items` does not. As written the
sketch admits a mapping declaring a remote-app entry for a directory the autoload
walk found on disk — a state `prepareApplication` has no handling for
(`config.js:239-241`) — and silently relaxes v3's `id` requirement.

**Fix direction:** `Omit<…, 'config' | 'path' | 'url' | 'gitBranch'> & { id: string }`,
and say whether v4 keeps `id` required.

### M28. The programmatic `create(root, configObject)` path has no defined env root and no defined per-app behavior

`:751-757` enumerates three env roots, none of which applies to an object source —
there is no config file and no walk. v3 is unambiguous
(`configuration.js:497-499,511`: object sources must supply `options.root`, and
`loadEnv` runs from it). And "the same pipeline runs main-side" reads as *no*
per-app eval workers, though a programmatic root can list `applications[].path`
directories containing `watt.config.ts`. This is the ICC/embedder path Goal 7
calls preserved.

**Fix direction:** add the programmatic `root` as the fourth env-root case, and
state that object sources skip only the *root* eval worker.

---

## Minors

- **m1. Citation drift in round-8's newly added text** (verify each):
  `runtime/lib/config.js:412-416 → :428` is `:413-417 → :429`;
  `config.js:298-318` is `:298-313`; `management-handlers.js:136-146` is
  `:135-146`; `worker/controller.js:126-129` is `:128-129`;
  `basic/lib/config.js:76-80` is `:76-81`; `configuration.js:157-158` is
  `:156-157`; `configuration.js:349-356` is `:349-357`;
  `foundation/lib/schema.js:396` is `:397`; `control/lib/index.js:263`'s method is
  `getRuntimeApplicationConfig`, not `getApplicationConfig` (`:259`).
- **m2. The `PLT_ROOT` justification cites the wrong line.** `base-generator.js:243`
  is `excludedEnvs` inside `checkEnvVariablesInConfigFile()`, not the `.env` writer
  (`:373-383`). The conclusion holds; `runtime/lib/generator.js:166` is the citation
  that actually shows it.
- **m3. The `wattpm resolve` citation attributes `import`'s behavior.**
  `external.js:322-336` is inside `importLocal` (`:298`); `resolveApplications` is
  `:404-495` and adds no capability dependency. Also, `importLocal:322-326` writes a
  `watt.json` stub that v4's legacy check would refuse — needs a v4 note.
- **m4. The entrypoint server merge is stated as a fallback chain; both v3 paths are
  deep merges.** `defineConfig({ server: { port: 3042 } })` + `next({ server: {
  https: {…} } })` silently drops TLS under a chain reading. State it as a per-leaf
  deep merge, root winning, and note the four hoisted keys are the *hoist* set.
- **m5. `portAssignment` is placed on `ServerOptions`** but read only from the root
  (`runtime.js:2413,4224`), and the schema description says "entrypoint". Annotate
  root-only or make it a per-app validation error.
- **m6. The omit-defaults gate's `@platformatic/*` prefix test** re-introduces the
  bug the enumerated detector table was added to avoid: `node/lib/generator.js:78-80`
  writes both `@platformatic/node` and `@platformatic/globals`, so the gate fails for
  every v3-generated Node app. Key it on the same enumerated table.
- **m7. `--production` is presented as an existing boot flag.** No `wattpm` command
  has one — `start` hard-codes it (`execution.js:118`), `build` passes only
  `{ build: true }`. Say it is new and list which verbs accept it.
- **m8. The `/schema` subpath requires an `exports` map** on packages that have none,
  which seals every existing deep import — one exists in-tree
  (`service/lib/versions/0.16.0.js`). `nuxt`/`nitro` work around it with `"./*": "./*"`.
- **m9. The flattening paragraph names two capabilities where four have two blocks**
  (`remix`, `nuxt`, `nitro` also carry `vite` + their own; `nitro`'s contributes
  `entrypoint`, the exact key classification rule 2 defends against).
- **m10. `NextConfigOptions` omits `next.https`**, which flattens to a top-level
  `https` beside `server.https` — worth recording in the audit.
- **m11. "`watch.enabled` is `false`" main-side** holds only when the config declares
  no `watch` (`basic/lib/config.js:67-71`); a declared value is kept.
- **m12. `db:print-schema` is a third self-load** (`create(root, configFile, …)`,
  `print-schema.js:18`) not covered by "db drops its self-loading".
- **m13. Appendix A's sourcemap family is asymmetric**: `nodeModulesSourceMaps`
  missing from `WattConfig`, `sourceMaps`/`compileCache` missing from
  `ApplicationEntry` — all four exist in both schemas.
- **m14. Composer aliasing vs "exactly one must match"**: v3 treats the two names as
  one table row (`foundation/lib/module.js:28-31`), so a mid-upgrade app carrying
  both is unambiguous today and would now error. State that aliases collapse to one
  row — and say whether the row exists at all given breaking change 23.
- **m15. `--resume`'s regeneration rule is backwards as stated** — "skips
  regeneration of unmodified emitted files" means it overwrites exactly the files a
  user hand-edited between phases.
- **m16. Three inconsistent statements of migrate's `package.json` edit classes**
  (`:1035-1037`, `:1516-1518`, `:1679-1682`) — the closing paragraph and the
  dependency-resolution paragraph were not updated when the composer removal added
  a fourth.
- **m17. The "corrected" `strictEnv` precedence drops the third fallback**:
  `configuration.js:540` is `strictEnvOption ?? config.strictEnv ??
  config.runtime?.strictEnv`.
- **m18. "v3 generators wrote `server: { port: '{PORT}' }` into per-app configs"**
  (`:706`, `:1583`) is false — `runtime/lib/generator.js:42-47` writes it into the
  *root*, and `service/lib/generator.js:414-422` is guarded by
  `!this.config.isRuntimeContext`. The strip rule is still safe; its justification
  is hand-written and imported-standalone configs.
- **m19. The composer→gateway rename flips v3 entrypoint auto-detection** —
  `config.js:452` matches `application.type === '@platformatic/gateway'`, so a
  composer-schema'd gateway is *not* auto-detected on v3 but is after the rename.
  M1's pre-transform comparison cannot catch it.
- **m20. The standalone warning conflates blocks with files** — "(server, logger,
  telemetry, env, envfile) are not applied" reads as though root `.env` files are
  skipped; they are not.
- **m21. The root build's withheld-keys warning is now half-true** — the same keys
  *do* feed that build's config evaluation, so the warning cannot distinguish a
  genuinely withheld key from one consumed at config time.
- **m22. A standalone build could emit a weaker warning** — the walk has located the
  root config file by name, which is enough for "a root config exists at …; this
  build may differ from a root build".
- **m23. Hot-add has no stated `ConfigContext`** — `exec` defaults to
  `mode: 'development'`, `production: false`, which would evaluate a hot-added app
  against development env files inside a production runtime; and where `enabled` is
  resolved for a posted entry is unstated now that D4 pins it to the root worker.
- **m24. "The root worker runs `loadEnv`" vs "workers get an explicit `env`"** —
  see M4; the `--inspect-brk` paragraph presents spawn-ordering and the explicit-`env`
  rule as jointly necessary when they are alternatives.

---

## Decisions needed

| # | Finding(s) | Decision | Status |
|---|---|---|---|
| E1 | B1 | Make `env` blocks visible to the root worker's resolution pass (root-inline entries), or have migrate refuse these shapes | **resolved** — user decision: the **resolution pass's `ConfigContext.env` includes the root and entry `env` blocks** (it runs after the root export is unwrapped, so both are known), and migrate emits the **deferred callback form** `config: ctx => factory(…)` for any root-inline entry referencing a block key. Documented consequence: a *plain* inline factory call is evaluated eagerly and therefore sees **pre-block** env, while a callback form sees post-block env — a JS-level constraint (an expression inside an object literal cannot observe a sibling key), not a design choice, and it must be stated explicitly beside the two forms |
| E2 | B2 | Relax D17 for entries in the root config's own directory, or give migrate a promote rule | **resolved** — user decision: **D17's error stands**. `envfile` alongside an inline `config` remains illegal, and migrate **stops with hand-conversion required** for a root-directory application that declares `envfile`. Consequential edits: migrate's stated scope (`:1407-1408`, "anything that boots on v3") gains an explicit exception naming this shape; the third-party/hand-conversion gate must detect it from the lexical view *before* step 1 writes anything; and the migration guide documents the manual conversion (move the app into a subdirectory, or fold the envfile into the app's own `.env` set). Note the refused shape is tested v3 behavior — `packages/runtime/fixtures/env-config/` |
| E3 | B3 | Scope the non-entrypoint `server.port` strip to carried-over ports only | **resolved** — user decision: the strip applies **only to a `server.port` carried over from the v3 capability config**, never to a `port: 0` migrate synthesized from `useHttp`; the ordering is stated explicitly. D9 stands. The false justification ("v3 generators wrote it into every per-app config") is replaced with the real one: `runtime/lib/generator.js:42-47` writes the block into the *wrapped/root* properties and `service/lib/generator.js:414-422` is guarded by `!isRuntimeContext`, so the hazard comes from **standalone-scaffolded projects later pulled in by `wattpm import`**, where a formerly inert port becomes a live listener. Rule 1's premise still needs the capability-family fix from M20/E14. **Superseded by `e2da15eda`** — there is no entrypoint to be a non-entrypoint of; the strip rule survives only re-derived as "a `server.port` that was inert on v3", and the resolution now lives in NEW_CONFIG's migrate section |
| E4 | B4 | Extend `reuseTcpPorts`/`portAssignment` to per-app blocks, or restrict non-entrypoint fixed ports to `workers === 1` | **resolved** — user decision: **extend the existing warn-and-fall-back-to-one-worker path to any fixed-port application** — drop the `application.entrypoint` gate at `runtime/lib/runtime.js:676-686` and reword the message. Non-entrypoints then match the entrypoint: `SO_REUSEPORT` where available (already true on Linux via the *root-level* `reuseTcpPorts` default), graceful degradation with a warning where not (`features.node.reusePort` is `false` on `win32`/`darwin`, `foundation/lib/node.js:77`). Rides along: M16 — the **entry-level** `reuseTcpPorts` never reaches the `SO_REUSEPORT` decision (`basic/lib/capability.js:106` reads the *capability* config, where the property does not exist in any capability schema), so it must be plumbed or the `EADDRINUSE` condition at `:727-729` corrected to name the root-level property. **Superseded by `e2da15eda`** — the warn-and-fall-back path is deleted outright (from `addApplications` and the dynamic scaler alike), so a fixed port with `workers > 1` now simply requires `SO_REUSEPORT`; and the entry-level `reuseTcpPorts` *is* plumbed, reaching the decision via `context.applicationConfig` (`basic/lib/capability.js:105-110`, `runtime/lib/worker/controller.js:82`), which resolves the M16 rider in the opposite direction from the one recorded here |
| E5 | B5 | Decouple root-config location from the package.json execution-eligibility rules | **resolved** — user decision: **split locating from executing**. Finding a root config is a filename-only operation and needs no execution, so that walk continues past the nearest-`package.json` boundary — bounded by the marker (`.git` / `workspaces` / `pnpm-workspace.yaml`) or the filesystem root, still honouring the ancestor-eligibility rule (`:742-745`) — and its result supplies the **env root** and the **standalone warning**. The existing boundary is retained unchanged as the **execution** guard, so no additional config file becomes executable and the stray-config invariant is untouched. Two clauses to state: the standalone warning may now name a root config that was located but never evaluated (so its wording must not claim classification — see M13), and `:1101-1102`'s "never by boot style" holds again for the file layer |
| E6 | M1 | Equivalence-check comparand: post-transform, or pre-transform with the v3 side structurally expanded | **resolved** — user decision: **the equivalence check is dropped entirely.** Neither comparand is clean (pre-transform leaves the sides structurally incomparable on every autoload project; post-transform compares v3's transform output against v4's, which legitimately differ), and the build is large for a one-shot codemod. Knock-ons, all reductions: the **disposable resolved view** disappears — it existed *only* for this check — and with it the vendored replica of the runtime config machinery, the frozen capability **transforms**, the `strictEnv: 'warn'` forcing, step **3b** and its rollback trigger, the masked-unset second run, and the both-`production`-values run. The closure keeps the parsers, `replaceEnv`, the YAML pre-pass, the `$schema` URL machinery, the rename table, the four semgrator chains, and the frozen **schemas** the upgraded view's token-masked structural validation needs. **This supersedes E6b/M2** — the worker-boot env layer was added to the closure for the resolved view and comes back out. What replaces the check: step-3 validation through the real v4 loader, `requires-review` notes, git as the undo mechanism, and the dirty-tree rules. What is lost and must be stated: nothing verifies that converted *values* match, so the target-type table and the per-property boolean rules are trusted rather than checked |
| E6b | M2 | Extend the vendored closure with the worker-boot env layer | **superseded by E6** — applied in `5b196eb2a`, now reverted: with the resolved view gone there is nothing to build under a simulated worker environment |
| E7 | M3 | One block/file ordering for both views | **resolved** — user decision: **resolve each key declaratively from the ladder** in both readers — walk the sources top-down, take the first that defines the key, assign the resulting map once. No sequential passes, so an app `.env` can no longer overwrite a block-written key and the two views cannot drift. The ladder becomes the literal specification; provenance is a byproduct (which source won) rather than a set threaded through `workerData`. Requires rewriting the sequential-application prose in both places |
| E7b | M4 | Where `loadEnv` and provenance run | **resolved** — user decision: **the main process resolves every environment.** It reads the root env files and builds the root worker's env; the root worker returns the config, which is where the `env` blocks become known; main then resolves each application's env and spawns its eval worker with an explicit `env`; the same resolver runs again (plus injected `PLT_<ID>_URL`) when the runtime seeds application workers at boot. One implementation of the ladder for both views, so "config-time and runtime env agree by construction" is structural rather than aspirational. Consequences: `envFileKeys` and `injectedKeys` disappear from the worker protocols (provenance is internal to the resolver), the in-worker `loadEnv` sentence and the worker-boot env reader are deleted, and eval workers post back `{ config, importedFiles }` only. The isolation argument at `:934` survives on its real grounds — module-cache freshness and crash/hang containment — since computing a map was never mutation, which the object-config-source path already relies on |
| E8 | M5, M6, M7, M8 | Repair the env-model prose the D7 commit left stale or over-claimed | **applied** — M5 stale "runtime environment only" sentence rewritten; M6 narrowed to "env *files* are determined by directories" with the `env`-block asymmetry stated beside it; M7 scoped to the worker environment plus a rule stripping `PLT_*_URL` from eval workers; M8 restated as the entry-vs-entry merge it is (`runtime/lib/config.js:400-409`, explicit wins) with the plan's mislabel fixed |
| E9 | M9, M10 | Declare the `NODE_ENV`-under-build and entrypoint-auto-detection changes | **applied** — breaking change 20 now says `build` is new (v3 passed no production flag, `wattpm/lib/commands/build.js:41-43`); new breaking change 24 covers entrypoint auto-detection, with migrate pinning the v3-resolved `entrypoint` and `allowMissingEntrypoint` retained. **Half superseded by `e2da15eda`** — M9 (`NODE_ENV` under `build`) stands; M10 does not, since entrypoint auto-detection and `allowMissingEntrypoint` are gone entirely. Breaking change 24 was removed and folded into the rewritten item 19; what migrate pins instead is the v3 root `server` block, moved into the v3 entrypoint's capability config |
| E10 | M11, M12, M13 | Restore claim-check containment + realpath; define `--config` scope; define "root config" by classification | **applied** — containment restored ("at or below") with `realpath` on both sides; `--config` names the configuration, sets the project root, runs no walk and suppresses the re-scope (deploy note, BC 17 and the positional-scope paragraph all reconciled); the project root is the topmost *located* file's directory, classification unknown at that point and diagnostics worded accordingly |
| E11 | M14 | Specify ephemeral-entrypoint mechanics (`port: 0` on the entrypoint, pinning) | **deferred** — user decision: the entrypoint concept is slated for removal in a future version, so specifying multi-worker ephemeral-entrypoint mechanics now is wasted work. No mechanism is designed. The **false claim is struck** regardless — `:757-759`'s "one ephemeral port, reported and pinned for restarts" is replaced with the truth (each worker binds its own port; `#url` keeps the last reported; the pin applies only under stop-before-start and only when a `server` block exists). Reachability is low: it needs `workers > 1` *and* no declared port, and scaffolded and migrated projects both write one. **Superseded by `e2da15eda`** — the deferral's own premise ("the entrypoint concept is slated for removal in a future version") has been executed; `port: 0` now means one ephemeral port per worker for any application, with no special entrypoint case to specify |
| E11b | M15, M16 | `port: 0` + `portAssignment`; entry-level `reuseTcpPorts` | **applied** — declaring `portAssignment` alongside `port: 0` is a configuration error (semantically exclusive; `Number(0)+offset` would hand out ports 1,2,3); the per-application `reuseTcpPorts` is documented as selecting the restart strategy, not the `SO_REUSEPORT` decision, with per-app plumbing named as possible later work. **Superseded by `e2da15eda`** — `portAssignment` is deleted from the schema, so the M15 combination is unrepresentable; and the "possible later work" landed in the same commit, so the per-application `reuseTcpPorts` now does govern `SO_REUSEPORT` |
| E12 | M17 | Backfill remote-app paths in the root eval worker | **applied** — the root eval worker backfills `join(root, resolvedApplicationsBasePath, id)` during the same expansion step as `autoload` and `enabled`; a not-yet-resolved directory reports "run `wattpm resolve`", never a detector error |
| E13 | M18, M19 | Fix the shared-block list and collision rule; scope the "never imports" claim | **applied** — `cache` removed from the shared-block list (it is `next`-only; `db`'s block carries a boolean `cache`), the assertion restated as "no collision with each other **or** with any retained top-level key of that capability's own schema", and the `db.cache` decision recorded for the audit; the "never imports" claim scoped to the boot path, with `exec` importing `transform`/`createCommands` from the main entry as v3 already does |
| E14 | M20, M21, M22 | Capability-family-aware `useHttp`; rename before the gate; scope the `*_URL` carve-out | **applied** — `useHttp` made family-aware (basic: app's block wins; service/db/gateway: context wins, port already dead, recorded in a note); the pre-flight gate normalizes through the rename table first so composer apps pass; the `*_URL` carve-out scoped by **loader pass**, so a wrapped single-app config's capability half gets `requiredEnv` too |
| E15 | M23 | Envfile-promotion safety | **resolved** — user decision: **refuse and report.** A root `envfile` is not converted; migrate stops with hand-conversion required, naming the file and the supported manual fixes. Consistent with the E2 precedent: the conversion touches credentials and its correctness depends on facts migrate cannot see (whether `.env` is gitignored in this project, whether the envfile is committed, what the deployment expects). The promote-and-rename rule is deleted, and with it the `.env.v3-unused` target that matched neither ignore pattern scaffolding writes (`:1161` ignores only `.env*.local`, so `.env` is tracked by convention). This is the **second** documented exception to "anything that boots on v3" — it and the E2 `envfile` case are stated together, and both are detected by the pre-flight check before any write |
| E15b | M25 | Per-app files in directories with no `package.json` | **dissolved** — not a real defect. The bundled fallback resolves from `@platformatic/foundation`'s location (`configuration.js:622`), and foundation has **no dependencies**; neither `wattpm` nor `@platformatic/runtime` depends on any capability package. So the fallback's module search walks up into the same shared `node_modules` an app-directory import reaches, and can never find a capability the per-app file could not. Hoisted layouts resolve from the root; under pnpm strict, a capability not declared anywhere reachable would have failed v3's fallback too, and one declared at the root is reachable by walking up. Round 9 stated the finding without checking whether the fallback's scope exceeded the app file's. It does not. No emission rule needed |
| E15b | M24 | Re-install on rollback | **applied** — rollback re-runs the package manager against the restored lockfile, reporting the command on failure, since restoring `package.json` does not undo `node_modules` |
| E16 | M26, M27, M28 | `management` object form; `ApplicationEntryOverrides`; programmatic env root | **applied** — `management` typed `boolean \| { enabled?, operations? }` at both levels with the allowlist's role in hot-add stated; `ApplicationEntryOverrides` corrected to `Omit<…,'config'\|'path'\|'url'\|'gitBranch'> & { id: string }`; the programmatic `root` argument declared the project root, with per-app discovery and `env`-block visibility unchanged |

Minors m1–m24: **applied** — citation drift (m1), the `PLT_ROOT` and `wattpm resolve` attributions (m2, m3), the flattening capability list and `next.https` (m9, m10), `watch.enabled` (m11), `db:print-schema` (m12), the Appendix A sourcemap family (m13), `--resume`'s regeneration rule (m15), migrate's `package.json` edit classes (m16), the `strictEnv` third fallback (m17), the generator claim (m18), the standalone warning's blocks-vs-files wording (m20), `portAssignment` root-only (m5), and the omit-defaults gate keyed on the detector table (m6).

Three of those minors are **superseded by `e2da15eda`**: m4 (the entrypoint
server-merge stated as a chain rather than a deep merge) — there is no merge, the
capability's own block is used verbatim; m5 (`portAssignment` annotated root-only)
— the property is deleted from the schema; and m18's strip-rule justification —
`service/lib/generator.js`'s `!isRuntimeContext` guard is itself gone in v4, where
every scaffolded application owns a port. The corrections were correct when made;
the properties they corrected no longer exist.

**Remaining open: M1, M3, M4, M14, M23, M25** (tracked as E6, E7, E11, E15) — six genuine design choices, not corrections.

Of those, **M14 is moot after `e2da15eda`**: its subject — what `port: 0` means on
the entrypoint, and how the pin behaves — went with the entrypoint, and E11's
deferral note ("slated for removal in a future version") has been executed. In its
place the removal opens new questions, recorded in NEW_CONFIG's "How
applications are exposed".

## Post-rebase decisions (after `e2da15eda`)

| # | Question | Status |
|---|---|---|
| P1 | What port a zero-config boot binds | **resolved** — user decision: synthesis injects `server: { port: Number(process.env.PORT ?? 3042) }`, and **only when there is exactly one application**. The convention stays in configuration — synthesis *is* the configuration for a zero-config boot — rather than becoming a hidden loader default. The qualifier is automatically satisfied here, since `fallbackToTemporaryConfigFile` (`foundation/lib/cli.js:255-274`) detects one application type for the root directory and can never produce more, but it is stated as the general rule: **the port convention is applied only to a single-application project**, which also binds P4 |
| P2 | Whether a portless framework definition is rejected at load time | **resolved** — user decision: **no warning class; report every application's exposure at startup instead.** `#showUrls` (`runtime/lib/runtime.js:1944-1965`) currently does `if (!url) continue`, so portless workers are skipped and a project that binds nothing produces no diagnostic at all. It prints one line per application instead — its URL, or `mesh-only` with its `.plt.local` address, which is genuinely reachable (`basic/lib/capability.js:417-419` falls back to in-thread dispatch). Turns silence into information without a warning that would fire on the N−1 legitimately mesh-only applications in a typical monorepo, and without a capability-class distinction in the loader. Not listening remains a valid state |
| P3 | Whether the macOS/Windows fixed-port multi-worker regression is accepted | **out of scope** — user decision: a runtime regression, not a configuration-format question. Filed as platformatic/platformatic#5070 for discussion and reproduction on a Mac. The proposal now states only that a fixed port with `workers > 1` requires `SO_REUSEPORT` and defers platform degradation to the runtime; the "this is a real regression" framing and the workaround list are removed from both the exposure section and breaking change 22 |
| P4 | How migrate places a v3 root `server` block without an entrypoint | **resolved** — user decision: **resolve the v3 public application lexically, drop the block when it does not resolve.** Apply v3's own rule over the config text (`runtime/lib/config.js:436-465` pre-removal): an explicit `entrypoint` names it; else a single application; else the single application whose module is `@platformatic/gateway`. That application's capability config receives the **whole** `server` block — `hostname`, `port`, `http2`, `https`, … — not just the port. Uses only the module list migrate already computes for the pre-flight check, so it revives nothing E6 dropped. When it does not resolve (several apps, no explicit `entrypoint`, zero or 2+ gateways), v3 booted mesh-only — `transform` left `entrypoint` undefined and threw only for a *named* missing one — so the block is dropped and the summary reports it. Per P1 the `Number(process.env.PORT ?? 3042)` convention applies only to single-application projects; multi-app ports come from the v3 config |
