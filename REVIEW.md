# Adversarial review of NEW_CONFIG.md — round 7

**Reviewed:** 2026-08-04, against HEAD `2e7517350` on `feat/new-config-proposal`
**Method:** four independent adversarial passes (loading pipeline, environment
model, migration, runtime/ecosystem integration), findings deduplicated and every
source claim re-verified against the current tree. Previously resolved decisions
are not re-litigated; findings target the current text and the round-6
resolutions where the resolution itself is unsound.

---

## Blockers

### B1. The worker env ladder silently inverts v3's `env`-block-over-real-environment precedence — and contradicts its own "applied last" sentence

The worker-runtime ladder says `real environment > entry env block > root env
block > injected > app env files > root env files` and claims it matches "v3's
application order"; three lines later the same paragraph says "the explicit
`env` block, **applied last**, beats injection and is the sanctioned override".
Both cannot be true. v3's actual order
(`packages/runtime/lib/worker/main.js:264-269`): after all env seeding,
`Object.assign(process.env, runtimeConfig.env)` then
`Object.assign(process.env, applicationConfig.env)` — config `env` blocks
**override genuine environment variables**, unconditionally. That is *the* v3
mechanism for pinning a value (`env: { NODE_ENV: 'test' }` beating a container's
`NODE_ENV=production`; ICC-generated configs pinning `DATABASE_URL`).

Under the ladder as written, every such config silently flips behavior at
migration. The inversion appears nowhere in Breaking changes (items 1–17 never
mention env-block precedence) and migrate emits no warning.

**Fix direction:** decide explicitly. Either (a) keep v3 (`env` blocks > real
env) — which also makes "applied last" true, but forces the config-evaluation
and worker ladders to disagree at the top, which must then be stated where the
doc claims "the two ladders agree where they overlap"; or (b) keep
real-env-on-top, delete "applied last", add a numbered breaking change, and have
migrate warn for every `env`-block key present in the real environment.

### B2. The configured-twice check fires on the doc's own canonical forms

"Entries *with* an inline `config` still get a filename-presence check in their
directory: a `watt.config.*` file there triggers the configured-twice error."
But: Level 1 auto-wrap produces an entry whose `path` is the config file's own
directory — which contains a `watt.config.*` file, the deciding file itself.
Every Level 1 project errors. Same for Level 1b (`application: { config:
next(…) }` at the root) and for the machine-generated example (`{ id: 'api',
path: '.', config: { module: '@platformatic/node' } }` — `.` contains the
generated config). The spec's flagship examples violate the spec's own check.

**Fix direction:** exempt the file whose evaluation produced the entry (compare
resolved file identity / entry directory against the deciding config's
directory). Also define the default `path` for an explicit `application`
shorthand entry that declares none — currently specified only for the auto-wrap
case.

### B3. The listen rule never consults the entrypoint's own `server` block — its parallel-standalone remedy is impossible and v3's server hoisting regresses

Round-6's rule: the entrypoint listens "with the root `server` settings when
present, defaults (`PORT`/3042) otherwise" — the entrypoint's *own* config
`server.port` is never consulted (while non-entrypoint apps consult exactly
that). Standalone boot is declared to have "no root `server`", so a
standalone-booted app — which is the entrypoint of its wrapped runtime — always
lands on `PORT`/3042. That kills the doc's own remedy for parallel standalone
dev ("declare a distinct `server.port` per app"): `next({ server: { port: 8080 }
})` booted standalone gets 3042 by bullet 1 and 8080 by the remedy paragraph.

It is also a v3 regression: `wrapInRuntimeConfig`
(`packages/runtime/lib/config.js:147-163`) hoists the capability config's own
`server` `{hostname, port, http2, https}` into the wrapped runtime's root
`server`, and a runtime entrypoint without root `server` falls through to the
capability's own server config (`packages/runtime/lib/worker/main.js:273-283`).
A migrated v3 single-app with `server.port: 8080` regresses to 3042 — not in
Breaking changes.

**Fix direction:** the entrypoint's listen settings resolve as root `server` →
the app definition's own `server` block → defaults (`PORT`/3042); auto-wrap
hoists the definition's `server` block exactly as `wrapInRuntimeConfig` does
today.

### B4. The upgraded view cannot be schema-validated as specified — placeholders in typed positions fail, and validation mutates the "authored" values

The upgraded view is "the lexical data run through the `semgrator` chains and
schema validation with env replacement off and path-fixing disabled, so the
structure is v3-final but the values stay authored". Two problems, both fatal
as written:

- v3 validates **after** `replaceEnv` with `coerceTypes: true`
  (`packages/basic/lib/config.js:76-81`). Typed positions with no string branch
  — `startTimeout: { type: 'number' }`, `workers.static`, `restartOnError:
  anyOf [boolean, number]` (`packages/foundation/lib/schema.js:1112-1129`) —
  boot on v3 with `"{PLT_START_TIMEOUT}"` only because replacement + coercion
  happen first. With replacement off, the token cannot validate: the upgraded
  view fails to build for configs that boot on v3, violating the stated scope.
  (Also: the doc's own audit example lists `restartOnError` among
  placeholder-string unions — it has no string branch.)
- Running the vendored validator at all applies `useDefaults: true` and
  `coerceTypes: true`, injecting defaults and rewriting authored values in
  place — so "the values stay authored" is false, and the "file omitted when it
  would contain only defaults" rule can no longer distinguish
  authored-equal-to-default from injected.

**Fix direction:** validate a token-masked clone (each placeholder replaced by
a type-appropriate sentinel from the audit's target-type table), with
`useDefaults: false`, and discard it; generation keeps reading the unmutated
token-bearing view. Or skip upgraded-view validation entirely and validate only
the resolved view.

### B5. Migrate's omit-defaults rule loses capability identity for `$schema`-only apps — the detector then picks the wrong capability or none

In v3 the per-app `$schema` URL is the sole capability authority, and the
runtime-bundled fallback (`packages/foundation/lib/configuration.js:615-623`)
means an app's `package.json` routinely contains **no** `@platformatic/*`
dependency at all (defaults-only gateway/service apps are the canonical case).
Migrate as specified: defaults-only config → per-app file omitted → no factory
emitted → step 2 adds dependencies only for "every **emitted factory**" → no
capability dependency added. First v4 boot: the detector finds no capability
dep; a gateway app silently fails detection — or becomes `@platformatic/node`
or `@platformatic/vite` if unrelated framework deps exist (the exact silent-
switch hazard the detector was redesigned to kill, reintroduced by migrate).
Variant: an app with two stale `@platformatic/*` deps trips the detector's
ambiguity error on a tree migrate itself produced — at step 3, after emission.

**Fix direction:** migrate must make the detector's answer provable for every
app it touches: omit a per-app file only when exactly one app-local capability
dependency exists and equals the `$schema` module; otherwise add the capability
dependency in step 2 (cheap, placement-preserving) or emit the file.

---

## Majors

### M1. The version-stamp check replicates the wrong resolution order — and the main-side schema import has no defined resolution context

The stamp check "replicates `importCapabilityPackage`'s real order — regular
import from the runtime context first, app-scoped resolution as the fallback".
But v3 workers for *configured* apps (the case factories replace) resolve via
`loadConfigurationModule` (`packages/foundation/lib/configuration.js:615-623`):
**app-scoped first, runtime-bundled fallback** — the opposite order;
`importCapabilityPackage` (`packages/basic/lib/modules.js:22-50`) is only
reached through the no-config path. The doc even states the app-first order
itself ("workers loading the capability from the app's deps, with the
runtime-bundled fallback — unchanged"). Consequence: pnpm strict, root
`next@4.1` + app `next@4.0` — the check resolves 4.1, matches the 4.1 stamp,
reports nothing; the worker loads 4.0. The exact skew the stamp exists to catch
stays silent; the mirror layout produces a spurious error.

Relatedly, "imported via a light subpath export (`@platformatic/next/schema`)"
never says from *which* context the main process resolves the schema. Under
pnpm strict the per-app style guarantees the capability is **not** root-
resolvable; a runtime-context import fails or resolves a different copy than
the worker's, validating a 4.0 config against a 4.1 schema (and with
`additionalProperties: false` a 4.0 schema *rejects* a 4.1-only option — the
doc's "silently ignored" motivation is also wrong for that path).

**Fix direction:** define one canonical v4 capability resolution order —
app-scoped first, runtime-bundled fallback, matching what configured-app
workers do today — and define the worker import, the stamp check, and the
schema-subpath import against it.

### M2. `envFileKeys` provenance cannot implement the injected-URL rungs — a stale app-file `PLT_*_URL` line beats the injected mesh URL

Root `.env` has `PLT_API_URL=http://localhost:3001` (exactly what v3 generators
wrote); the app's `.env` has the same stale line. The key is file-sourced → it
is in `envFileKeys`; it is not in the real environment → the runtime injects
the mesh URL into the seeded worker env. At worker boot the app-file rule
(`worker/main.js:250-259`: apply when absent **or file-sourced**) fires and the
stale app-file line overwrites the *injected* value. The ladder rung `injected
> app env files` is violated in precisely the legacy case the doc calls
"structurally harmless". Second gap, same cause: for `entry env block >
injected` and `real env > entry env block` to both hold, the worker must
distinguish injected keys from real-env keys — but injected keys sit in the
seeded env and not in `envFileKeys`, indistinguishable from real env. The
ladder is unimplementable with the only provenance channel the doc defines.

**Fix direction:** injection updates provenance — remove injected keys from
`envFileKeys` and pass an explicit `injectedKeys` list in `workerData`; specify
worker-boot application order in terms of the three provenance classes.

### M3. `kMetadata` never reaches the worker, but worker-side capability code depends on it — reconstruction is unspecified

v4 workers receive `resolvedConfig` as plain data over structured clone —
symbol keys drop silently — and the worker-side config loading that used to
attach `kMetadata` is deleted. But worker-side consumers are real: db's
transform resolves the sqlite path from `config[kMetadata].root`
(`packages/db/lib/config.js:15`), `getApplicationEnv()` returns
`config[kMetadata].env` (`packages/basic/lib/capability.js:351-356`), the
gateway's request-time `replaceEnv` reads `config[kMetadata].env`
(`packages/gateway/lib/capability.js:108`), service's sandbox wrapper uses
`kMetadata.root`. As specified, the capability transform crashes or resolves
paths against `undefined`.

**Fix direction:** specify worker-side `kMetadata` reconstruction from
`workerData` (`root` = app path, `path` = `configPath`, `module`/`version` from
the envelope, `env` = the worker's seeded environment) as part of the worker
boot protocol, before the capability transform runs.

### M4. `useHttp` vanishes without a replacement — gateway WebSocket proxying and multi-worker internal listeners break

`useHttp` is user-facing v3 schema (`packages/foundation/lib/schema.js:895`)
and load-bearing: the gateway instructs users to set it for WebSocket upstreams
(`packages/gateway/lib/errors.js:28`), and mechanically it makes **each
worker** listen on an ephemeral loopback port (`worker/main.js:277-283`,
`port: 0`). The v4 listen rule's only non-entrypoint listener is "its own
`server` block sets a port" — one fixed port; with `workers: 4` and no port
search, worker 2 dies on `EADDRINUSE`. There is no way to express "ephemeral
port per worker" in the v4 spec, and migrate has no mapping for
`useHttp: true`.

**Fix direction:** keep `useHttp` (or an equivalent `listen: 'ephemeral'`
entry option) as a third listener class in the rule and Appendix A, with an
explicit migrate mapping.

### M5. `envfile` semantics: contradicts "config-time and runtime env agree by construction", has an unspecified resolution base (v3's is the runtime root), and inherits silent-missing behavior

(1) An entry with `envfile: 'custom.env'` (`REDIS_URL=b`) whose directory also
has `.env` (`REDIS_URL=a`): the per-app config evaluates under the four-file
set (bakes `a`), the worker runs under the envfile (`b`) — the two views
disagree on the file layer itself, which the mode paragraph promises "cannot
happen by construction". (2) v3 resolves `envfile` against the **runtime
root**, not the app directory (`worker/main.js:236-239` with
`dirname: this.#root`, `runtime.js:2512`); the doc's "v3's
replace-the-default-path behavior, extended to the set" names no base, and the
natural app-relative reading silently points at a different file. (3) v3
silently ignores a missing envfile (`worker/main.js:260-262`) — carried over,
an explicitly named missing file yields an app with no env and no diagnostic.

**Fix direction:** decide whether `envfile` also governs that app's config
evaluation (it is knowable before per-app eval workers spawn) or scope the
agree-by-construction claim; fix the base app-relative with a migrate rewrite
of v3 root-relative paths; make a missing explicit envfile a boot error.

### M6. Two conflicting definitions of the per-app evaluation environment (intermediate directories)

"Its own directory's env files layered over **everything found walking up to
the workspace boundary**" vs "app env files **over the root view**" — and both
ladders list exactly two file rungs. Monorepo `root/web/frontend` with
`web/.env` setting `SHARED_KEY`: visible under the walk definition, invisible
under the two-rung definition. Additionally the worker-boot reader's file set
and `envFileKeys` (computed from the root walk) are silent about keys sourced
below the root, so config evaluation and worker runtime can disagree on them.

**Fix direction:** define layering as per-directory four-file blocks along the
walk, nearest directory wins; state where intermediate directories sit in both
ladders; state that the worker-boot reader re-walks from the app directory
with the `workerData` mode, and how `envFileKeys` covers below-root keys.

### M7. The walk boundary is defeated by any ancestor git repository — the `$HOME`-dotfiles case executes `~/watt.config.ts`

`$HOME` as a dotfiles git repo (`~/.git` — common) plus a scratch project
`~/work/demo` with `package.json` but no `.git`/workspace marker and no config
file: the walk finds no marker until `~`, so the boundary is `~`, checked
inclusively — a stray `~/watt.config.ts` is executed and `~/.env*` loaded. The
nearest-`package.json` fallback never engages because it applies only "when no
such marker exists anywhere up the tree". The "structurally unreachable"
invariant fails in exactly the scenario it names. (Also unstated: the fallback
requires a full ancestor scan before deciding — the walk cannot be
stop-at-first-marker.)

**Fix direction:** never execute a config found above the topmost contiguous
`package.json` chain from cwd (a package-less gap between cwd's package and a
candidate disqualifies it), or restate the invariant as best-effort.

### M8. `ConfigContext` is undefined for capability CLI command evaluation

`command` is a closed `'dev' | 'build' | 'start'` union and `mode` defaults are
defined only for those verbs — but capability commands (`db:migrations:apply`,
`db:seed`) receive "the app's resolved raw config from the eval pass",
evaluated lazily. Every function-form config and factory callback then runs
with a context whose `command` has no legal value, and *which env files load*
during `db:seed` is unspecified — a mode-conditional connection string could
run migrations against the wrong database.

**Fix direction:** specify the context for non-boot evaluations (e.g.
`start` semantics with `--mode`/`--production` accepted, or extend the union)
and the env-file set they select.

### M9. v3 resolved app-config placeholders against `env` blocks and `envfile` — v4 config evaluation excludes both, so migrated expressions silently change value

In v3 the worker applies envfile/`.env`, then `runtimeConfig.env`, then
`applicationConfig.env` into `process.env` **before** the controller parses the
app's config (`worker/main.js:235-269` → `controller.js:144-147`) — so `{FOO}`
in an app config resolved against the `env` blocks. Root config `env: {
LOG_LEVEL: 'debug' }` + app `"logger": { "level": "{LOG_LEVEL}" }`: migrate
emits `process.env.LOG_LEVEL ?? ''` into a per-app file whose eval worker
excludes `env` blocks by design → `''`. The "No `.env` conflict warning is
needed" claim is false for this class.

**Fix direction:** at generation time, resolve placeholders against the
lexically-known `env`-block layer (inline the value or emit the reference plus
a matching note) and treat root/app `envfile` contents the same way.

### M10. The equivalence check has no defined comparison semantics and no buildable comparand — the vendored closure omits the machinery the v3 side needs

"Loading as production v3" for any wrapped/multi-app project requires
`runtime/lib/config.js` — `wrapInRuntimeConfig`, the runtime transform with
autoload `readdir` expansion, entrypoint auto-detection, `prepareApplication`
(which **imports the project's installed capability packages**) — plus
`autoDetectPprofCapture` (`config.js:110-128`), which injects an absolute path
from the *running tool's own* `node_modules` (the npx cache) into
`config.preload`; and the base capability transform reads `workerData`
(undefined in the migrate process), so `watch.enabled` computes differently
than in a real worker. None of this is in the closure list. The resolved views
therefore differ on every project (pprof preload paths, watch, the deliberate
`*_URL` rewrites), and the doc defines neither the comparand (pre- vs
post-transform, which mode, which env) nor the on-mismatch behavior.

**Fix direction:** define the check as per-app deep-equality of **validated
pre-transform** configs under a pinned `{ production, env }` context with an
explicit exclusion list (injected preloads, watch, `*_URL` rewrites,
`kMetadata`); vendor the runtime config machinery (or state the resolved view
reimplements it) with a module→frozen-transform map so no project-installed v3
package is ever imported.

### M11. `strictEnv` projects cannot complete migration in any environment missing a referenced variable

Building the resolved view under `strictEnv: true` with an unset variable
throws `MissingEnvVariablesError` (`foundation/lib/configuration.js:562-568`);
if suppressed, step-3 validation *executes* the emitted `requiredEnv('TOKEN')`,
which throws by design. A project referencing `DATABASE_URL` (a production
secret, unset on the laptop running the codemod) cannot migrate anywhere except
a production-like environment — exactly where codemods don't run.

**Fix direction:** build the resolved view with `strictEnv` forced to `'warn'`;
run step-3 validation with recorded sentinel values injected for
`requiredEnv`-wrapped keys; report the required-variable list instead of
throwing.

### M12. Semgrator chains branch on resolved values — the upgraded view diverges from production for placeholder-carrying v1/v2 configs

`runtime/lib/versions/v2.0.0.js`: `if (config.hotReload)` — on the lexical
token `"{PLT_HOT_RELOAD}"` always truthy, while production truthiness depends
on the env (unset → `''` → falsy). `service/lib/versions/0.28.0.js`:
`config.watch = typeof config.watch === 'object' ? config.watch : true` —
**overwrites a placeholder token with literal `true`**, destroying the authored
expression the lexical pipeline exists to preserve. `runtime/lib/versions/
v3.0.0.js`: `typeof gracefulShutdown.service === 'number'` never migrates a
placeholder string. The upgraded view can carry structures production never
had.

**Fix direction:** run each chain twice — token view and resolved clone — and
flag any site where the runs took different branches as requires-review rather
than trusting the token-view output.

### M13. Per-capability `replaceEnvIgnore` lists live outside the vendored closure — migrate corrupts OpenAPI route templates

`packages/db/index.js:16`: `replaceEnvIgnore: ['$.db.openapi.ignoreRoutes']` —
in the capability's entry point, not its schema or transform (the two things
the closure vendors). The `{identifier}` pattern matches `/users/{id}`, so
migrate's unconditional placeholder conversion emits
`` `/users/${process.env.id ?? ''}` `` → `/users/` — the ignore rule silently
stops matching.

**Fix direction:** vendor the per-capability `replaceEnvIgnore` JSON-path lists
into the generation table and emit ignored positions as literals.

### M14. Same-directory root+app layouts have no representable output

v3 supports `applications: [{ id: 'x', path: '.', config:
'platformatic.application.json' }]` — a runtime config plus an app rooted in
the same directory (`runtime/lib/config.js:236-238`). Migrate's two emission
branches would write a thin root *and* a per-app file into the same directory —
two v4 candidates, which the loader now rejects as ambiguous, and no single
export can carry both classifications. Step-3 validation fails on migrate's own
output.

**Fix direction:** when an app's directory coincides with the root (or any
directory already owning the root file), emit that app **root-inline**
(`applications[].config: factory(…)`) — resolvable by definition since the
app's deps live at that root — as a documented exception to the per-app style.

### M15. Root `envfile` conversion is claimed by Breaking change 4 but never specified — and no faithful v4 target exists

v3 reads root `config.envfile` in an unvalidated pre-pass and feeds it as the
custom env file, **replacing** the `.env` upward walk
(`runtime/index.js:62-75`). Breaking change 4 says migrate "converts" it; steps
1–5 never mention it. v4 has no root-level equivalent (only the `--env` CLI
flag, which cannot live in a config file). A project with `"envfile":
"config/production.env"` migrates and its variables are simply never loaded —
and every emitted `?? ''` quietly swallows exactly this.

**Fix direction:** specify the conversion — merge the named file's entries into
`.env` (erroring on conflicts) or emit per-app `envfile` properties on every
application — with an explicit warning.

### M16. The `--no-install` two-phase flow always trips the dirty-tree refusal, and the manifest's persistence is undefined

Phase 1 necessarily leaves the tree dirty (untracked `watt.config.ts` files,
edited manifests); the mandated re-run then hits "refuses to run on a dirty git
tree", forcing every `--no-install` user through `--force` — the flag framed
as a dangerous override. The alternative — exempting manifest-listed changes —
requires the manifest to be a persisted on-disk artifact with a defined path
and lifecycle, which is unspecified; so is whether the re-run regenerates files
(clobbering user edits made between phases).

**Fix direction:** define a persisted manifest (e.g. `.wattpm-migrate.json`)
and a `--resume` mode that exempts exactly the manifest's entries from the
dirty check and skips regeneration for unmodified emitted files; delete the
manifest on completion.

### M17. v3-injected `PLT_DEV` / `PLT_ENVIRONMENT` are unaccounted for

v3 sets `PLT_DEV` and `PLT_ENVIRONMENT` into every worker's seeded environment
(`runtime/lib/runtime.js:307-313`), and v3 generators emitted code referencing
`PLT_ENVIRONMENT`. The v4 doc's only statement about injected mode variables is
"no `PLT_MODE`"; these two have no ladder rung, no migrate rule, no
breaking-change entry. App code branching on `PLT_ENVIRONMENT === 'production'`
silently changes behavior after migration — or the variables survive with an
undefined position and build-determinism ruling.

**Fix direction:** decide — keep them (ladder position next to `PLT_<ID>_URL`,
same skip-when-real-env rule, defined build-time value) or remove them
(breaking-change entry plus a migrate source-scan warning like the legacy
config-file-reference scan).

### M18. "A v3 build that read an `env` block value breaks loudly at build time" — nothing makes it loud

v3 builds run through normally-spawned workers (`runtime.js:918-930` sends
`build` via ITC), so the `env` blocks were applied before building. v4 builds
omit them; `process.env.NEXT_PUBLIC_API_BASE` becomes `undefined` and Next
silently bakes an empty value into client bundles. Nothing breaks loudly; the
artifact is wrong. (The determinism decision stands; the *loudness claim* is
false.)

**Fix direction:** add a real mechanism — at build, warn with the list of
root/entry `env`-block keys being withheld from the build environment — or
delete "breaks loudly" and document the silent-divergence hazard in the
migration guide.

### M19. "`POST /applications` — which no ruling touches" is contradicted by the v4 worker-boot protocol

v3 hot-add validates entries main-side and relies on the worker self-loading
its config file at boot (`runtime/lib/management-api.js:150-177`,
`worker/controller.js:134-153`) — the exact machinery v4 deletes. In v4 the
endpoint must run the per-app discovery/eval pipeline (env layering, legacy
detection, classification, capability validation, detector) at POST time —
none specified — and the request body's `ApplicationEntry.config` type change
is an undeclared management-API contract break for the same ICC/watt-extra
consumers.

**Fix direction:** specify that `POST /applications` runs the same per-app
eval/validation pass as boot (errors surfaced over HTTP) and declare the
request-payload type change alongside the DTO change in breaking change 14.

### M20. The zero-config detector has no terminal rule for a bare Node repo — the Level 0 promise is unsatisfiable as specified

A plain Express repo (no `@platformatic/*` dep, no framework dep) matches no
detector rule. v3 boots it only via `detectApplicationType`'s final
`hasJavascriptFiles(root)` → `@platformatic/node` step
(`foundation/lib/module.js:161-165`), which the v4 text never carries over
("skipped `@platformatic/node` entirely" is true only of the dependency list,
not the detector). Same gap for autoloaded subdirectories with no
`package.json` at all.

**Fix direction:** keep the has-JS-files → `@platformatic/node` inference as
the detector's explicit terminal rule (distinct from the removed `basic`
trampoline), correct the v3 description, and state what happens on an empty
directory.

---

## Minor contradictions to fix directly

- **m1. Async callback desugaring:** `next(cb)` → `ctx => next(cb(ctx))` passes
  a Promise as factory options for the async callbacks the same paragraph
  allows. Desugar to `async ctx => next(await cb(ctx))`; acknowledge the
  return-type widening of the callback overload (the signature claims
  `ApplicationDefinition` but the callback form returns a function).
- **m2. Rule count and recursion:** "Classification is three unconditional
  rules" is followed by four; and rule 1's resolved value being itself a
  function (function returning a function) is unhandled — define it as an
  error.
- **m3. `--debug-config --inspect-brk`:** unstated what is printed in
  single-file in-process mode (other files still evaluate in workers?) and
  whether the 30 s eval deadline is suspended — as written it kills a paused
  breakpoint session.
- **m4. "Stops before modifying any file"** for third-party capabilities
  contradicts the step ordering: step 1 emits files before step 2's audit runs.
  Hoist the audit ahead of emission — it needs only the lexical view's module
  list.
- **m5. Untracked legacy configs:** a gitignored `platformatic.json` (or the
  v3 auto-written `watt.json`) is deleted unrecoverably by step 5 —
  `git restore` cannot bring back untracked files. Define "dirty" to include
  untracked legacy candidates, or exclude untracked legacy files from deletion
  and list them for manual cleanup.
- **m6. Boolean coercion is per-property:** v3's string→boolean rules differ by
  site (`enabled !== 'false'` → unset keeps the app;
  `watch === 'true'` → unset is false; `config.watch || false`). One generic
  "boolean test" emission silently drops apps
  (`"enabled": "{PLT_API_ENABLED}"` unset: v3 keeps, v4 drops). The audit table
  must record each property's exact rule; optionally run the equivalence check
  a second time with referenced variables masked to unset.
- **m7. `requiredEnv` inverts v3 for non-app-id `*_URL` keys under strictEnv:**
  unset `*_URL` keys resolve via `fetchApplicationUrl`'s fallback and land in
  `fallbackEnv`, which warns and never throws
  (`configuration.js:520-560`) — emitting `requiredEnv` makes a
  booting project refuse to boot. Also "effective strictEnv" per app file must
  implement the root-config precedence (`strictEnvOption ?? config.strictEnv`).
- **m8. Breaking change 5 omits the narrower walk:** v3's `.env` walk reached
  the filesystem root with a cwd fallback
  (`configuration.js:358-381`); v4's boundary stop drops files v3 loaded.
- **m9. `--env` flag:** appears once as an escape hatch; its rung, mode
  interaction, and evaluation-vs-runtime scope are undefined.
- **m10. Self-URL injection:** "one per **sibling** application" excludes the
  app's own `PLT_<SELF>_URL`; v3 code reading its own URL exists (generators
  wrote the lines). Simplest: inject for every application including self.
- **m11. magicast placement:** `--save` lives in `wattpm`, but magicast is "a
  dependency of `wattpm-utils` only" and `wattpm` does not depend on
  `wattpm-utils`. State where the AST editing actually runs.
- **m12. Appendix A:** `version` must be optional on `ApplicationDefinition` —
  the documented hand-written `{ module }` escape hatch and the
  machine-generated plain-object form fail the type as written.
- **m13. Goal 7** says `getRuntimeConfig` is "preserved with identical
  semantics" while breaking change 14 declares its payload a breaking DTO
  change. Reword: patch semantics preserved; payload shape changes.
- **m14. Audit inventory nits:** `overridableValue` has 13 call sites, not 14
  (the 14th occurrence is the definition); `restartOnError` has no
  placeholder-string branch and must leave the audit example list (see B4).

---

## Decisions needed

| # | Finding(s) | Decision | Status |
|---|---|---|---|
| D1 | B1 | Choose worker env-block precedence: v3 (`env` blocks > real env) or inversion + breaking-change entry + migrate warning | open |
| D2 | B2 | Exempt the deciding file from the configured-twice check; define the shorthand entry's default `path` | open |
| D3 | B3 | Entrypoint listen resolution: root `server` → own `server` block → defaults; auto-wrap hoists the definition's `server` (v3 semantics) | open |
| D4 | B4 | Redefine upgraded-view validation (token-masked sentinel clone, `useDefaults: false`) | open |
| D5 | B5 | Gate migrate's file omission on provable detector reconstruction; add capability deps for `$schema`-only apps | open |
| D6 | M1 | One canonical capability resolution order (app-first + bundled fallback) for worker import, stamp check, and schema import | open |
| D7 | M2 | Add injected-keys provenance (`injectedKeys` in `workerData`; strip from `envFileKeys`) | open |
| D8 | M3 | Specify worker-side `kMetadata` reconstruction in the boot protocol | open |
| D9 | M4 | Keep `useHttp` / add an ephemeral-listener class + migrate mapping | open |
| D10 | M5 | Define `envfile` scope (evaluation too?), base (app-relative + migrate rewrite), and missing-file error | open |
| D11 | M6 | Define intermediate-directory env layering in both ladders and the worker-boot re-walk | open |
| D12 | M7 | Bound the walk by the topmost contiguous `package.json` chain (or downgrade the invariant) | open |
| D13 | M8 | Define `ConfigContext`/env-file selection for capability-command evaluation | open |
| D14 | M9 | Resolve placeholders against `env`-block/envfile layers at generation time | open |
| D15 | M10 | Specify the equivalence-check comparand, exclusion list, and extended closure | open |
| D16 | M11 | Make strictEnv migration runnable without a production env (warn-mode view, sentinel validation) | open |
| D17 | M12 | Dual-run semgrator chains; flag branch divergence as requires-review | open |
| D18 | M13 | Vendor `replaceEnvIgnore` JSON-path lists into the generation table | open |
| D19 | M14 | Root-inline emission exception for same-directory apps | open |
| D20 | M15 | Specify root `envfile` conversion | open |
| D21 | M16 | Persisted manifest + `--resume` semantics for the two-phase flow | open |
| D22 | M17 | Keep or remove `PLT_DEV`/`PLT_ENVIRONMENT` | open |
| D23 | M18 | Build-time withheld-env warning, or delete "breaks loudly" | open |
| D24 | M19 | Specify `POST /applications` eval pass; declare the request-payload change | open |
| D25 | M20 | Restore the has-JS-files → `@platformatic/node` terminal detector rule | open |
