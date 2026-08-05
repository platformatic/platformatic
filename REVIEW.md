# Adversarial review of NEW_CONFIG.md — round 8

**Reviewed:** 2026-08-04, against HEAD `75af6996d` on `feat/new-config-proposal`
**Method:** four independent adversarial passes (loading pipeline, environment
model, migration, runtime/ecosystem), findings deduplicated and every source claim
re-verified against the current tree. Round-7 findings are treated as resolved and
are not re-litigated; a large fraction of what follows targets **the round-7
resolutions themselves**, which are now the doc's text.

---

## Blockers

### B1. The standalone "claim check" has no deciding-file exemption — every Level 1b, `path: '.'`, and root-inline project boots standalone *from its own project root* and silently discards all runtime settings

Round-7's D2 exempted the deciding file from the **configured-twice** check
(NEW_CONFIG.md:290-294) but left the **claim check** unqualified: "if cwd is
inside a directory that root config **claims as an application** (an entry's
`path`, …), **that app boots standalone**" (:549-556) — and standalone boot means
"the *root* config's settings are **not** applied" (:618-620).

The doc's own Appendix B output (:1694-1703) is the counterexample. The
`application` shorthand "that declares no `path` defaults to the config file's own
directory" (:60-61) = the root. `cd /repo && wattpm dev` → cwd is a claimed
application directory → `next` boots standalone → `server.port`, `logger.level`,
and `workers: 2` are all discarded. The very next sentence — "Otherwise the full
runtime boots; running from the project root behaves exactly as v3" — is
unreachable for every Level 1b project. Identical breakage for the
machine-generated flagship (`{ id: 'api', path: '.', … }`, :1085) and for
migrate's same-directory root-inline emission (:1278-1283, the D19 resolution).
v3 honors all of it (`runtime/lib/worker/main.js:275-276`,
`runtime/lib/config.js:172`).

**Fix direction:** give the claim check the same exemption as the configured-twice
check — an entry whose directory is the deciding config file's own directory never
triggers a standalone re-scope — and state both exemptions in the same sentence so
they cannot drift again.

### B2. "Project root" is defined three incompatible ways; the normative one drops the `.env` sitting beside the root config

Three passages disagree: the root worker reads env files "**in the config file's
own directory**" (:689-690); the walk reads "that file's directory's env files
layered over **the project root's**" — three directories (:543); the normative
Env-files rule says "exactly two directories: **the project root (the walk's
boundary directory)** and the application directory", intermediates "**never**
consulted" (:950-952, repeated in breaking change 5 at :1424).

They diverge whenever the root config does not sit at the walk boundary — the
ordinary polyglot/monorepo layout. `/repo/.git`, `/repo/backend/watt.config.ts`,
`/repo/backend/.env` (`DATABASE_URL`): boundary = `/repo`, so `/repo/backend/.env`
is an *intermediate* directory and is never read. v3 loads it — `loadEnv` walks up
from `dirname(configFile)` and takes the first hit
(`foundation/lib/configuration.js:344,359-372`). Breaking change 5 says only that
the walk is "narrower"; it never says the root layer *moved* from "nearest `.env`
at or above the config directory" to "the boundary directory's `.env`", which can
be a different file belonging to an unrelated part of the monorepo. `envFileKeys`
is computed from the same set, so provenance is wrong for the whole worker ladder
too. Residue: ":668-669 still says "The `.env` **walk** uses the same boundary",
wording that only made sense before D11.

**Fix direction:** define "project root" once — the directory of the deciding
**root** config file when one exists, the boundary directory otherwise (the walk
locates the ancestor root config even when it does not boot it, :568-570, so this
is well-defined under standalone boot too) — reconcile :689/:543/:950 to it, delete
the "walk" wording at :668, define it for `--config`, and add the root-layer
relocation to breaking change 5.

### B3. The listen rule erases `reuseTcpPorts` and `server.portAssignment` — the standard multi-worker fixed-port entrypoint is declared an `EADDRINUSE` failure

":640-642 — "A **fixed** port with `workers > 1` **remains** a fast `EADDRINUSE`
failure — `0` is the multi-worker listener". Verified false in three places, and
neither property occurs anywhere in NEW_CONFIG.md (grep: 0 hits — not in the listen
rule, not in Appendix A, not in breaking changes):

- `reuseTcpPorts` is a user-facing property defaulting to **`true`**
  (`foundation/lib/schema.js:898`, per-app copy at `:1108`); the capability opts
  every listen into `reusePort` (`basic/lib/capability.js:106,796-806`); the
  runtime only downgrades when the OS lacks the feature
  (`runtime/lib/runtime.js:3547`). On Linux, N workers bind the same fixed port and
  the kernel load-balances.
- `server.portAssignment: 'shared' | 'perWorkerIncrement'`
  (`foundation/lib/schema.js:396`) gives worker *i* port `port+i`
  (`runtime/lib/runtime.js:670,2413,4224`).

So `defineConfig({ server: { port: 3042 }, workers: 4 })` — the standard production
entrypoint — boots today and is an error under the v4 rule as written, with the
only offered remedy (`port: 0`) making the entrypoint unreachable.

**Fix direction:** add a fixed-port multi-worker bullet to the listen rule
(`reuseTcpPorts`, default true, SO_REUSEPORT where available;
`portAssignment: 'perWorkerIncrement'` for the deterministic variant), scope the
"fast `EADDRINUSE`" claim to `reuseTcpPorts: false` / unsupported OS, add both to
Appendix A, and re-justify the `useHttp → port: 0` rewrite on a true premise.

### B4. `enabled` filtering now runs *after* per-app evaluation, validation, and detection — disabled applications break boots they never touched in v3

The v4 order is root worker → per-app eval workers "uniformly for every application
entry that has a `path` and no inline `config`" (:702-706) → main-side capability
validation (:715-720) → AJV → `kMetadata` → `transform()` (:795-797). But `enabled`
filtering lives inside `transform()` and in v3 runs *before* anything touches an
app: `runtime/lib/config.js:412-416` splices disabled apps out, and only then does
`:428-429` call `prepareApplication`. No worker is spawned and no config parsed for
a disabled app today. The audit explicitly **keeps** `enabled`'s per-environment
object (:1064).

Concrete: `{ id: 'legacy-admin', path: 'web/admin', enabled: { production: false } }`
whose `watt.config.ts` imports a capability deliberately absent from the production
image (or calls migrate's `requiredEnv('ADMIN_TOKEN')`, unset in production). v3
boots. v4 spawns the eval worker, the import throws, production boot fails on an
application the config disabled. Same failure via the new detector's "a directory
with no JS sources is an error naming the app" rule (:735-737) for a decommissioned
directory.

**Fix direction:** evaluate `enabled` in the root eval worker immediately after
autoload expansion and before fan-out (the root context already carries
`production`), state that disabled entries are dropped before per-app workers, the
detector, and capability validation, and note the resulting `transform()`
simplification in the plan.

### B5. v3's implicit `NODE_ENV=production` rung is unaccounted for in both ladders, both breaking-change lists, and the build-env rule

`worker/controller.js:127-129`: `if (appConfig.isProduction && !process.env.NODE_ENV)
process.env.NODE_ENV = 'production'` — set in every worker under `wattpm start`
(`wattpm/lib/commands/execution.js:118` → `runtime.js:251`), after all env seeding,
only when unset: effectively the bottom rung of the v3 env model. It lives in
exactly the code path the doc deletes ("the worker controller's file-scanning and
`$schema` resolution are deleted", :855-856).

NEW_CONFIG.md mentions `NODE_ENV` once (:275), only to forbid config branching on
it. Neither ladder has a rung; breaking change 20 removes the two sibling injected
variables with the rationale "apps branch on their own variables" while saying
nothing about the variable virtually every app actually branches on. A migrated
Fastify/Express/Next app started in a container that sets no `NODE_ENV` silently
gets development semantics in production. Second consequence: :605-609 forbids
injecting anything at build time "in every mode", so `wattpm build` produces
development bundles — newly contradictory now that :368-369 declares
`production === true` under build.

**Fix direction:** add an explicit lowest rung to both ladders (`NODE_ENV` defaults
to `production` when `production === true` and the key is absent from every other
rung), carve it out of the build-determinism sentence as a permitted deterministic
injection, and state that it is *not* in `injectedKeys` (env blocks and files must
still be able to set it).

### B6. Capability CLI commands receive *pre-transform* config with no `kMetadata` — every in-tree `db:*` and `next:*` command breaks

D13 gave commands "`{ root, config }` — the app's resolved **raw** config from the
eval pass" (:1150-1153), i.e. the same `resolvedConfig` = "validated raw capability
payload" (:1108). There is no worker for `command: 'exec'`, so nothing runs the
capability transform — but every in-tree command consumes transform output:

- `db/lib/config.js:9-17` rewrites a relative sqlite path to absolute via
  `config[kMetadata].root`, and `:30-45` injects the `migrations.table` / `db.ignore`
  defaults `Migrator` requires. `wattpm db:migrations:apply` on
  `sqlite://./db.sqlite` would resolve against the CLI's cwd with no table default.
- `db/lib/commands/seed.js:12,32`, `types.js:7`, `print-schema.js:8` read
  `config[kMetadata].root` directly.
- `next/lib/commands/pack.js:39,53` constructs `new NextCapability(root, config, …)`
  from what would be untransformed config.

Round-7's D8 rebuilt `kMetadata` only on the **worker boot** path; the `exec` path
D13 introduced has neither a transform nor a `kMetadata` source.

**Fix direction:** state that `exec` evaluations run the capability transform
main-side after the eval pass, with a synthesized `kMetadata`
(`{ root, path: configPath, module, version, env }`) and a defined answer for the
context fields that do not exist there (`telemetryConfig`, watch flags,
`configPatch`) — or pass a *transformed* config and stop calling it raw.

### B7. Migrate inlines `env`-block and `envfile` values into tracked source — baking secrets, and contradicting the doc's own reason for the three-view system

D14's resolution (:1310-1315) resolves placeholders that v3 took from `env` blocks
or `envfile` contents "at generation time from those lexically-known layers and
**the value is inlined** with a comment naming its source".

That is exactly what :1224-1227 says must never happen: "a set `PLT_REDIS_URL` has
already become its literal value (**possibly a secret that must never be baked into
source**)". `env` blocks and envfiles are where secrets live. v3 root
`"env": { "DATABASE_URL": "postgres://app:s3cr3t@db/prod" }` plus an app config
`"connectionString": "{DATABASE_URL}"` (resolution confirmed:
`worker/main.js:264-266` runs before `controller.js:144-147`) becomes a literal
password in `web/api/watt.config.ts` — a file step 5 then tells the user to commit.
Worse when the source is a gitignored `envfile`.

The `envfile` half is also simply wrong now: breaking change 21 makes per-application
`envfile` govern **config evaluation** (:977-986), so "v4 config evaluation
deliberately excludes both" is false for it, and inlining freezes values an operator
expects to change by editing the file.

**Fix direction:** never inline. `envfile`-sourced placeholders emit the plain
`process.env.X ?? ''` reference (D10 already makes it resolve). `env`-block-sourced
ones keep the block in the emitted config and emit the reference plus a
requires-review entry naming app, key, and source block; `--inline-env-blocks` is
the opt-in, mirroring `--use-sample-defaults`.

---

## Majors

### M1. `envFileKeys` never travels *into* the per-app eval workers — the config-evaluation ladder's top rung is unimplementable

D7 fixed provenance outbound (`injectedKeys` in `workerData`, injected keys stripped
from `envFileKeys`). The evaluation side has the mirror hole: `envFileKeys` appears
only in what a worker posts *back* (:753-754) and in worker seeding (:755-760).
Per-app eval workers are told only to apply "app env files … over the root view"
(:708-711) — with no provenance, they cannot distinguish a real-environment key from
a root-file key and so cannot honor `real environment > app env files` (:936).

Real env `REDIS_URL=redis://prod` (k8s secret), root `.env` silent,
`web/frontend/.env` `REDIS_URL=redis://local`: a naive layered apply bakes
`redis://local` into `next({ cache: { url: process.env.REDIS_URL } })` while worker
boot correctly resolves `redis://prod` via `envFileKeys`. The two views provably
disagree, contradicting ":365-366's "agree by construction".

**Fix direction:** make `envFileKeys` part of the *inbound* protocol (root worker →
main → per-app workers); state the app worker's apply rule in the same three
provenance classes as the boot rule; state that the worker-boot reader adds the
app-file keys it applies to its own file-sourced set before the `env` blocks apply.

### M2. Non-entrypoint apps with a `server` block start listening — v3 ignores it entirely

":634-636 — "any **other** application listens only when its own config's `server`
block sets a port" — is presented among v3-preserving bullets but is new. In v3 the
only thing that makes a non-entrypoint listen is `useHttp`:
`worker/controller.js:218` (`const listen = !!this.applicationConfig.useHttp`) and
`:266-268` (`listen()` no-ops unless entrypoint); for `@platformatic/node` the port
override is additionally gated on `isEntrypoint()`
(`basic/lib/worker/listeners.js:25-30`).

Generator-written v3 per-app configs routinely carry
`"server": { "hostname": "{PLT_SERVER_HOSTNAME}", "port": "{PORT}" }`, and migrate
preserves the block verbatim — so after migration every such non-entrypoint app
opens a real TCP listener, N apps racing for one port. Not in breaking changes.

**Fix direction:** restore v3's rule (non-entrypoints listen only with `port: 0`),
or keep the new rule with a numbered breaking change *and* a migrate rule stripping
`server.port` from non-entrypoint apps.

### M3. "Root `server` → the app's own `server` block" is not v3 for the basic-family capabilities — there the app's own block wins

":623-631 claims the entrypoint resolves "root `server` settings → the app
definition's own `server` block → defaults" and that this is "v3 behavior on both
counts". For every basic-derived capability (node, next, vite, astro, remix, nest,
nitro, nuxt, react-router, tanstack) the merge is
`basic/lib/capability.js:89`: `deepmerge(this.context.serverConfig ?? {}, config.server ?? {})`
with `@fastify/deepmerge({ all: true })` (`foundation/lib/object.js:20`) — **later
wins**, so the app's own block overrides the root. Only the service family inverts
it (`service/lib/capability.js:222`). Root `port: 3042` + a Next entrypoint with
`server.port: 8080` binds 8080 today, 3042 under v4. Not in breaking changes.
(Also: `wrapInRuntimeConfig` hoists only `{hostname, port, http2, https}`,
`runtime/lib/config.js:147-154` — narrower than "the definition's `server` block".)

**Fix direction:** pick one order for v4 and present it as a *unification of two
divergent v3 paths* with a breaking-change entry, rather than as v3 behavior; state
the hoist's exact key set.

### M4. Entrypoint auto-detection is unspecified, and its v3 rule is unsatisfiable in the canonical v4 style

`entrypoint` is optional (:1584) and is one of the four root discriminators (:535),
but auto-detection appears nowhere in the loader or runtime sections — only in
migrate's vendored-closure list (:1251). v3 detects in `transform()`
(`runtime/lib/config.js:436-463`): single application wins; otherwise exactly one
app with `type === '@platformatic/gateway'` — and the scan **skips any app without a
config**, `config.js:448-450` (`if (!application.config) continue`). In the canonical
v4 style the gateway app has a per-app file and no `applications[].config` in the
root entry, so a literal port skips every candidate.

**Fix direction:** specify detection against the v4 data model (single app ⇒
entrypoint; else exactly one app whose resolved `module` is `@platformatic/gateway`;
else none), state what "the selected entrypoint always listens" means when there is
none (v3 boots mesh-only; `InvalidEntrypointError` fires only for a *named* missing
entrypoint, `config.js:465-467`), and have migrate emit the resolved `entrypoint`
explicitly in the thin root.

### M5. The `PORT`/3042 entrypoint default overrides the application's own `listen()` — v3 defers to it

":623-625 makes `PORT`/3042 the terminal rung, and :594-597 leans on it. There is no
`3042` default in any schema — it exists only in generator templates writing
`PORT=3042` into `.env` (`runtime/lib/generator.js:57`,
`service/lib/generator.js:279`). v3's actual terminal behavior is "the app's own
`listen()` argument stands": `wrapInRuntimeConfig` emits no `server` key when the app
set none (`runtime/lib/config.js:147-163`), the worker passes `serverConfig = null`
(`worker/main.js:274-283`), and `overridePort` normalizes to `0`
(`basic/lib/worker/listeners.js:17-30`). A bare Express repo ending in
`app.listen(3000)` binds 3000 on v3 and 3042 on v4. Not in breaking changes.

**Fix direction:** declare the new default as a breaking change, or keep v3's
terminal rung and find another justification for the parallel-standalone paragraph.

### M6. Standalone boot of a root-inline-configured app is undefined, and the "provably identical" invariant it protects is already false

Level 2b puts an app's whole capability config in the root entry (:248-271), and the
configured-twice check forbids that app from owning a file (:286-299). So
`cd web/api && wattpm dev` hits the claim check → standalone → "the root config's
settings are **not** applied" (:618-620) — but the app's *only* configuration source
is a root setting. Either it is dropped (the detector then picks a capability off an
unrelated framework dep) or the root entry is partially applied, which the standalone
warning's list (:573-576) never sanctions. Either way :300-306's "Erroring keeps root
boot and standalone boot **provably identical**" is false for exactly the topology
the error protects — and independently false again for `envfile`, which :988-991
admits a standalone boot ignores.

**Fix direction:** exempt entries carrying an inline `config` from the claim check
(running inside their directory boots the full runtime, with a one-line notice),
and replace "provably identical" with its honest scope.

### M7. Breaking change 18's migrate warning is structurally silent for the keys that break, and never reaches generated configs

The inversion (:1470-1474) of v3's `env`-block pins
(`worker/main.js:264-269`) is backed only by migrate's warning, which fires for
"every `env`-block key present in **the migration-time environment**" (:1323-1326).
Migration time is a laptop or CI checkout; the keys that flip are the ones set in the
*deployment* environment and absent locally — which is the whole point of a pin.
`"env": { "DATABASE_URL": "postgres://primary/app" }` pinning off a cluster variable
warns nowhere and is silently overridden in production. And the doc's own supported
ICC pattern generates configs directly (:1097-1098), never passing through migrate at
all.

**Fix direction:** warn for *every* carried-over `env`-block key, not only colliding
ones, and add a runtime-side boot diagnostic when a worker's `env`-block key is
suppressed by the real environment — the only channel generated configs have.

### M8. `PLT_ROOT` is an injected v3 worker variable with no rung, no breaking-change entry, and no migrate scan

`foundation/lib/configuration.js:511` sets `env.PLT_ROOT = root` on the object that
becomes `kMetadata.env` → `runtime.#env` (`runtime.js:244`) → every worker's
environment (`:2458`); asserted in
`runtime/test/start/custom-environment.test.js:26-30` alongside
`PLT_DEV`/`PLT_ENVIRONMENT`. Assigned after `loadEnv`, so no app `.env` can override
it. NEW_CONFIG.md treats `PLT_ROOT` only as a *placeholder* (:1330-1334) and never as
a variable; app code doing `readFile(join(process.env.PLT_ROOT, …))` — the pattern v3
generators encouraged (`generators/lib/utils.js:94,106`) — throws after migration,
and step 4's scan covers only legacy config references and `PLT_DEV`/`PLT_ENVIRONMENT`.
The worker-side `kMetadata` reconstruction (:861-866) also silently drops it,
changing `GET /applications/:id/env` (`basic/lib/capability.js:355`).

**Fix direction:** decide as for `PLT_DEV`/`PLT_ENVIRONMENT` — keep it with a defined
rung and build-time value (noting it is the *runtime* root, while `kMetadata.env`'s
copy was the *app* root), or remove it with a breaking-change entry and extend the
step-4 scan.

### M9. Standalone builds never evaluate the root config — so `envfile` breaks build determinism and the withheld-keys warning cannot fire

":605-609 promises `turbo run build`, a standalone app-dir build, and a root build
produce "identical artifacts by construction", and :610-616 (D23) promises every build
warns naming the withheld root/entry `env`-block keys. Under a standalone build the
walk stops at the app's own file and the root config is only *filename-detected*
(:568-570), so neither mechanism has its input:

- `envfile` lives on the root entry and governs both views (:977-992); a root build
  reads `build.env` (production API base), `turbo run build` reads `web/frontend/.env`
  (localhost). Two different client bundles from the doc's two named scenarios.
- The root/entry `env` blocks are unknown, so the warning is unemittable in exactly
  the `NEXT_PUBLIC_*` case it was created for.

**Fix direction:** have the standalone path evaluate the ancestor root config for
diagnostics and `envfile` resolution (it already locates the file), or scope both
claims explicitly ("identical when no application declares `envfile`"; "the warning is
root-build-only") and put the standalone build hazard in the migration guide beside
the working-directory note.

### M10. `envfile` on a root-inline entry cannot govern the evaluation view

An entry with an inline `config` spawns **no** per-app eval worker (:706-708), yet
`envfile` on that same entry "governs both views … in the app's eval worker *and* at
worker boot alike" (:980-983). There is no app eval worker to govern:
`{ id: 'api', path: 'web/api', envfile: 'prod.env', config: node({ main: process.env.MAIN_FILE }) }`
evaluates under the root view and runs under `prod.env` — the two views disagree on
the file layer itself, which :984-986 says cannot happen.

**Fix direction:** make `envfile` an error on an entry carrying an inline `config`, or
restate the rule as "governs the runtime view always, and the evaluation view only for
apps with their own config file".

### M11. `--production` and `mode` are decoupled for `exec` — the doc's own CI example targets the development database

":1156-1162 defaults exec to `mode: 'development'`, `production: false`, accepts
`--production` / `--mode`, and says "env-file selection follows **mode**". Nothing says
`--production` moves `mode`. So the documented CI command
`wattpm db:migrations:apply --production` keeps `mode: 'development'` and loads
`.env.development*` — applying migrations against the dev connection string. That is
the wrong-database hazard round-7 M8 was opened to close, reintroduced by its own
resolution's example.

**Fix direction:** state that `--production` implies `mode: 'production'` unless
`--mode` is given (matching the boot verbs), or drop `--production` for exec and make
`--mode` the only selector, updating the example.

### M12. Free-form `mode` and `enabled`'s environment keys are two unreconciled notions of "environment"

`mode` is free-form and "selects env files everywhere" (:363-366), while `enabled` is
keyed by a binary environment derived from `production`
(`runtime/lib/config.js:298-318`) with `additionalProperties: { type: 'boolean' }`
(`foundation/lib/schema.js:867-877`) — and the audit **keeps** it (:1064).
`enabled: { staging: false }` under `wattpm start --mode staging` validates, resolves
`enabled['production'] ?? true` → the app starts, no error, no warning, while every
`.env.staging` file *is* honored.

**Fix direction:** in the audit, either key `enabled` by `mode` (with
`production`/`development` as the default mode names, preserving existing configs) or
tighten its object branch to `additionalProperties: false`; state the
`mode`/`production`/`enabled` relationship in the context section.

### M13. Migrate has nowhere to put a rewritten per-app `envfile`, and `ApplicationEntryOverrides` is never defined

Breaking change 21 requires rebasing each app's `envfile` (v3 resolves against the
runtime root — confirmed `worker/main.js:236-237` with `runtime.js:2512`). But
`envfile` is an orchestration property (:1623-1625) and "factories do **not** accept
orchestration properties" (:402-403), so it cannot go in the per-app file migrate
emits; migrate's thin root is `defineConfig({ entrypoint, autoload })` with no
`applications` array; and the only remaining slot, `autoload.mappings`, is typed
`Record<string, ApplicationEntryOverrides>` — a type referenced once and **never
defined** (:1587). A v3 `mappings: { api: { envfile: 'envs/api.env' } }` has no legal
v4 destination and the app silently boots on the conventional four-file set.

**Fix direction:** define `ApplicationEntryOverrides` in Appendix A as the
orchestration subset of `ApplicationEntry` (explicitly `envfile`, `env`, `workers`,
`health`, `dependencies`, `enabled`), and state that any app with non-default
orchestration forces an `autoload.mappings` entry even when its capability config is
default.

### M14. `--debug-config --inspect-brk` contaminates the very workers its single-file restriction exists to protect

":829-837 restricts in-process evaluation to one file "precisely because one process
has one module cache", while "the other files still evaluate in their workers", and
:785-788 restores the main process's env *afterwards*. Node copies `process.env` into
a `new Worker()` at construction unless an explicit `env` is passed, and the doc never
specifies one — so every worker spawned during the mutation window inherits the target
app's env as apparent **real** environment, the top rung. `--debug-config
--inspect-brk web/frontend/watt.config.ts` prints `api`'s config with frontend's
`REDIS_URL`: "cross-app contaminated values that a real boot never uses", the exact
outcome the restriction was introduced to prevent.

**Fix direction:** specify that eval workers are always constructed with an explicit
`env` (the computed layered view), never by inheritance, and that other workers are
spawned before the in-process mutation (or from the snapshot).

### M15. The equivalence check has no runnable position in the sequence

":1257-1266 places the check before "Then: 1. Emit the v4 files" and says it "stops the
run before anything is deleted". But its v4 comparand requires step 1's files, step 2's
**install** (":1337-1341 argues at length that range edits change nothing on disk), and
step 3's private loader entry. So it can only run at ~3b — after files are written,
`package.json`s edited, and the lockfile mutated — which undercuts the framing the
third-party check was hoisted to satisfy (:1354-1357). The doc gives it no step number,
no comparand pairing, and no rollback statement.

**Fix direction:** number it step 3b, explicitly after install and the step-3 load;
name the two comparands; state that a mismatch triggers the manifest rollback (created
files removed, tracked files restored, lockfile restored), i.e. the install is inside
the transaction.

### M16. The equivalence comparand mismatches on every project, and three of its four exclusions are unreachable

":1257-1262 — per-application deep equality of validated pre-transform configs,
excluding pprof preloads, watch flags, `*_URL` rewrites, and `kMetadata`.

- The two sides are validated by **different schemas with different AJV options by
  design**: v3 is `useDefaults: true, coerceTypes: true`
  (`basic/lib/config.js:76-80`); v4 is the audited schema with `coerceTypes: false`
  (breaking changes 7/16). Deep equality mismatches wherever the audit touched
  anything — its entire purpose.
- pprof preload mutates the **root** `config.preload` in the runtime transform
  (`runtime/lib/config.js:502`), watch is set post-transform on the entry
  (`config.js:287-289,321-325`) — neither can appear in a per-application
  pre-transform config. Only `kMetadata` (`configuration.js:595-602`) is in scope.
- The **entire root conversion** — `runtime` unwrapping, alias merging, `{PORT}`,
  `metrics`/`logger`/`telemetry`, autoload, entrypoint, `useHttp` relocation — is
  outside a per-application comparand, so the check verifies the least risky half.
- Applications disabled in the pinned environment are absent from the resolved view
  and never compared at all, while the lexical view correctly emitted files for them.

**Fix direction:** compare both the **root** config and each application's capability
config, post-validate/pre-transform, with an exclusion list covering `$schema`,
`preload`, `watch`, `restartOnError`, `inspectorOptions`, and removed properties;
define equality **modulo the audit's per-property target-type table** rather than
raw; and run the check across both `production` values when any app declares `enabled`.

### M17. The masked second run cannot execute migrate's own `requiredEnv` output — D15 and D16 are mutually exclusive

":1262-1266 runs the check a second time "with every referenced variable masked to
*unset*". For a `strictEnv` project step 1 emits `requiredEnv('DATABASE_URL')`, which
**throws** when unset by design (:1289-1293) — so the masked run cannot complete. Step
3's sentinel injection (:1365-1368) resolves that by making the variable *set*, which
means the masked run then exercises no fallback path. The two round-7 resolutions
cancel on exactly the project class D16 exists to unblock
(`configuration.js:562-569`).

**Fix direction:** scope the masked run to keys that are **not** `requiredEnv`-wrapped;
`requiredEnv` keys are sentinel-injected in both runs, with the sentinel echoed into
the v3 side's pinned `env` so both sides agree.

### M18. `@platformatic/composer` apps pass the omit-defaults gate onto a package that does not exist in v4

`extractModuleFromSchemaUrl` (`configuration.js:166-179`) runs at `:573`, **before**
`upgrade` at `:575`, so a `platformatic.composer.json` app's module identity stays
`@platformatic/composer` even though the gateway chain rewrites `$schema`; the worker
uses the un-upgraded config for module selection too
(`worker/controller.js:144-147`). Such an app has exactly one app-local
`@platformatic/*` dep equal to that module → passes the D5 gate → no file emitted → no
dependency edit → the v4 detector finds `@platformatic/composer`, a package the plan
never converts (step 6 lists thirteen capabilities; CLAUDE.md: "deprecated alias kept
until v4"). Replacing it is also a *removal*, not one of the three sanctioned
`package.json` edit classes (:1401-1404).

**Fix direction:** add a v3→v4 module rename table to the closure
(`composer`→`gateway`); renamed modules never satisfy the gate, always force emission
of the `gateway(…)` file, and get a fourth sanctioned edit class (removing the
superseded dependency). Add a breaking-change entry for the package's removal.

### M19. Third-party capabilities *with* a v4 release still cannot be migrated

The closure is "frozen v3 snapshots of the **~13 capability** schemas and their
transforms" plus the four in-tree chains (:1205-1213), and the resolved view imports
no project package (:1248-1254). The gate only stops runs for capabilities *without* a
v4 release (:1353-1355). So `@acme/capability@3.x` with a published v4 passes and then
has no frozen schema (no defaults, no `resolvePath`/`resolveModule`,
`configuration.js:264-301`), no transform, no upgrade chain, and **no entry in the
target-type table** — so the entire placeholder-conversion rule is untyped for it.
`prepareApplication` additionally reads `pkg.skipTelemetryHooks` / `pkg.modulesToLoad`
off the real package (`runtime/lib/config.js:249-256`).

**Fix direction:** either narrow the gate (any out-of-closure capability stops the run
regardless of v4 readiness) or define a contribution point — the capability exports a
frozen `{ schema, transform, upgrade, targetTypes }` bundle migrate loads from the
installed package, as an explicit carve-out from the never-import rule.

### M20. v3 configs identified by top-level `module` instead of `$schema` are unhandled

`extractModuleFromSchemaUrl` returns the config itself when
`typeof config?.module === 'string'` (`configuration.js:157-158`), with
`splitModuleFromVersion` parsing `@acme/php@1.2.3` (`foundation/lib/module.js:129-140`);
`module` is a first-class top-level property of every capability schema. Every migrate
rule is written against `$schema`: the omit-defaults gate compares against "the v3
`$schema` capability", the third-party pre-check "needs only the lexical view's module
list" (never defined as covering `module`), and the version suffix drives chain
selection (`configuration.js:578-580`).

**Fix direction:** define the lexical module list as
`config.module ?? extractModuleFromSchemaUrl(config)` with `splitModuleFromVersion`
applied; state that a `module`-identified app never satisfies the gate and always gets
an emitted `{ module: '…' }` config.

### M21. `useHttp → server: { port: 0 }` is unspecified when the app already has a port — and in v3 the app's own block wins

`useHttp` is a root **entry** property (`foundation/lib/schema.js:895`); `server` is
**capability** config — so the rewrite crosses the boundary the doc says never merges,
into a file that may not exist. v3 builds
`{ port: 0, hostname: '127.0.0.1', keepAliveTimeout: 5000 }`
(`worker/main.js:275-283`) and then `basic/lib/capability.js:89` lets `config.server`
override it: an app with `useHttp: true` *and* `server.port: 3001` listens on a stable
3001 today. Migrate as specified either clobbers it or no-ops — unspecified which — and
drops `keepAliveTimeout` and the loopback default. Nor is it stated that `useHttp`
forces per-app-file emission past the omit-defaults gate.

**Fix direction:** set `server.port = 0` only when the capability config declares no
port, otherwise no-op with a requires-review note; carry `keepAliveTimeout` and the
non-entrypoint loopback default; state the forced emission.

### M22. Root `envfile` → merge into `.env` refuses legal projects and activates keys v3 never read

v3's pre-pass (`runtime/index.js:62-75` → `configuration.js:349-356`) makes
`customEnvFile` **replace** the entire `.env` walk — the root `.env` is never read. So
D20's merge (:1321-1324): (a) `.env` with `DATABASE_URL=…/dev` and
`config/production.env` with `DATABASE_URL=…/prod` — an ordinary dev/prod split that
boots on v3 — is a conflict *error*, i.e. the rule fires fatally on nearly every
project that uses the feature; (b) every `.env` key absent from the envfile was dead in
v3 and becomes live, silently.

**Fix direction:** do not merge — promote the envfile's contents to `.env` and rename
the pre-existing `.env` to `.env.v3-unused`, reporting every key whose v3 value
differed. State the conversion in step 1 and reference it from breaking change 4.

### M23. The `*_URL` no-`requiredEnv` carve-out is worker-only; a `strictEnv` **root** config does throw

`onMissingEnv` is supplied at exactly one site —
`worker/controller.js:145` (`onMissingEnv: this.#context.fetchApplicationUrl`) — i.e.
only when a worker parses an *application* config. The root runtime config loads at
`runtime/index.js:78-86` with no `onMissingEnv`, so an unset key lands in `missingEnv`
and `strictEnv: true` throws (`configuration.js:521-534,562-569`). Root
`"strictEnv": true` with `"telemetry.exporter.options.url": "{OTLP_COLLECTOR_URL}"`
fails hard on v3 and, after migration's `?? ''`, boots silently shipping traces
nowhere.

**Fix direction:** scope the carve-out to **application** config positions; root-config
`*_URL` placeholders under effective `strictEnv` get `requiredEnv` like any other key.

### M24. Step 3's "skips discovery" makes multi-app output unvalidatable

":1358-1362 — the private entry "skips discovery and legacy detection". But validating
multi-app output *requires* discovery: autoload expansion (:696-700) and per-app files
located by filename in each app directory (:702-712). Only the upward **walk** and the
legacy-coexistence guard must be skipped. As written, step 3 validates the root file
and nothing else on exactly the projects where migrate does the most work — and the
contrast drawn against `--config` ("…and every discovered app directory") confirms
per-app discovery is expected.

**Fix direction:** rename the bypass to what it is — "skips the upward walk and the
legacy-coexistence guard, runs the full root+per-app pipeline" — and state that
discovery, autoload expansion, the detector, and version-stamp checks all run.

### M25. Literal strings in typed positions boot on v3 via `coerceTypes: true` and have no migrate rule

v3 validates with `coerceTypes: true` (`basic/lib/config.js:76-80`), and
`server.port` is explicitly `anyOf: [integer, string]`
(`foundation/lib/schema.js:393-395`), so `{ "server": { "port": "3001" } }` and
`{ "workers": "4" }` boot today — inside migrate's declared scope. Step 1's conversion
is described purely in terms of `{PLT_X}` placeholders (:1300-1302), so migrate emits
`port: '3001'` and step 3 fails on its own output under breaking change 16.

**Fix direction:** apply the target-type table to **every** value in a typed position,
placeholder or literal, coercing literals at generation time per the property's exact
v3 rule; say so in step 1 and reference it from breaking change 16.

### M26. The single-app application id loses v3's npm-scope stripping

`wrapInRuntimeConfig` derives the id from `package.json.name` and strips the scope
(`runtime/lib/config.js:132-139`): `@acme/frontend` → `frontend`. ":558-561 says only
"the package name (directory name when absent)", which yields `@acme/frontend` and
changes the mesh hostname, the injected variable name (`PLT__ACME_FRONTEND_URL` under
the documented normalization), the metrics label, and every management-API path.
Migrate's Level 1/1b emission relies on the default.

**Fix direction:** state the scope-stripping rule wherever the default is defined, and
have migrate emit the resolved `id` explicitly — it is observable in `.plt.local`
URLs, injected variables, and ICC payloads.

### M27. Main-side preparation needs the capability *package*, not the `/schema` subpath — and the subpath is not part of any contract

":716-720 imports "a light subpath export, e.g. `@platformatic/next/schema`". But
`prepareApplication` also reads `pkg.skipTelemetryHooks` (`runtime/lib/config.js:254,262`)
— consumed at spawn time to decide the OpenTelemetry `--import` hook
(`runtime.js:2431`), and set by gateway, db, and service
(`gateway/index.js:26`, `db/index.js:27`, `service/index.js:58`) — plus
`pkg.modulesToLoad` (`config.js:268-271`). Neither is a schema property nor in the
envelope, and `skipTelemetryHooks` appears **zero** times in the doc: every
gateway/db/service app silently gains hooks it opts out of today. Separately, breaking
change 15 never *requires* a `/schema` subpath, so the documented `{ module }` escape
hatch is unvalidatable for any package that omits it.

**Fix direction:** either import the full capability package main-side (dropping the
"light subpath" cost framing) or move `skipTelemetryHooks`/`modulesToLoad` into the
schema subpath and the entry envelope; make `<pkg>/schema` a stated part of the v4
contract in item 15, with a defined fallback when absent.

### M28. The removed management endpoints have in-tree consumers the doc does not name — and `--save` cannot work without them

":1101-1103 calls watt-admin `GET /config`'s "only known consumer".
`@platformatic/control` — a published package — implements both removed endpoints
(`control/lib/index.js:246` `/api/v1/config`, `:263`
`/api/v1/applications/:id/config`) and is the client for `wattpm config`,
`applications:add/remove`, and `patch-config`. The plan has no `control` step.
Concretely, `applications:remove --save` reads the **live `autoload.path`**
(`wattpm/lib/commands/applications.js:110-112`:
`getRuntimeConfig(pid, true)` → `resolve(config.__metadata.path, config.autoload.path)`)
to decide the `autoload.exclude` append the doc says `--save` performs (:1145) — and
`GET /metadata` (`runtime.js:1490-1507`) returns none of it.

**Fix direction:** add `control` to the plan and declare its API change; extend
`GET /metadata` with the fields `--save` actually consumes (`root`, `configPath`,
`autoload`), and define what `applications:add`'s on-disk JSON spec file
(`applications.js:44-48`) becomes under item 14.

### M29. The second hot-add path — `management:addApplications` over ITC — is untouched

D24 covered only the HTTP endpoint. `runtime/lib/management-handlers.js:136-146`
registers `addApplications` doing the same `validate` + `prepareApplication` +
`runtime.addApplications`, reachable from any application with `management: true`
(`worker/management.js:57`, wired at `worker/main.js:343-353`) — a public ITC
operation. In v4 the posted worker no longer self-loads, and this path runs no eval
pass, so the worker boots with no `resolvedConfig`.

**Fix direction:** apply the boot eval pass here too and name both paths in items 11
and 14.

### M30. "The capability's namespaced block" is undefined for two in-tree capabilities

Flattening is specified as *the* (singular) namespaced block (:387-392).
`packages/react-router/schema.json` has **two** (`vite` and `reactRouter`, the latter
carrying `outputDirectory` — which would collide with the deliberately-nested
`application.outputDirectory`), and `packages/tanstack/schema.json` has **none** (its
only capability block is `vite`, another package's namespace).
`defineCapabilityFactory(module, schema, mapOptions)` has no parameter for a list.

**Fix direction:** define flattening over a per-capability *list* of blocks, answer
react-router and tanstack explicitly, and add a build-time assertion that the flattened
key set does not collide with the retained shared blocks.

### M31. The detector's capability-first rule strands the out-of-tree capabilities already in the detector table, and has no allowlist

`foundation/lib/module.js:15-43` lists five capability packages that are not in this
repo and not in the plan (`php`, `ai-warp`, `pg-hooks`, `rabbitmq-hooks`,
`kafka-hooks`) plus the `composer`→gateway alias. A `kafka-hooks` app that boots
zero-config on v3 is *detected* by the v4 detector and then rejected by item 15.
Separately, "two `@platformatic/*` dependencies → ambiguity error" needs an explicit
capability allowlist to be safe — `@platformatic/node`'s own generator writes both
`@platformatic/globals` and `@platformatic/node` (`node/lib/generator.js:79-80`) — and
a third-party `@acme/watt-php` can never be detected at all.

**Fix direction:** specify the detector's capability table explicitly (with aliasing),
add the out-of-tree capability repos to the cross-repo step, and state that
non-`@platformatic/*` capabilities always require an explicit config file.

### M32. The remote-apps section attributes `import`'s config writing to `resolve`, and v4 `resolve` has no stated editor

":474-478 says `wattpm resolve`'s "config-writing half" wrote
`{PLT_APPLICATION_X_PATH}` entries plus `.env` lines. `resolveApplications`
(`wattpm-utils/lib/commands/external.js:343-490`) writes nothing to the config — it
computes `application.path` in memory from `resolvedApplicationsBasePath`. The
placeholder + `.env` writing is `wattpm import` (`external.js:238-268`). And if v4
`resolve` now writes literal paths, it must AST-edit `watt.config.ts` — the only AST
mechanism is magicast, restricted to static shapes with a **paste-ready snippet**
fallback (:1180-1185), which is unusable for a command that runs unattended in deploy
pipelines and impossible for `defineConfig(ctx => ({ … }))`.

**Fix direction:** correct the attribution; keep the runtime-side path backfill
(`runtime.js:2357-2361`, which needs no config write) as the v4 mechanism or specify
resolve's editor and its non-static failure mode; add `resolvedApplicationsBasePath`
to Appendix A.

### M33. `managementApi`'s string branch is misclassified as a genuine union — and Appendix A ships the stringly type

The audit keeps "`managementApi`'s socket-path string" (:1062-1064). The socket path is
the *object* property `managementApi.socket` (`foundation/lib/schema.js:1309-1312`),
read as `typeof config === 'object' ? config?.socket : null`
(`runtime/lib/management-api.js:421`) — a bare string is merely truthy and gets the
default socket. The string branch exists for placeholders
(`runtime/lib/generator.js:39` emits `'{PLT_MANAGEMENT_API}'`; the doc's own Appendix B
v3 example is exactly that). Appendix A then carries
`managementApi?: boolean | string | ManagementApiOptions` (:1602) — the very stringly
union goal 3 and :1073 promise to eliminate. Same class as round-7's m14.

**Fix direction:** move it to the placeholder-only bucket, drop the string from
Appendix A, and cite a genuinely socket-shaped example (or only `preload`/`enabled`).

### M34. "This keeps capability imports off the eval worker's path" is false

":862-863. Per-app files exist to call `next(…)`, which imports `@platformatic/next`
inside the eval worker, and `defineCapabilityFactory` lives in `@platformatic/basic`
(:461-463) — so each eval worker loads the capability package, `basic`, the schema
module, and their transitive graph (`next/index.js:1-6` pulls `lib/capability.js`,
`lib/image-optimizer.js`, `@platformatic/globals`, `@platformatic/foundation`). This
invalidates the stated per-file cost model (:821-823) and means the erasable-TS
constraints and the import recorder apply across the whole capability graph.

**Fix direction:** say what is actually true — the *transform* and its worker-only
context stay off the eval path — and either require a light factory entry point
(parallel to `/schema`) or restate the evaluation cost.

---

## Minors to fix directly

- **m1. `fetchApplicationUrl` is `_URL`-suffix-gated**, not key-agnostic:
  `worker/controller.js:31-33` returns `null` unless `key.endsWith('_URL')`. ":1000-1004's
  "regardless of the key name … ignores the key" is wrong as written (it ignores the key
  only in choosing *which app*), and the suffix gate is what makes the migrate carve-out
  well-defined.
- **m2. "Object config sources … never cross a worker boundary"** (:797-800) is false — the
  runtime structured-clones the whole config into every application worker
  (`worker/main.js:85,223`). The main-side check is required, not defense in depth.
- **m3. Level 0 in a directory with no `package.json` now errors** (:655-659); v3's
  zero-config path requires only JS files (`foundation/lib/cli.js:255-261`).
  `mkdir demo && cd demo && wattpm dev` regresses.
- **m4. `port: 0` on the *entrypoint* is contradictory** — bullet 1 routes it through
  address resolution, bullet 3 makes it ephemeral per worker (:637-642), giving N
  unreachable addresses. v3 pins the first bound port for restarts
  (`runtime.js:3263-3270`).
- **m5. `--config` leaves "project root" undefined** — no walk means no boundary, yet the
  boundary defines the env root, the legacy-scan set, and the escape hatch. Same gap in
  migrate's step-3 entry.
- **m6. Detector ambiguity vs. the composer alias** — v3 maps `gateway` and `composer` to
  one type (`foundation/lib/module.js:27-31`); an app carrying both (a mid-rename tree,
  which migrate's dependency edits do not clean up) errors on migrate's own output.
- **m7. A third ladder spelling** at :1526 ("real env > env block > injected > .env")
  collapses the entry/root block and app/root file distinctions the canonical ladder makes
  normative. Reference it instead of restating it.
- **m8. `injectedKeys` is attributed to the wrong protocol** at :1035 — it is in
  `workerData`, not the eval-worker protocol (:763-765 has it right).
- **m9. `ConfigContext.env` is described twice, differently**: "`process.env` after `.env`
  merging" (:371) vs "snapshot, not live `process.env`" (:1642); and :781-783 says mutations
  "still work within the evaluation" while `ctx.env` is frozen. Say: mutations are visible
  through `process.env` only; `ctx.env` is fixed at evaluation start.
- **m10. Hot-added applications get no mesh URL variables** — running workers' env was fixed
  at construction (`runtime.js:2458`) — and the id-normalization collision check is
  boot-only (:1049-1051) while `POST /applications` can introduce a collision.
- **m11. Per-app eval workers post back `env`/`envFileKeys` with no defined consumer**
  (:753-754); only the root worker's is used. Either narrow their payload or define its use.
- **m12. `strictEnv` precedence is stated backwards** at :1293-1294: v3 is
  `strictEnvOption ?? config.strictEnv` (`configuration.js:540`) with the option coming from
  the *root* (`worker/controller.js:99,146`) — the root wins when defined; the app's value
  is the fallback.
- **m13. The `.mts` rule misses the majority case** (:891): a `package.json` with **no**
  `type` field is CommonJS. Restate as "when the nearest `package.json` does not declare
  `"type": "module"`".
- **m14. `{PLT_ROOT}` diverges when the v3 config lived outside the app directory** —
  `PLT_ROOT = dirname(source)` (`configuration.js:502-512`), so
  `{ path: 'web/api', config: '../../configs/api.json' }` gives `<root>/configs`, not the
  app root that `import.meta.dirname` yields.
- **m15. `.wattpm-migrate.json` lifecycle vs. the dirty check** — state whether the manifest
  lists itself, and exclude it from the printed `rm <created…>` undo (deleting it mid-rollback
  strips the rollback's own input).
- **m16. `production: true` under build changes which applications are built** — v3's build
  passes no production flag (`wattpm/lib/commands/build.js:43`), so `enabled` resolves against
  `'development'`. Not in breaking changes.
- **m17. `--env` is still underspecified** (:992-994): no resolution base (v3 uses the config
  root, `configuration.js:352`), no missing-file behavior (v3 throws, `:353-355`), no stated
  interaction with a per-app `envfile`.
- **m18. `GET /metadata` already returns the root as `projectDir`** (`runtime.js:1501`) — say
  whether it is renamed or duplicated by the new `root`.
- **m19. `getApplicationDetails` has no `applications[]`** — it returns a flat object with a
  top-level `config` (`runtime.js:2076-2093`); the DTO wording should name each endpoint's
  actual property.
- **m20. v3 `kMetadata` has no `version`** (`configuration.js:600-606`: `{ root, env, path,
  module }`) — the reconstruction adds one; state it as an extension, not parity. It also
  drops `PLT_ROOT` from `kMetadata.env` (see M8), observable via `GET /applications/:id/env`.
- **m21. Appendix A omissions.** `ApplicationEntry`: `enabled`, `reuseTcpPorts`,
  `restartOnError`, `arguments`, `execArgv`, `sourceMaps`, `nodeModulesSourceMaps`,
  `compileCache`, `management` (load-bearing — the `ManagementClient` gate,
  `worker/main.js:343-353`). `WattConfig`: `exitOnUnhandledErrors`
  (`worker/main.js:205-212`), `applicationTimeout`, `messagingTimeout`,
  `workersRestartDelay`, `reuseTcpPorts`, `server.portAssignment`,
  `resolvedApplicationsBasePath` (directly relied on by the remote-apps section).
  `extensions?: ExtensionEntry[]` is narrower than the schema (`anyOf [string, object,
  array]` — a genuine union by the doc's own `preload` ruling). `config?:
  ApplicationDefinition` cannot express `config: next(cb)`, which the resolution pass exists
  to await, and both factory signatures still declare a bare `ApplicationDefinition` return
  despite the prose at :350-352.

---

## Decisions needed

| # | Finding(s) | Decision | Status |
|---|---|---|---|
| D1 | B1 | Exempt the deciding file's own directory from the standalone claim check | **resolved** — user decision: the claim check fires only when cwd is a *proper descendant* of the root config file's directory; standing at the project root always boots the full runtime |
| D2 | B2 | Define "project root" once (root-config directory vs walk boundary) and reconcile all three passages + breaking change 5 | **resolved** — user decision: the env root is `dirname(rootConfigFile)` (v3 parity); fallbacks — no root config anywhere → boundary directory, `--config` → that file's directory; the boundary stays a search/execution limit only, `:668` "`.env` walk" wording deleted |
| D3 | B3 | Rule on `reuseTcpPorts` / `server.portAssignment`: keep (fix the listen rule + Appendix A) or remove (breaking change + migrate rule) | **resolved** — user decision: both kept verbatim; listen rule gains a fixed-port multi-worker bullet, "fast `EADDRINUSE`" scoped to `reuseTcpPorts: false` / no OS `reusePort`; `reuseTcpPorts` (root + entry) and `server.portAssignment` added to Appendix A; `port: 0` orthogonal, keeps its `useHttp`-replacement meaning |
| D4 | B4 | Move `enabled` filtering into the root eval worker, before fan-out | **resolved** — user decision: `enabled` resolved in the root eval worker right after autoload expansion; disabled entries dropped before per-app workers, capability validation, and the detector; `transform()`'s splice loop removed; `enabled` added to Appendix A |
| D5 | B5 | Add the `NODE_ENV=production` rung and carve it out of build determinism | **resolved** — user decision: kept as the **lowest** rung of both ladders (`NODE_ENV` = `'production'` when `production === true` and no other source set it); not in `injectedKeys`; applies under `start` **and** `build`, with a one-line carve-out in the build-determinism rule |
| D6 | B6 | Define the `exec` path's transform + synthesized `kMetadata` (or pass transformed config) | **resolved** — user decision: `exec` runs the capability transform **main-side** with a synthesized `kMetadata` (`root`, `path: configPath`, `module`, `version`, `env`); `workerData`-derived context stated absent (no `configPatch`, `watch.enabled: false` — already v3 behavior); commands receive **transformed** config, and ":859-862's "transform runs worker-side as in v3" is scoped to boot |
| D7 | B7 | Stop inlining `env`-block/`envfile` values; emit references + requires-review, `--inline-env-blocks` opt-in | **resolved** — user decision: root + entry `env` blocks become **visible to per-app config evaluation** (they are root-lexical and known before fan-out — D10's argument for `envfile`), so the evaluation ladder equals the runtime ladder minus injected URLs; root configs and root-inline entries stay excluded (v3 parity); migrate emits plain `process.env.X ?? ''` for every layer and D14's inlining rule is deleted; `:976-978` revised, standalone asymmetry widened to `env` blocks, build-determinism wording folded into D16 |
| D8 | M1 | Make `envFileKeys` inbound to per-app eval workers; state the apply rule in provenance classes | **resolved** — inbound provenance: the root worker's `envFileKeys` travels to each per-app eval worker; apply rules stated over the provenance classes (real / block / injected / file-sourced); the worker-boot reader adds the app-file keys it applies to its own file-sourced set before the `env` blocks apply. Load-bearing after D7 |
| D9 | M2 | Non-entrypoint `server.port`: restore v3 (no listen) or breaking change + migrate strip | **open** — product call |
| D10 | M3 | Pick the entrypoint server-merge order and present it as a unification, not v3 parity | **resolved** — the written order stands (root `server` → own `server` → defaults), but presented as a **deliberate unification of two divergent v3 paths** (basic-family: app wins, `basic/lib/capability.js:89`; service-family: root wins, `service/lib/capability.js:222`) with a numbered breaking change; the parity claim is deleted and the auto-wrap hoist's exact key set (`hostname, port, http2, https`) is stated |
| D11 | M4 | Specify v4 entrypoint auto-detection; migrate emits it explicitly | **resolved** — specified in the loader section against the v4 data model: single application ⇒ entrypoint; else exactly one app whose **resolved `module`** is `@platformatic/gateway` ⇒ entrypoint; else none (mesh-only boot, `InvalidEntrypointError` only for a *named* missing entrypoint). v3's `!application.config` guard is dropped — capability identity now comes from the eval pass/detector. Migrate emits the resolved `entrypoint` explicitly in the thin root |
| D12 | M5 | `PORT`/3042 default vs v3's deference to the app's own `listen()` | **open** — product call |
| D13 | M6 | Exempt inline-`config` entries from the claim check; rescope "provably identical" | **resolved** — an entry carrying an inline `config` is **exempt from the claim check**: running inside its directory boots the full runtime with a one-line notice, because such an app has no standalone-representable configuration. "Provably identical" is rescoped to name the `envfile` and `env`-block asymmetries |
| D14 | M7 | Warn on every carried `env`-block key + add a runtime suppression diagnostic (covers ICC) | **resolved** — migrate warns for **every** carried-over `env`-block key, not only those colliding with the migration-time environment; plus a runtime boot diagnostic logged once when a worker's `env`-block key is suppressed by the real environment — the only channel machine-generated/ICC configs have |
| D15 | M8 | Keep or remove `PLT_ROOT` as an injected variable; extend the migrate scan | **resolved** — **removed**, consistent with D22. Its only purpose was resolving `{PLT_ROOT}` placeholders; generators already exclude it from written `.env` files (`generators/lib/base-generator.js:243`) and strip it on regeneration (`runtime/lib/generator.js:166`). Breaking change 22; migrate's step-4 source scan extended to `process.env.PLT_ROOT` reads; the worker-side `kMetadata.env` reconstruction omits it deliberately |
| D16 | M9 | Standalone builds: evaluate the ancestor root for `envfile`/withheld-keys, or rescope both claims | **open** — product call |
| D17 | M10 | `envfile` on an inline-`config` entry: error, or runtime-view-only | **resolved** (judgment call) — **error**. An inline entry is evaluated in the root worker and has no per-app eval worker, so `envfile` provably cannot "govern both views" there; silently degrading to one view is the class of quiet asymmetry these rounds keep surfacing |
| D18 | M11 | Couple `--production` to `mode` for `exec` (or drop it) | **resolved** — `--production` implies `mode: 'production'` unless `--mode` is also given, matching the boot verbs; the CI example (`wattpm db:migrations:apply --production`) then selects the production env files as documented |
| D19 | M12 | Reconcile `mode` with `enabled`'s environment keys in the audit | **resolved** — `enabled`'s object form is keyed by **`mode`**, with `production`/`development` remaining the default mode names under `start`/`build` and `dev`. Backward compatible for every existing config, and `enabled: { staging: false }` now works with `--mode staging`. The `mode`/`production`/`enabled` relationship is stated in the context section |
| D20 | M13 | Define `ApplicationEntryOverrides`; force `autoload.mappings` entries for orchestration-carrying apps | **resolved** — `ApplicationEntryOverrides` defined in Appendix A as the orchestration subset of `ApplicationEntry` (minus `config`/`path`), explicitly including `envfile`, `env`, `workers`, `health`, `dependencies`, `enabled`; migrate forces an `autoload.mappings` entry for any app carrying non-default orchestration, even when its capability config is default |
| D21 | M14 | Eval workers always get an explicit `env`; fix the `--inspect-brk` spawn ordering | **resolved** — eval workers are always constructed with an explicit `env` (the computed layered view), never by `process.env` inheritance; in `--inspect-brk` mode the other workers are spawned before the in-process env mutation |
| D22 | M15 | Number the equivalence check step 3b, inside the install transaction, with defined rollback | **resolved** — numbered **step 3b**, after step 2's install and the step-3 load; comparands named explicitly; a mismatch triggers the manifest rollback (created files removed, tracked files restored, lockfile restored), so the install is inside the transaction |
| D23 | M16 | Redefine the comparand (root + per-app, modulo the target-type table, both `production` values) | **resolved** — compare **both** the root config and each application's capability config, post-validate/pre-transform; exclusion list corrected to reachable items (`$schema`, tool-injected `preload`, `watch`, `restartOnError`, `inspectorOptions`, removed properties, `kMetadata`, the deliberate `*_URL` rewrites); equality defined **modulo the audit's per-property target-type table** rather than raw (the two sides validate under different schemas and coercion settings by design); run across both `production` values whenever any app declares `enabled` |
| D24 | M17 | Scope the masked run to non-`requiredEnv` keys; sentinel both sides | **resolved** — the masked second run covers only keys that are **not** `requiredEnv`-wrapped; `requiredEnv` keys are sentinel-injected in both runs, with the sentinel echoed into the v3 side's pinned `env` so both sides agree |
| D25 | M18 | Add the v3→v4 module rename table + a fourth `package.json` edit class | **resolved** — a v3→v4 module rename table joins the vendored closure (`@platformatic/composer` → `@platformatic/gateway`); renamed modules never satisfy the omit-defaults gate on the old name, always force emission of the new factory's file, and get a fourth sanctioned `package.json` edit class (removing the superseded capability dependency). Breaking-change entry for the `@platformatic/composer` package removal |
| D26 | M19 | Narrow the third-party gate, or define a frozen-bundle contribution point | **resolved** — the gate is **narrowed**: any capability outside the vendored closure stops the run with "hand-conversion required", regardless of v4 readiness. Consistent with Goal 6's own scope ("anything that boots on v3 **with in-tree capabilities**"). A frozen-bundle contribution point stays available as a post-4.0 addition |
| D27 | M20 | Handle `module`-identified v3 configs in the module list and the omit-defaults gate | **resolved** — the lexical view's module list is `config.module ?? extractModuleFromSchemaUrl(config)` with `splitModuleFromVersion` applied; a `module`-identified app never satisfies the omit-defaults gate and always gets an emitted `{ module: '…' }` plain-object config |
| D28 | M21 | Specify `useHttp` → `port: 0` when a port already exists; carry the dropped defaults | **resolved** — `useHttp: true` sets `server.port = 0` **only when the capability config declares no port**; otherwise it is a no-op with a requires-review note (v3's own `server` block wins, `basic/lib/capability.js:89`). `keepAliveTimeout: 5000` and the non-entrypoint loopback `hostname: '127.0.0.1'` are carried over; `useHttp` forces per-app-file emission regardless of the omit-defaults gate |
| D29 | M22 | Replace the root-`envfile` merge with a promote-and-rename conversion | **resolved** — no merge. The named file's contents are promoted to the root `.env`, and any pre-existing `.env` is renamed `.env.v3-unused` and reported (v3's `customEnvFile` *replaced* the whole walk, so merging would both error on legal dev/prod splits and activate keys v3 never read). Conversion stated in step 1 and referenced from breaking change 4 |
| D30 | M23 | Scope the `*_URL` `requiredEnv` carve-out to application configs | **resolved** — the carve-out applies to **application** config positions only; root-config `*_URL` placeholders under effective `strictEnv` get `requiredEnv` like any other key (`onMissingEnv` is supplied only in the worker, `worker/controller.js:145`). The `fetchApplicationUrl` parenthetical is corrected — it is `_URL`-suffix-gated (m1) |
| D31 | M24 | Restate step 3's bypass as walk+legacy-guard only; full per-app pipeline runs | **resolved** — the migrator-only entry skips **the upward walk and the legacy-coexistence guard only**; discovery, autoload expansion, per-app evaluation, the detector, capability validation, and the version-stamp check all run |
| D32 | M25 | Apply the target-type table to literals, not only placeholders | **resolved** — the target-type table applies to **every** value in a typed position, placeholder or literal, coercing literals at generation time per the property's exact v3 rule (`"3001"` → `3001`). Stated in step 1 and referenced from breaking change 16 |
| D33 | M26 | State npm-scope stripping; migrate emits the resolved `id` | **resolved** — the scope-stripping rule (`@scope/name` → `name`, `runtime/lib/config.js:132-139`) is stated wherever the package-name default is defined, and migrate emits the resolved `id` explicitly rather than relying on the default |
| D34 | M27 | Decide the main-side import surface (`skipTelemetryHooks`/`modulesToLoad`); make `/schema` contractual | **resolved** — `skipTelemetryHooks` and `modulesToLoad` move into the `<pkg>/schema` subpath's export surface and the entry envelope, so the subpath stays light and carries everything the main process needs; the subpath becomes a stated part of the v4 capability contract (item 15), with a defined fallback when absent |
| D35 | M28 | Add `control` to the plan; extend `GET /metadata` with what `--save` consumes | **resolved** — `@platformatic/control` joins the implementation plan and its API change is declared (it implements both removed endpoints, `control/lib/index.js:246,263`); the "only known consumer" claim is corrected; `GET /metadata` is extended with `root`, `configPath`, and `autoload` — the fields `--save` actually consumes; `applications:add`'s JSON spec file carries orchestration only, with capability config coming from the app's own file or the detector |
| D36 | M29 | Apply the boot eval pass to `management:addApplications`; name both paths | **resolved** — the ITC `addApplications` handler (`management-handlers.js:136-146`) runs the same boot eval pass as `POST /applications`; both paths named in breaking-change items 11 and 14 |
| D37 | M30 | Define multi-block flattening; answer react-router and tanstack | **resolved** — flattening is defined over a **per-capability list** of namespaced blocks: react-router flattens both `vite` and `reactRouter` (no collision — `application` stays nested), tanstack flattens `vite`. `defineCapabilityFactory` takes the block list, and a build-time assertion checks the flattened key set against the retained shared blocks |
| D38 | M31 | Specify the detector's capability table, aliasing, and out-of-tree capabilities | **resolved** — the detector matches an explicit capability table (with `composer` → `gateway` aliasing) rather than a bare `@platformatic/*` prefix, so `@platformatic/globals` and friends cannot trip the ambiguity error; the five out-of-tree capability repos join the cross-repo step; non-`@platformatic/*` capabilities always require an explicit config file |
| D39 | M32 | Fix the resolve/import attribution; specify v4 `resolve`'s config-writing mechanism | **resolved** — attribution corrected (the placeholder + `.env` writing is `wattpm import`, `external.js:238-268`, not `resolve`); v4 `resolve` writes **nothing** to the config and keeps the runtime-side path backfill (`runtime.js:2357-2361`), which needs no AST editing and works unattended; `resolvedApplicationsBasePath` added to Appendix A |
| D40 | M33 | Reclassify `managementApi`'s string branch as placeholder-only | **resolved** — reclassified as placeholder-only (the socket path is the object property `managementApi.socket`, `management-api.js:421`); the string branch is deleted from the schema and from Appendix A, and the audit cites a genuinely socket-shaped example |
| D41 | M34 | Correct the "capability imports off the eval path" claim and the cost model | **resolved** — the claim is corrected to what is true (the *transform* and its worker-only context stay off the eval path; the capability package itself is imported by every per-app eval worker) and the per-file cost model is restated accordingly |

Minors m1–m21: apply directly. Two are settled by decisions above — **m5** (`--config` project root) by D2, and **m1** (`fetchApplicationUrl` is `_URL`-suffix-gated) by D30. Two more take a stated answer: **m4** — `port: 0` on the *entrypoint* means one ephemeral port, reported and pinned for restarts (`runtime.js:3263-3270`), not one per worker; **m16** — `production: true` under build changing which applications are built is declared in breaking change 17.
