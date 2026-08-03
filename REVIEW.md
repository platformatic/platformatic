# Adversarial review of NEW_CONFIG.md — round 4

**Reviewed:** 2026-08-01, against HEAD `218b84d69` on `feat/new-config-proposal`
**Method:** round 4 attacks the round-3 resolutions (package-local commands,
standalone boot, env layering, mode, classification, version stamp, migrate rename)
plus new holes they opened. Previous rounds' resolved findings were not re-reported.
All code references verified.

Resolution status is tracked in the **Decisions needed** table at the end. Minors and
nits are fixed directly in the proposal without a decision round.

---

## Blockers

### B1. The flagship `turbo run dev` scenario is broken by the proposal's own port spec, and standalone gateways are broken by design

**Claim:** per-app scripts are scaffolded as `wattpm dev`, "`turbo run dev` composes
as N independent standalone apps", and "the wrapped single-app runtime uses the
runtime defaults (server port from `PORT`/3042, the app as entrypoint)".

**Problem 1 — port collision.** Every standalone-wrapped runtime defaults to the
*same* port. N apps under `turbo run dev` means N wrapped runtimes each trying to
bind `PORT`/3042; the first wins, the other N−1 die with `EADDRINUSE`. v3 never had
this problem because only one process — the runtime — listened, with exactly one
entrypoint (`packages/runtime/lib/worker/main.js:273-283`: only the entrypoint gets
`runtimeConfig.server`; non-entrypoint HTTP apps get `port: 0`). There is no per-app
port assignment story (no port-search, no `PORT` offsetting, nothing). As specified,
the scaffolded default experience in any multi-frontend monorepo fails on the second
app.

**Problem 2 — the nearest app-def can be a gateway.** The uniform rule means
`cd web/gateway && wattpm dev` — or the gateway's scaffolded `dev` script under
`turbo run dev` — boots a gateway standalone. A gateway app-def's config enumerates
sibling ids; at boot the gateway resolves each to `http://<id>.plt.local` and
composes by fetching their OpenAPI/GraphQL schemas
(`packages/gateway/lib/application.js:149-151`, `FailedToFetchOpenAPISchemaError`).
Standalone, the mesh contains only the gateway: composition fails or produces a
proxy shell where every route 502s. The generic "siblings unavailable" warning
treats as degraded-but-useful something that is, for a gateway, categorically
useless. The proposal never addresses the capability class whose *entire
configuration is references to siblings*.

**Fix direction:** a per-app dev port story (port search, `server.port` in the
app-def, or refuse-with-hint on collision) is a precondition for advertising the
turbo composition; gateway (and any capability declaring sibling dependencies)
needs an explicit standalone rule.

### B2. The migrate flow contradicts the legacy-detection rule — one of three mutually exclusive readings must hold, and each breaks something stated elsewhere

**Claims:**
- Legacy detection fires "when no `watt.config.*` is found".
- Migrate step 3: validate the generated config "through the real v4 loader … the
  input files are untouched until the output provably works" — i.e. validation runs
  **while all legacy files are still on disk** (rename is step 5).
- Migrate step 1: per-app files are "omitted when [they] would contain only
  defaults".
- `--keep`: legacy files left in place ⇒ "the project then won't boot until they're
  removed manually".

These cannot all be true:

1. **If detection is only the stated rule** (skip when a `watt.config.*` exists),
   the `--keep` "won't boot" sentence is false — and worse: an app dir where
   migrate *omitted* the per-app file but a legacy `watt.json` remains boots the
   app **with pure defaults, silently ignoring its v3 config** — the exact "worse
   than any hard failure" scenario detection exists to prevent. The `--keep` +
   default-only-app state produces this *by design*.
2. **If detection also fires per-app-directory**, migrate's step-3 validation —
   before the step-5 rename, legacy files present — fails for any project
   containing a default-only app, so the default path never reaches cleanup on
   precisely the projects the omission optimization targets.
3. **If detection fires whenever any legacy candidate exists anywhere**, step-3
   validation fails for *every* project; validate-before-cleanup is impossible.

**Fix direction:** always emit per-app files, define legacy detection
per-directory, and give the validation loader an explicit ignore-legacy flag.

---

## Majors

### M1. Serial per-app env windows share one ESM module cache — cross-app (and root→app) env contamination is unaddressed

All per-app imports happen in **one worker with one module cache**. Any module
imported by more than one config file executes exactly once, inside whichever env
window comes first, and its exports are cached:

```ts
// shared/env.ts
export const redisUrl = process.env.REDIS_URL   // runs once, under the FIRST importer's window
```

If `web/a/watt.config.ts` and `web/b/watt.config.ts` both import it, app B silently
receives app A's `REDIS_URL`; if the root config imports it, both apps receive the
root window's value. Order-dependent (autoload iteration order), silent, and it
contradicts "evaluates with their app's environment … exactly as a frontend
developer expects" — appearing precisely in the shared-helper pattern code-first
config advertises. The mutation-diff warning covers writes, not read-side cache
contamination. Options (one eval worker per app dir; "read env only inside the
exported function" as documented contract; freezing/proxying `process.env` between
windows) — the proposal chooses none.

### M2. App-level `.env.<mode>` files vs "mode is config-time only": the worker-boot half is unspecified and contradictory

Workers re-read app env files at boot (v3: exactly **one** file,
`worker/main.js:235-257`). If app directories now recognize `.env.staging`, the
worker-boot reader must know which mode's files to load — but the proposal never
says the worker learns `mode`, never updates the worker-side file set, and never
reconciles this with "config-time only". Either mode reaches workers (contradicting
the framing; plumbing unstated) or workers keep loading only `.env` — making
`web/frontend/.env.staging` affect config evaluation but not runtime
`process.env`: the same key, two values, the exact invisible-env class the
proposal exists to kill. Related: `wattpm start` (mode=production) after
`wattpm build --mode staging` evaluates under a different file set than the build
did — deserves a sentence.

### M3. Classification-by-execution vs env loading is a chicken-and-egg; per-app evaluation env is invocation-dependent

1. **Ordering:** "the eval worker resolves the root, runs `loadEnv` … then
   imports" — but resolving the root *is* the walk, which classifies by executing
   the nearest file. As written, that execution happens **before** `loadEnv`, so
   the deciding file runs with an unmerged `env` context, and the classification
   cache guarantees it is *not* re-executed afterwards. The consistent order (find
   nearest by filename → `loadEnv` upward from its directory → execute) is not
   stated.
2. **"The `.env` upward walk is unchanged" is false:** v3's walk
   (`foundation/lib/configuration.js:358-380`) finds the **first** `.env` upward
   and uses only that file — no layering, no `.local`, no mode variants. It cannot
   deliver "the root `.env` still reaches the app's environment" nor coexist with
   the Env-files section's layered model. Which governs standalone boot?
3. **Invocation-dependent env:** under root boot a per-app file evaluates with app
   files layered over the root view; under standalone boot there is no root view —
   a key present only in `root/.env` is visible or absent depending on `cwd`. The
   "identical expression moves unchanged" pitch is silent about this.

### M4. The version-stamp check compares against a resolution path the worker doesn't actually use

Worker-side capability import (`packages/basic/lib/modules.js:22-37`,
`importCapabilityPackage`) tries a **regular `import(pkg)` first** — resolution
from `basic`'s own (hoisted/runtime) context — and scopes to the app directory only
on failure. "The worker resolves from the app's copy" is not how v3 resolution
works, and the proposal says runtime resolution is unchanged.

- *False positive:* hoisted npm layout, root `next@4.1` hoisted, app-nested
  `next@4.0`: the regular import finds 4.1 — the same copy the factory used;
  behavior is consistent — yet the check compares 4.1 vs app-resolved 4.0 and
  fails the boot.
- *Undefined:* single-app repo, capability only in the root manifest, `path: '.'`:
  when app-scoped resolution fails, what does the check compare? The
  runtime-bundled/hoisted fallback is never mentioned in the check's definition.

Also: same major+**minor** rejects the common mid-upgrade transient state; patch
drift is the only benign dedup pnpm actually produces, minor drift is what a
routine single-package upgrade creates.

### M5. Package-local `build` and `start` silently change CI/deploy semantics; standalone builds produce divergent artifacts

v3 `wattpm build` from *any* directory builds **all** applications
(`build.js` → `findRuntimeConfigurationFile` climbs to the root —
`foundation/lib/cli.js:224-229` skips capability configs — then `buildApplication`
per app). Builds run **inside app workers** (`runtime.js:922-928`) with the full
runtime worker env: root env, env blocks, and (v4) injected `PLT_<ID>_URL`.

- *Artifact divergence:* a Next app baking
  `NEXT_PUBLIC_API_URL: process.env.PLT_API_URL` (a pattern the proposal endorses)
  builds without the injected URL and without env blocks when built standalone.
  `turbo run build` in CI produces production artifacts that differ from
  `wattpm build --all` — silently, `production: true`.
- *`start` in production:* v3 deploy scripts / Dockerfiles with `WORKDIR` in an app
  dir boot the full runtime today; in v4 they silently boot one app on `PORT` —
  binds, health checks pass, siblings don't exist. Silent success as a failure
  mode. An env guard (CI/non-TTY ⇒ require `--all`), or erroring on standalone
  `start` when a root exists above, costs nothing and is not discussed.

### M6. Zero-config app directories invert the package-local rule — and migrate manufactures the inconsistent state

An app dir with **no** per-app config file (every zero-config app, plus every app
whose file migrate omitted as default-only) has the **root** config as its
nearest — so `wattpm dev` there boots the **entire runtime**, while the sibling
*with* a `watt.config.ts` boots standalone. The scaffolded per-app `dev` script
does opposite things in different apps of one migrated project; `turbo run dev`
composes as "some standalone apps + some full-runtime copies". Either the omission
rule must go, or app-dir detection must not depend on the config file's presence
(e.g. "inside a directory autoload would claim" ⇒ standalone).

---

## Minor — fixed directly in the proposal

- **m1.** Auto-wrap entry shape underspecified (no `id`, no `path`; array vs
  singular form). → Specified: id defaults to the package name (directory name
  fallback), path to the config file's directory; normalized form is the singular
  `application`; DTO shows the normalized entry.
- **m2.** A per-app-discovered file classifying as a *root* config was unhandled.
  → Now an error naming the file and both classifications; empty-object exports in
  per-app position are included in the error.
- **m3.** `.env` edits didn't trigger dev reload (env files aren't imports). → The
  enumerable env-file set joins the watch list alongside the import graph.
- **m4.** Breaking-changes item 5 understated the env-file change (`.env.local`/
  `.env.production` written for other tools become live; layering reads files v3's
  first-hit walk never read). → Reworded as a behavior change with the Next.js
  collision called out.
- **m5.** "(and only them)" misstated v3's rule (new-key introduction must work).
  → Corrected to the real rule: absent keys apply; present keys apply only when
  file-sourced.
- **m6.** "Replaces the per-app export wholesale" vs "file never loaded when inline
  `config` exists". → Never-loaded is canonical; the merge wording updated.
- **m7.** Goals drift. → Goal 5 drops "simplified" (documented precedence); Goal 6
  gains the third-party-capability qualifier; the two ladders are labeled
  (config-evaluation view vs worker-runtime view).
- **m8.** Walk-boundary inclusivity. → "stops **after checking** the boundary
  directory".

## Nits — fixed directly in the proposal

- Symbol-based citations for v3 files scheduled for deletion.
- Breaking-changes renumbered (9/9a/9b/9c merge artifact).
- `ConfigContext.env` typed `Readonly<Record<string, string | undefined>>`.

---

## Decisions needed

| # | Finding(s) | Decision | Status |
|---|---|---|---|
| D1 | B1 | Standalone-boot port assignment (search/offset/refuse) and the rule for sibling-dependent capabilities (gateway) booted standalone | **resolved**: no port search — one listen rule everywhere: an app listens only when its own `server` block sets a port, or it is the only application in its runtime (then `PORT`/3042); otherwise it never calls `listen` (mesh-only, v3's non-entrypoint behavior generalized); `EADDRINUSE` fails fast; parallel multi-app dev declares distinct ports. Gateways standalone get the **generic warning only** (no `standalone:` contract flag, no special-casing) — they boot and fail at compose time; documented |
| D2 | B2 | Legacy-detection scope (per-directory?), migrate's always-emit-per-app-files, and the validation loader's ignore-legacy flag | **resolved**: clean-cut migration — git is the undo mechanism. Migrate requires a clean git tree (`--force` overrides; same for no-VCS), converts, **validates emitted files by explicit path** (the direct-path entry runs no discovery/detection, decoupling validation from disk state), then **deletes** legacy files — no rename, no `.v3.bak`, no `--keep` (supersedes the round-3 rename default). Runtime detection becomes **unconditional**: any v3 candidate in a consulted directory errors, even next to a `watt.config.*` — no ignored files, no coexistence states. Omit-default-only per-app files can stay (post-deletion, a default-only app is simply zero-config) |
| D3 | M1 | Cross-app ESM cache contamination in env windows: per-app eval workers, documented read-in-function contract, or env proxy | **resolved**: one eval worker per config file — root worker plus one worker per per-app file, run in parallel. The per-worker ESM cache isolation is load-bearing: shared helpers re-evaluate per worker under that app's env, making contamination structurally impossible. The serial apply/evaluate/restore window machinery is deleted; each worker loads its own layered env and imports. `importedFiles` merged across workers for the watcher; per-worker mutation diffs |
| D4 | M2 | Does `mode` reach workers (workerData + mode-aware worker env file set), or do workers stay on `.env` only | **resolved**: mode selects env files everywhere — it travels in `workerData` and the worker-boot env reader loads the same layered four-file set config evaluation used, so both sides of the boundary agree by construction. Mode is *not* injected as an environment variable. `start` must receive the same `--mode` as `build` to reproduce the view (documented, Vite parity) |
| D5 | M3 | Walk/loadEnv ordering fix, the standalone-boot env model, and invocation-dependent evaluation env | **resolved**: strict ordering — nearest config found **by filename alone**, then `loadEnv` (layered set from that directory to the boundary), then candidate execution/classification with full context. Evaluation env is **directory-determined, never boot-style-determined**: a file's env is always its dir's files over its ancestors' up to the boundary — identical under root boot, standalone, and `--all`. Invocation-dependence eliminated; the false "env walk unchanged" claim already removed |
| D6 | M4 | Version-stamp check defined against the worker's actual resolution order; strictness level (major+minor vs major) | **resolved**: the check replicates `importCapabilityPackage`'s real resolution order (regular import from the runtime context first, app-scoped fallback) and compares the stamp against the copy the worker will actually load — hoisted layouts never false-positive; root-only deps are well-defined. Major mismatch = boot error naming both paths/versions; minor = warning; patch ignored. Integration test per layout |
| D7 | M5 | `build`/`start` standalone semantics in CI/deploy: env parity for builds, guard rails for standalone `start` | **resolved**: **(a)** `--all` is dropped — scope is purely positional (cwd decides; the runtime means running at the root; no scope flags). **(b)** builds are environmentally deterministic: always the app's directory-determined env (real env + env files), never injected `PLT_<ID>_URL` or config `env` blocks, in every mode — `turbo`/standalone/root builds produce identical artifacts by construction; v3 builds reading `env` blocks break loudly and move the value into an env file. **(c)** standalone `start` in automation keeps the warning only — no non-TTY guard (declined); documented |
| D8 | M6 | Config-less app dirs: autoload-claimed directories count as app dirs, and migrate always emits per-app files | **resolved**: detection by claim, not by file — when the walk reaches the root config, cwd inside a claimed application directory (entry `path` or non-excluded autoload subdir) boots that app standalone, config file or not. Package-local scoping is a property of being an app; zero-config stays first-class; siblings are uniform; the claim check reads the already-evaluated root config. Migrate's omit-default-only rule stays (D2), now harmless |

---

# Frontend DX simplification review — round 5

The direction is strong: native TypeScript, zero-config detection, colocated app
configuration, and removal of the wrapped `runtime` dialect all improve frontend DX.
The main remaining opportunity is to reduce the number of concepts encountered in the
single-app and package-local paths.

## Findings

### Blocker — v4 can ship before its required migration tool

`NEW_CONFIG.md:895-904` and `NEW_CONFIG.md:1081-1088` allow stable v4 to ship before
`wattpm-utils migrate`, while v4 refuses every legacy configuration. That creates a
dead-end error message for upgrading users.

**Recommendation:** gate stable v4 on a published, tested migrator. Prefer the
user-facing command `wattpm migrate`, even if its implementation remains in
`wattpm-utils`.

### High — the canonical single-app form is unnecessarily nested

The proposed default requires:

```ts
defineConfig({
  application: {
    config: next(/* ... */)
  }
})
```

See `NEW_CONFIG.md:16-43` and `NEW_CONFIG.md:162-167`. The loader already supports a
bare application definition and automatically wraps it (`NEW_CONFIG.md:451-453`,
`NEW_CONFIG.md:468-470`). Make this the canonical customized frontend configuration:

```ts
import { next } from '@platformatic/next'

export default next({
  cache: {
    adapter: 'redis',
    url: process.env.REDIS_URL
  }
})
```

This makes monorepo promotion move the whole file unchanged, rather than extracting
only the `next()` expression as described at `NEW_CONFIG.md:250-253`.

The progressive model should be:

1. No config.
2. Bare capability factory.
3. `defineConfig` only when runtime orchestration is required.

This may also remove the need for the singular `application` shorthand.

### High — scaffolding contradicts the zero-config goal

Level 0 promises no file when defaults suffice (`NEW_CONFIG.md:158-160`), but
scaffolding emits a root plus per-app factory files (`NEW_CONFIG.md:675-676`,
`NEW_CONFIG.md:881-883`). Migration already omits default-only app files
(`NEW_CONFIG.md:924-925`). Generators should do the same:

- Single frontend app: no Watt config by default.
- Monorepo: thin root autoload config only.
- App-local config: generated only for non-default Watt settings.

### High — per-app functional configuration is not contextually typed

This example has an implicit `any` parameter under strict TypeScript:

```ts
export default ({ mode }) => next(/* ... */)
```

See `NEW_CONFIG.md:262-280`. Only `defineConfig` provides the `ConfigContext` overload
(`NEW_CONFIG.md:1160-1169`). Let capability factories accept callbacks:

```ts
export default next(({ mode }) => ({
  cache: mode === 'test' ? undefined : { adapter: 'redis' }
}))
```

This preserves the concise app-local form and provides autocomplete.

### High — the advertised Turbo flow collides on port 3042

The document presents `turbo run dev` as a supported package-local workflow
(`NEW_CONFIG.md:455-481`), but every standalone zero-config app defaults to port 3042
and no port search occurs (`NEW_CONFIG.md:496-506`). The documented flow therefore
fails unless every application adds configuration, undermining zero-config.

Choose one:

- Use Vite-like automatic port selection under `dev`, while keeping `start` strict.
- Scaffold explicit per-app ports.
- Stop presenting parallel standalone execution as a zero-config workflow.

### Medium — duplicate config ownership should be rejected, not merged

Root and app-local configuration can coexist, use shallow root-winning semantics, or
cause the app file not to be evaluated (`NEW_CONFIG.md:255-258`). An app can therefore
behave differently under package-local and root execution without an obvious reason.

Enforce one capability-config owner:

- Root entries own orchestration fields.
- App-local files own capability settings.
- Inline root `config` plus an app-local config for the same app is an actionable
  error.

### Medium — scope determined solely by `cwd` is unsafe for automation

The same `wattpm start` command can boot one app or the entire runtime, and standalone
execution ignores all root settings (`NEW_CONFIG.md:434-497`). Package-local defaults
are useful, but explicit selectors such as `--root` and `--app` should be available,
and every run should print its selected scope. The standalone warning should name the
omitted root env, telemetry, logger, and server settings.

### Medium — environment configuration has too many overlapping meanings

The proposal exposes `process.env`, callback `env`, root and application `env`,
`envfile`, layered `.env` files, and injected application URLs. These also behave
differently during build and runtime (`NEW_CONFIG.md:267-297`,
`NEW_CONFIG.md:485-493`, `NEW_CONFIG.md:738-778`).

Choose one canonical config-evaluation API. Rename runtime-only config properties to
make their behavior explicit:

```ts
runtimeEnv
runtimeEnvFile
```

This avoids confusion with callback `env` and frontend build-time environment
variables.

### Medium — the first monorepo example teaches the advanced form

The primary multi-app example uses root-inline factories (`NEW_CONFIG.md:169-210`),
but this requires capability dependencies at the workspace root under pnpm
(`NEW_CONFIG.md:677-685`). Lead with the thin-root plus app-local form and move
root-inline factories to an advanced composition section.

### Medium — avoid duplicating framework-native configuration

The factory includes options such as Next.js `trailingSlash`
(`NEW_CONFIG.md:308-315`), although Next already owns that setting and the current
integration conditionally forwards it (`packages/next/index.js:80-82`). Keep framework
behavior in `next.config.*`, `vite.config.*`, and equivalents. Capability factories
should contain only Platformatic-specific integration and execution settings.

## Recommended frontend-facing model

```text
Single app, defaults        → no Watt config
Single app, customized      → export default next({...})
Monorepo                     → root autoload config
Customized monorepo app     → app-local export default next({...})
Advanced orchestration      → root defineConfig({...})
```

This model better delivers the proposal's “one expression moves unchanged” promise
while minimizing concepts in the common frontend path.

---

## Round 5 — resolution tracking

**Fixed directly in the proposal (no decision needed):**

- **Medium — first monorepo example teaches the advanced form:** Level 2 now leads
  with the thin-root + per-app-file style; root-inline composition is demoted to
  "Level 2b (advanced)" with its pnpm root-resolvability requirement stated inline.
- **Medium — framework-native duplication:** examples no longer showcase
  `trailingSlash`; the factories section now states that factory options are
  Platformatic integration/execution settings, framework-native behavior stays in
  the framework's own config file, and mirror options (`next.trailingSlash`) are
  reviewed for removal during the schema audit.
- **Medium — cwd scope, partial:** every invocation prints its resolved scope
  (winning config file + what boots) before acting; the standalone warning now
  names the omitted root settings (server, logger, telemetry, env). The explicit
  `--root`/`--app` selector question is D15.

### Decisions needed — round 5

| # | Finding | Decision | Status |
|---|---|---|---|
| D9 | Blocker | Gate stable v4.0 on a published migrator? Command surface (`wattpm migrate` vs `npx wattpm-utils migrate`) — challenges the round-4 decoupling ruling | **resolved**: stable v4.0 **gates** on a published, tested migrate (alphas/RCs may precede it); release cadence stays decoupled post-GA via npx-resolves-at-invocation. Command stays `npx wattpm-utils migrate` — no `wattpm` routing, no forwarder |
| D10 | High | Canonical single-app form: bare `export default next({…})` vs `defineConfig` + singular `application`; fate of the `application` shorthand | **resolved**: bare factory export is the canonical single-app form (Level 1) — auto-wrapped, byte-identical to a per-app file, so promotion to a monorepo moves the whole file; `defineConfig` + the singular `application` shorthand is Level 1b for runtime options (shorthand kept — no one-element array ceremony). Headline example, levels, and migrate emission rules updated |
| D11 | High | Scaffolding vs zero-config: emit no config / only-non-default config files | **resolved**: generators follow migrate's omit-defaults rule — single-app defaults produce **no** Watt config file; monorepos get the load-bearing thin root only, per-app files only for non-default options; the wizard prints the bare-factory one-liner for later customization | 
| D12 | High | Contextual typing for per-app function exports (factory accepts callback vs typed wrapper vs documented annotation) | **resolved**: factories accept a typed callback — `next(({ mode }) => ({…}))`; `next(cb)` desugars to `ctx => next(cb(ctx))`, handled by classification rule 1, so serializability and composition are untouched; `ConfigContext` lives in `@platformatic/basic`, re-exported as a type by every capability; bare function exports stay legal but the callback form is the documented one |
| D13 | High | `turbo run dev` port story (dev-only auto-port vs scaffolded ports vs stop advertising zero-config parallel dev) — challenges D1's no-port-search ruling | **resolved**: the turbo pitch is retired — D1 stays fully strict (no auto-assignment anywhere). Multi-app dev is the runtime's job at the root (one port, working mesh); parallel standalone processes remain possible with explicitly declared distinct ports but are not an advertised workflow. `turbo run build` remains fine (builds don't listen; determinism per D7) |
| D14 | Medium | Root-inline `config` + app-local file for the same app: actionable error vs current silent never-loaded | **resolved**: boot error naming both sources — capability config has one owner. Orchestration-only root entries still merge over app files (v3 mappings semantics kept for orchestration keys). Rationale: a shadowed app file would still win under standalone boot, so silence = split-brain; the check is filename-presence only; migrate never emits the state |
| D15 | Medium | Explicit scope selectors (`--root`/`--app`) — challenges D7's purely-positional ruling | **resolved**: purely positional re-affirmed — no scope flags. Observability half already landed (printed resolved scope + warning naming omitted root settings); the migration guide explicitly calls out the v3 Dockerfile/WORKDIR pattern (must point at the project root in v4) |
| D16 | Medium | Env API consolidation / renaming (`env`→`runtimeEnv`, `envfile`→`runtimeEnvFile`) | **resolved**: keep `env`/`envfile` — v3 naming continuity wins; the evaluation-env vs worker-runtime-env split is carried by documentation, the precedence ladders, and inline comments in the type sketch (already stated at both `env`-block mentions in the proposal) |
