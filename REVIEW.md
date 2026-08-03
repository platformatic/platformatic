# Adversarial review of NEW_CONFIG.md — round 6

**Reviewed:** 2026-08-03, against HEAD `aea478cfc` on
`feat/new-config-proposal`
**Method:** fresh pass over the round-5 resolutions, with focused attacks on
classification, worker boundaries, zero-config generation, environment semantics,
and migration. Previously resolved findings are not repeated unless the resolution
itself remains unsound. Source references were checked against the current tree.

---

## Blockers

### B1. Classification rejects valid gateway and Nitro application definitions

Classification errors when an object has `module` plus `applications`, `autoload`, or
`entrypoint` (`NEW_CONFIG.md:480-490`). Those are not reliably root-only keys after
capability blocks are flattened:

- The proposal's own root-inline example calls
  `gateway({ applications: [...] })` (`NEW_CONFIG.md:244-249`), and gateway defines
  `applications` as a capability option (`packages/gateway/lib/schema.js:193-203`).
- Nitro defines `entrypoint` as a capability option
  (`packages/nitro/lib/schema.js:10-19`).

The factory result is therefore `{ module, applications }` or `{ module, entrypoint }`
and fails before capability-schema validation. The same failure affects canonical
per-app files, not only the advanced root-inline form.

**Fix direction:** make `module` unconditionally classify an object as an
`ApplicationDefinition`. Root configs no longer admit `module`; the selected
capability schema can reject keys that are invalid for that capability without a
collision list that is inevitably incomplete.

### B2. The serializability check runs after structured clone has already changed or rejected the value

Eval workers post `{ config, ... }` to the main process (`NEW_CONFIG.md:633-641`), but
the path-aware serializability check runs only afterward (`NEW_CONFIG.md:667-676`).
Worker messages cross Node's structured-clone boundary:

- A nested function or symbol throws `DataCloneError` before Watt can produce the
  promised `InvalidConfigValueError` and JSON path.
- A custom class instance is cloned into a plain object, losing the prototype that
  the main-side check needed to reject it.

The check therefore cannot enforce its stated contract at its current location.

**Fix direction:** run the serializability walk inside each eval worker before
`postMessage`, and send a structured, path-aware error to the main process. Keep the
main-side check for programmatic object sources and as defense in depth.

### B3. The listen rule prevents the selected multi-app entrypoint from listening

The thin-root example sets root `entrypoint` and `server.port`
(`NEW_CONFIG.md:198-201`), and root dev promises one externally reachable port
(`NEW_CONFIG.md:546-547`). The listen rule instead says a non-singleton application
listens only when its own capability `server` block sets a port
(`NEW_CONFIG.md:569-578`). The example gateway has no such block, so every app is
mesh-only and the runtime exposes no public listener.

Current behavior explicitly passes root `runtimeConfig.server` to the selected
entrypoint (`packages/runtime/lib/worker/main.js:273-277`). Removing that case breaks
the normal thin-root topology.

**Fix direction:** the selected entrypoint listens with the root `server` settings
(and their defaults). App-local explicit ports create additional listeners; other
applications remain mesh-only.

### B4. “Load exactly as v3, then convert placeholders” destroys the source information migration needs

The migrator says it loads configuration exactly as production v3 would, including
frozen capability transforms, and then converts `{PLT_X}` placeholders
(`NEW_CONFIG.md:990-1019`). The v3 loader replaces environment references before
upgrade, validation, and transform (`packages/foundation/lib/configuration.js:518`,
`:583`, `:592`, `:606`). Capability transforms also mutate authored values; for
example Next forces `watch` and rewrites the Redis adapter
(`packages/next/lib/config.js:6-13`).

After that pipeline:

- If `PLT_REDIS_URL` is set while migration runs, the token has become the actual
  value. The codemod cannot know it should emit `process.env.PLT_REDIS_URL` and can
  bake a secret into source.
- Embedded placeholders such as
  `http://127.0.0.1:{PLT_OTLP_PORT}/v1/metrics`
  (`packages/runtime/fixtures/otlp-exporter/platformatic.json:16`) become ordinary
  strings, so their expression boundaries cannot be reconstructed.
- Runtime transform removes environment-disabled applications
  (`packages/runtime/lib/config.js:316-319`, `:413-417`); generating from that view
  can permanently omit production-only or development-only apps.
- Defaults, resolved absolute paths, and transform-only fields are mixed into the
  object that v4 will validate and transform again.
- An unset placeholder may already have become the v3 fallback value, so its original
  key is unrecoverable.

**Fix direction:** maintain three representations: lexical parsed input preserving
placeholder tokens, upgraded/validated raw data with path fixing disabled, and a
disposable transformed clone used only for equivalence checks. Generate exclusively
from the lexical/upgraded views, including explicit template-literal rules for
embedded and double-braced placeholders.

### B5. Migration validates v4 imports before the v4 capability packages are installed

Migration anticipates projects whose app dependencies still pin v3, updates their
ranges, and only **prints** the package-manager install command
(`NEW_CONFIG.md:1022-1035`). It then immediately imports and validates the emitted v4
files (`NEW_CONFIG.md:1036-1041`). Standard ESM resolution from an app-local file still
finds the installed v3 package, which has no factory export, regardless of the edited
range in `package.json`.

This makes validation fail for precisely the upgrade state step 2 claims to support.
Older supported projects may also depend only on the umbrella `platformatic` package
(`packages/runtime/fixtures/sample-runtime/package.json:8-10`); the proposal updates
capability ranges but never adds the root `wattpm` dependency required by every
emitted thin-root `defineConfig` import. Likewise, dependencies previously satisfied
by the runtime fallback may not exist in the app manifest at all.

**Fix direction:** migration must add or upgrade root `wattpm`, ensure every emitted
factory package is an app-local v4 dependency, run the detected package-manager
install after explicit consent, include the lockfile in the migration transaction,
and only then validate with the packages the generated files actually resolve.
Installation failure must stop before legacy deletion.

### B6. Generated zero-config monorepo applications have no capability definition

Scaffolding intentionally omits per-app files for default-only applications
(`NEW_CONFIG.md:959-967`). The eval-worker design only describes importing a per-app
file for entries with a path and no inline config (`NEW_CONFIG.md:614-625`), while v4
workers receive `resolvedConfig` data and no longer discover or load config files
(`NEW_CONFIG.md:706-719`). No step runs `detectApplicationType` for an autoloaded app
whose file was omitted.

Consequently a generated thin-root monorepo can discover `web/frontend` but has no
`ApplicationDefinition.module` from which to select `@platformatic/next`. Current v3
behavior cannot fill the gap: an app with no config falls back to generic
`@platformatic/basic` (`packages/runtime/lib/worker/controller.js:132-151`).

Even if the missing call is added, the current detector is not stable enough to
reconstruct a generator choice. It checks framework dependencies before most direct
Platformatic capability dependencies and deliberately omits `@platformatic/node`
(`packages/foundation/lib/module.js:13-42`, `:142-168`). A generated Node or Service
app that later adds Vite as unrelated tooling can silently switch to the Vite
capability on its next zero-config boot.

**Fix direction:** apply one deterministic detector independently to every application
entry with neither inline config nor a per-app file. Direct Platformatic capability
dependencies, including `@platformatic/node`, take priority; exactly one wins and
multiple candidates produce an actionable ambiguity error. Framework inference is
fallback-only. Generators may omit config only when this rule recovers the capability
the wizard selected.

---

## Majors

### M1. The root worker cannot run in parallel with workers whose existence it determines

The proposal says the root worker and all per-app workers run in parallel
(`NEW_CONFIG.md:595-604`). But the root worker must first evaluate dynamic root code,
expand `autoload`, and produce the application paths (`NEW_CONFIG.md:606-613`). The
app workers also need the root env view before layering their app env
(`NEW_CONFIG.md:614-621`, `:633-641`).

The fan-out cannot be known or initialized until the root result exists.

**Fix direction:** specify a phased load: evaluate and minimally validate/normalize
the root first, then spawn all discovered per-app workers in parallel. Clarify which
root transform owns autoload expansion so it does not run twice.

### M2. Factory callbacks still do not compose in nested root-inline entries

`next(cb)` is specified as returning `ctx => next(cb(ctx))`, and is claimed to work in
both per-app exports and root-inline `config` values (`NEW_CONFIG.md:320-327`). The
only invocation rule, however, calls a function **export**
(`NEW_CONFIG.md:480-490`). A nested value such as
`applications[0].config = next(cb)` remains a function, then fails at the worker
message boundary or serializability check.

**Fix direction:** add an explicit awaited resolution pass for `application.config`
and every `applications[].config` before serializability. Define which context and env
view nested callbacks receive rather than relying on top-level classification.

### M3. Moving an env-dependent factory between app-local and root-inline form changes its value

The proposal says the factory expression is identical in root-inline and per-app
positions (`NEW_CONFIG.md:19-22`) and that the same expression evaluates identically
everywhere (`NEW_CONFIG.md:800-812`). Environment evaluation is directory-determined,
though: a root-inline call executes in the root worker with root env files, while the
same call in `web/frontend/watt.config.ts` sees the frontend's env files.

Moving this expression changes `REDIS_URL` whenever the app has its own `.env`:

```ts
next({ cache: { adapter: 'redis', url: process.env.REDIS_URL } })
```

**Fix direction:** either state plainly that root-inline factories use the root env
and withdraw the semantic-portability claim, or defer per-entry factory callback
resolution to an app-aware context. Static `process.env` reads performed while the
root module imports cannot be made app-local afterward.

### M4. The execution boundary does not protect normal production containers

The walk stops at `.git`, a workspace-bearing `package.json`, or
`pnpm-workspace.yaml`, but falls back to the filesystem root when none exists
(`NEW_CONFIG.md:584-592`). A typical production image contains `/app/package.json`
without `workspaces` and omits `.git`. From `/app`, v4 can therefore find and execute
`/watt.config.ts` supplied by a base image or parent mount. In v3 the same walk parsed
data; in v4 it executes code.

This contradicts the claim that a stray parent config is structurally unreachable.

**Fix direction:** treat the nearest ordinary `package.json` as a safe fallback
boundary when no enclosing workspace marker is found, or stop with a targeted error
and require `--config`. Never retain an unbounded executable-config walk.

### M5. `envfile` has no defined position in the new four-file precedence

Application `envfile` remains part of the runtime contract
(`NEW_CONFIG.md:721-724`, `:1236-1239`), but neither precedence ladder includes it
(`NEW_CONFIG.md:783-792`, `:840-856`). Current worker boot makes `envfile` replace the
default app `.env` path (`packages/runtime/lib/worker/main.js:235-260`). The v4
recognized set now has four mode-aware files, so “unchanged” no longer determines
whether a custom file replaces that set, augments it, or sits above/below it.

**Fix direction:** define `envfile` as either a replacement for the complete app
four-file layer or as an explicit rung in the precedence ladder, and cover collisions
with root/app mode files and real environment values.

### M6. The documented rollback leaves every newly generated config behind

Migration calls version control the complete undo mechanism and instructs users to
run `git restore .` (`NEW_CONFIG.md:1044-1050`). `git restore .` restores modified and
deleted tracked files; it does not remove untracked `watt.config.ts` files created by
the migrator. Restoring the legacy files while leaving those generated files produces
the exact forbidden coexistence state.

**Fix direction:** keep a manifest and automatically remove generated files on
failure, or print a path-scoped rollback command that restores tracked files and
removes exactly the files migration created. Do not recommend an unrestricted
`git clean`.

### M7. `--debug-config` can display a configuration that real boot never uses

Per-file ESM cache isolation is declared load-bearing because shared helpers must
re-evaluate under each app's env (`NEW_CONFIG.md:595-604`). `--debug-config` instead
evaluates in one process with one module cache (`NEW_CONFIG.md:678-698`). If root and
app configs import the same helper, the first import fixes its module-scope env values
for all later imports. The diagnostic command can therefore print cross-app
contaminated values while the real boot is correctly isolated.

**Fix direction:** keep isolation for multi-file debug output, or require an explicit
single config/app target and debug only that worker's evaluation. “One-shot cache
semantics” is not enough when one shot contains multiple env views.

### M8. The direct-path migration bypass is not separated from public `--config`

Legacy detection is described as unconditional, including beside a v4 file
(`NEW_CONFIG.md:451-475`). Migration validation then uses a “`--config`-style”
direct-path entry that never performs legacy detection (`NEW_CONFIG.md:1036-1040`).
The proposal does not distinguish that private validation API from the public
`--config` flag, which also accepts direct v4 paths.

If they share behavior, `wattpm -c watt.config.ts` bypasses the no-coexistence guard.

**Fix direction:** make bypassing legacy detection a private migrator-only loader
option. Public `--config` must scan the selected config directory and every discovered
app directory for legacy candidates.

### M9. The version stamp has no specified relationship to capability-schema validation

Factories add a top-level `version` property (`NEW_CONFIG.md:381-388`), and main-side
validation applies the capability's schema (`NEW_CONFIG.md:621-626`). Capability
schemas use `additionalProperties: false`; for example the current Next schema ends
that way and has no `version` property (`packages/next/schema.json:3294`). The schema
audit describes removals but never says whether loader metadata is stripped or every
capability schema gains `version`.

As written, every stamped factory result risks failing the capability schema.

**Fix direction:** define `module` and `version` as loader metadata, strip them into a
separate envelope before capability AJV/transform, and state whether
`resolvedConfig` includes them. Alternatively reserve both fields in a shared schema
fragment used by every capability.

### M10. Placeholder emission drops v3 missing-variable and `strictEnv` semantics

Migration maps placeholders to bare `process.env.X` references
(`NEW_CONFIG.md:1015-1021`), while v4 omits object properties whose value is
`undefined` (`NEW_CONFIG.md:726-731`). V3 instead replaces a missing variable with
`''` (`packages/foundation/lib/configuration.js:440-449`); effective
`strictEnv: true` throws, and `strictEnv: 'warn'` emits a warning
(`packages/foundation/lib/configuration.js:538-569`).

A valid arbitrary plugin option such as `token: "{TOKEN}"` therefore changes from
`token: ''` to an absent property when `TOKEN` is unset. A project that previously
failed under `strictEnv: true` can silently boot without the value after migration.

**Fix direction:** generate according to effective strictness: preserve the non-strict
fallback (`process.env.X ?? ''`) for string positions, emit a generated required-env
helper for strict mode, and preserve warn-mode diagnostics. Typed positions need an
explicit per-type rule reproducing the v3 coercion or failure rather than generic
bare references.

---

## Minor contradictions to fix directly

- **m1. Single-app migration output:** Level 1 says migration emits a bare factory at
  the project root when there are no runtime settings (`NEW_CONFIG.md:173-179`), while
  the migration algorithm always says it emits per-app files plus a thin root
  (`NEW_CONFIG.md:1011-1014`). Specify the single-app branch explicitly.
- **m2. Singular `application` exclusivity:** the shorthand is described as a
  single-app form and exclusive only with `applications` (`NEW_CONFIG.md:51-55`,
  `:1197-1202`). Define whether combining it with `autoload` is forbidden; otherwise
  normalization can create a multi-app runtime from the “single-app” shorthand.
- **m3. Multiple v4 candidates:** file resolution silently picks the first of `.ts`,
  `.mts`, `.js`, and `.mjs` (`NEW_CONFIG.md:442-449`). Given the hard error for
  legacy/v4 coexistence, two v4 candidates should also produce a targeted ambiguity
  error rather than silently ignoring one.

---

## Decisions needed

| # | Finding(s) | Decision | Status |
|---|---|---|---|
| D1 | B1 | Replace the root-key collision list with unconditional `module` classification | **resolved** — user decision: `module` always classifies as ApplicationDefinition; collision list deleted; capability schema rejects invalid keys with a root-config hint |
| D2 | B2 | Move serializability enforcement before eval-worker `postMessage` | **resolved** — in-worker walk before postMessage posts a structured path-aware error; main-side check kept for object sources and defense in depth |
| D3 | B3 | Restore root `server` ownership for the selected entrypoint | **resolved** — user decision: entrypoint always listens with root `server` settings (defaults PORT/3042); other apps listen only via explicit app-local port |
| D4 | B4 | Split migration into source-preserving generation and resolved-v3 verification views | **resolved** — three views: lexical (tokens intact), upgraded (env replacement off, path-fixing disabled), disposable resolved (equivalence check only) |
| D5 | B5 | Decide when/how v4 capability packages are installed before validation | **resolved** — user decision: migrate detects the package manager, adds root `wattpm` + app-local capability deps, runs the consented install (lockfile in transaction), then validates; `--install`/`--no-install` |
| D6 | B6 | Specify per-entry zero-config capability detection and synthesis | **resolved** — user decision: deterministic per-entry detector, capability deps (incl. @platformatic/node) first with ambiguity error, framework inference fallback-only, logged at boot |
| D7 | M1 | Make root evaluation a prerequisite, then parallelize the app fan-out | **resolved** — phased load: root worker first (sole owner of autoload expansion), per-app workers in parallel after |
| D8 | M2, M3 | Define nested factory resolution and its env/context semantics | **resolved** — user decision: root worker awaits function-valued entry `config` with the root ConfigContext before serializability; portability claim qualified (env is directory-determined) |
| D9 | M4 | Define a bounded walk for single-package/container layouts | **resolved** — user decision: nearest ordinary package.json bounds the walk when no hard marker exists; no filesystem-root fall-through, targeted error + `--config` |
| D10 | M5 | Place `envfile` in the mode-aware runtime env model | **resolved** — user decision: `envfile` replaces the app four-file layer as a single rung; mode selection off for that app |
| D11 | M6 | Provide a rollback that removes generated untracked files | **resolved** — created-files manifest; auto-cleanup on failure; success prints path-scoped `git restore <tracked> && rm <created>`; no `git clean` |
| D12 | M7 | Preserve per-file isolation in debug mode or limit debug scope | **resolved** — `--debug-config` uses the eval-worker pipeline; in-process `--inspect-brk` mode restricted to one config file |
| D13 | M8 | Separate private migration validation from public `--config` | **resolved** — private migrator-only direct-path loader entry; public `--config` performs the full unconditional legacy scan |
| D14 | M9 | Define the metadata envelope around capability validation and DTOs | **resolved** — `module`/`version` are loader metadata stripped before capability AJV/transform; DTO carries them as `applications[].module`/`version` beside `resolvedConfig` |
| D15 | M10 | Preserve missing-placeholder and effective `strictEnv` behavior in generated code | **resolved** — user decision: `?? ''` for non-strict strings, generated `requiredEnv` helper for strict/warn, template literals for embedded, typed coercion per audit table |

Minors m1–m3: **resolved** — single-app migration branch specified (bare factory /
Level 1b root file); `application` shorthand exclusive with `applications` and
`autoload`; multiple v4 candidates in one directory are an ambiguity error.
