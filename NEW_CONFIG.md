# NEW_CONFIG: `watt.config.ts` — one config model for Watt v4

**Status:** Proposal — open questions resolved (see “Resolved decisions”)
**Target:** v4 (breaking), with a gated experimental preview in a late v3 minor
**Author:** Platformatic team

## Summary

Watt v4 replaces the JSON-with-`$schema` configuration system with a single, code-first
configuration file — `watt.config.ts` (or `.js`) — loaded natively by Node.js via type
stripping, with full TypeScript types provided by `wattpm` and by each capability package.

The core structural change is that **there is exactly one configuration dialect**: the
runtime dialect. The distinction between "a single-app config with a nested `runtime`
block" and "a runtime config with nested applications" disappears. A single-app project
and a 20-app monorepo use the same file shape; scaling from one to many is a file move,
not a rewrite.

```ts
// watt.config.ts — a complete single-app Next.js project
import { defineConfig } from 'wattpm'
import { next } from '@platformatic/next'

export default defineConfig({
  server: { port: 3042 },
  logger: { level: 'info' },
  applications: [next({ cache: { adapter: 'redis', url: process.env.REDIS_URL } })]
})
```

Everything the JSON system can express remains expressible. Nothing about the runtime's
internals changes: the config file evaluates to the same normalized object the runtime
consumes today, and AJV validation, `transform()`, and the worker boot path stay intact.

---

## Motivation

### Problem 1 — two dialects, and the `runtime` block is the worst of it

Today a multi-app project has a root config in the *runtime dialect*:

```json
{
  "$schema": "https://schemas.platformatic.dev/wattpm/3.65.0.json",
  "server": { "hostname": "{PLT_SERVER_HOSTNAME}", "port": "{PORT}" },
  "logger": { "level": "{PLT_SERVER_LOGGER_LEVEL}" },
  "autoload": { "path": "web" }
}
```

…while a single-app project (the `WrappedGenerator` output, and what `wattpm import`
produces) has a config in the *capability dialect*, with runtime options exiled into a
nested `runtime` property:

```json
{
  "$schema": "https://schemas.platformatic.dev/@platformatic/next/3.65.0.json",
  "runtime": {
    "server": { "hostname": "{PLT_SERVER_HOSTNAME}", "port": "{PORT}" },
    "logger": { "level": "{PLT_SERVER_LOGGER_LEVEL}" },
    "managementApi": "{PLT_MANAGEMENT_API}"
  }
}
```

This is the single worst piece of DX in the platform:

- The `runtime` block's schema (`wrappedRuntime` in `packages/foundation/lib/schema.js`)
  is defined **by exclusion lists** (`runtimeUnwrappablePropertiesList`,
  `applicationsUnwrappablePropertiesList`). Nobody — including us — can say from memory
  which properties are legal inside it. It even contains a nested `application` object
  that is *itself* the application schema minus another exclusion list.
- The same setting lives at different depths depending on project shape. `logger` is
  top-level in a runtime config, `runtime.logger` in a wrapped config, and *also*
  top-level in the capability config as the per-app logger. Users guess, paste from the
  wrong doc page, and get silent misconfiguration (via lax coercion) or confusing AJV
  errors.
- Growing from one app to two forces a full config rewrite: unwrap the `runtime` block,
  invert the nesting, create a new root file, move the capability options. The runtime
  performs the same inversion at boot (`wrapInRuntimeConfig`,
  `packages/runtime/lib/config.js:131`) — machinery that exists only to bridge the two
  dialects.
- The docs mirror the split: every capability page needs the
  `_runtime-in-capabilities.md` include to explain the wrapped subset.

### Problem 2 — JSON + `{PLT_X}` interpolation is a poor programming language

- Conditional config (dev vs prod, per-environment ports, optional telemetry) is
  impossible without env-var contortions: `"watch": "{PLT_WATCH}"` plus a `.env`, a
  `.env.sample`, and string-to-boolean coercion rules users must learn.
- `{PLT_X}` placeholders are stringly-typed, fail closed to `""` by default, and need
  the `strictEnv` option, the `?` YAML quoting pre-pass, the `kEnvFileFallbackKeys`
  precedence machinery, and the special `*_URL` `onMissingEnv` fallback — all of which
  is invisible to users until it bites.
- No composition, no reuse, no comments in plain JSON, no types while editing beyond
  what `$schema`-aware editors offer.

### Problem 3 — `$schema` URLs as a versioning and identity mechanism

The `$schema` URL does triple duty: editor autocomplete, capability module selection
(`extractModuleFromSchemaUrl`), and config version detection for `semgrator` upgrades.
It is verbose, version-pinned (goes stale on every release), exists in three historical
URL formats, and is the thing users most frequently delete or mangle. In a code-first
config, the imported package *is* the identity and the version.

### Non-problems (explicit non-goals)

- **The runtime's internal config model.** The normalized object (what
  `transform()` produces and workers consume) is good. We keep it.
- **Validation.** AJV validation of the normalized object stays; TypeScript types are
  an authoring aid, not the enforcement layer.
- **Zero-config boot.** `wattpm dev` in a bare Next/Vite/Node repo with no config file
  at all must keep working (via `detectApplicationType`). v4 makes this *better*: no
  more auto-writing a `watt.json` with `?autogenerated=true` into the user's tree.

---

## Goals

1. One configuration dialect. The `runtime` wrapped block, `wrapInRuntimeConfig`, and
   the `web`/`services` aliases are removed.
2. `watt.config.ts` / `watt.config.js` as the canonical format, loaded with **zero new
   dependencies** (Node ≥ 22.19 type stripping is already our floor).
3. Full typed autocomplete: `defineConfig` from `wattpm`, one typed factory per
   capability (`next()`, `node()`, `gateway()`, `service()`, `db()`, `vite()`, …).
4. Single-app → multi-app is a file move, not a rewrite.
5. Env handling becomes ordinary JavaScript (`process.env`), with `.env` loaded before
   the config file is evaluated.
6. A `wattpm migrate` codemod that converts any v2/v3 JSON/YAML/TOML tree into v4
   `watt.config.ts` files automatically.
7. Everything downstream of config loading (validation, transform, workers, ITC,
   management API) is untouched.

---

## The new model

### One dialect, three levels of ceremony

**Level 0 — no config file.** `wattpm dev` in a directory: application type is
auto-detected from `package.json` dependencies, defaults apply. Nothing is written to
disk.

**Level 1 — single app.** One file at the project root:

```ts
// watt.config.ts
import { defineConfig } from 'wattpm'
import { next } from '@platformatic/next'

export default defineConfig({
  server: { port: 3042 },
  logger: { level: 'info' },
  applications: [
    next({
      // path defaults to the config file's directory
      cache: { adapter: 'redis', url: process.env.REDIS_URL },
      trailingSlash: true,
      workers: 2
    })
  ]
})
```

Every runtime option (`server`, `logger`, `health`, `metrics`, `telemetry`, `undici`,
`httpCache`, `gracefulShutdown`, …) is top-level — exactly where it is in a multi-app
config. **The `runtime` block does not exist in v4.**

**Level 2 — multi-app.** Same shape, more entries:

```ts
// watt.config.ts
import { defineConfig } from 'wattpm'
import { next } from '@platformatic/next'
import { node } from '@platformatic/node'
import { gateway } from '@platformatic/gateway'

const production = process.env.NODE_ENV === 'production'

export default defineConfig({
  entrypoint: 'gateway',
  server: { port: Number(process.env.PORT ?? 3042) },
  logger: { level: production ? 'warn' : 'info' },
  metrics: production && { port: 9090 },

  applications: [
    gateway({
      id: 'gateway',
      path: 'web/gateway',
      applications: [
        { id: 'api', proxy: { prefix: '/api' } },
        { id: 'frontend', proxy: { prefix: '/' } }
      ]
    }),
    node({ id: 'api', path: 'web/api', workers: production ? 4 : 1 }),
    next({ id: 'frontend', path: 'web/frontend' })
  ]
})
```

**Level 2b — monorepo with per-app config files.** `autoload` survives, and per-app
configuration moves into the app's own `watt.config.ts`, which exports a **capability
instance** — the same expression that would appear inline at the root:

```ts
// watt.config.ts (root)
import { defineConfig } from 'wattpm'

export default defineConfig({
  entrypoint: 'gateway',
  server: { port: 3042 },
  autoload: { path: 'web' }
})
```

```ts
// web/frontend/watt.config.ts
import { next } from '@platformatic/next'

export default next({
  trailingSlash: true,
  cache: { adapter: 'redis', url: process.env.REDIS_URL }
})
```

This is the unification punchline: **a root single-app config and a per-app config in
a monorepo are the same expression.** Promoting a standalone project into a monorepo
app means moving its `watt.config.ts` into the app folder, deleting the runtime-level
options from it (TypeScript flags them — they don't exist on the capability factory's
per-app type), and listing it from the root. No dialect change, no re-nesting.

### Functional form for environment-dependent config

`defineConfig` also accepts a function, sync or async:

```ts
export default defineConfig(({ env, production, root }) => ({
  server: { port: Number(env.PORT ?? 3042) },
  watch: !production,
  applications: [/* … */]
}))
```

- `env` — `process.env` after `.env` merging (see “Env files” below).
- `production` — `true` when running under `wattpm start` / `--production`.
- `root` — absolute directory of the config file.

The async form enables config that reads files or fetches secrets at boot; we document
it but discourage slow work here.

### Capability factories

Each capability package exports one typed factory plus its option types:

```ts
// from @platformatic/next
export function next (options?: NextApplicationOptions): ApplicationDefinition
```

Factory options are the **flattened merge** of:

1. Orchestration properties of an application entry (`id`, `path`, `workers`, `health`,
   `env`, `envfile`, `dependencies`, `preload`, `nodeOptions`, `permissions`,
   `restartOnError`, `packageManager`, `sourceMaps`, `telemetry.instrumentations`, …).
2. The capability's own options, hoisted out of today's namespaced block
   (`next.trailingSlash` → `trailingSlash`, `node.main` → `main`,
   `vite.ssr` → `ssr`, plus shared blocks like `cache`, `application.commands` →
   `commands`, per-app `logger`).

TypeScript makes the flattening safe: collisions are impossible to author because the
factory's option type is a single interface, and we control both halves. Internally the
factory returns a small tagged object:

```ts
interface ApplicationDefinition {
  [kApplication]: true
  module: string          // '@platformatic/next'
  version: string         // capability package version, for diagnostics
  options: object         // normalized back into the v3-internal per-app shape
}
```

The normalization back to the current internal shape (namespaced capability block etc.)
happens inside the factory, so **the runtime and worker code see the same object they
see today**. Capabilities implement their factory with a helper from
`@platformatic/basic` (`defineCapabilityFactory(module, schema, mapOptions)`), so adding
one is ~20 lines per package.

External/community capabilities that don't ship a factory remain usable with the
generic escape hatch:

```ts
import { application } from 'wattpm'

application({ id: 'php', path: 'web/php', module: '@platformatic/php', config: { /* raw */ } })
```

### Generic per-app entries and remote apps

Non-capability orchestration entries keep working inline:

```ts
applications: [
  application({ id: 'legacy', url: 'https://github.com/org/legacy.git', gitBranch: 'main' })
]
```

`wattpm resolve` and `resolvedApplicationsBasePath` are unchanged.

---

## Detailed design

### File resolution

Search order in a directory (first hit wins):

1. `watt.config.ts`
2. `watt.config.mts`
3. `watt.config.js`
4. `watt.config.mjs`
5. `watt.json` — **v4 shape only** (see “JSON in v4”)

There is no compatibility loader in v4. When the search finds only a v2/v3-shaped file
(detected by `$schema`/`module` or the presence of removed properties like `runtime`,
`web`, `services`) or a YAML/JSON5/TOML file, the runtime exits with a clear error
pointing at `wattpm migrate`.

The recursive upward search (`findConfigurationFileRecursive`) keeps its semantics but
matches on the new filenames. The `--config` / `-c` flag accepts any of these.

We deliberately use `watt.config.*`, not `watt.ts`, following the `vite.config.ts` /
`next.config.ts` convention and avoiding collisions with app source files.

### Loading mechanism

- `import(pathToFileURL(configPath))` in the runtime's **main process**, before any
  worker is spawned. `.ts`/`.mts` work through Node's built-in type stripping — no
  `jiti`, no `esbuild`, no compile step. This is the same mechanism the runtime already
  uses for `extensions` (`runtime.js` `#loadExtensions`).
- The default export is unwrapped: a plain object, a function (called with the context
  described above), or a bare `ApplicationDefinition` (auto-wrapped as
  `{ applications: [def] }` so `export default next({ … })` alone is a valid root
  config).
- The evaluated result is **normalized to a plain JSON-serializable object** and then
  enters the existing pipeline in `loadConfiguration` at the *validate* step: AJV
  (`useDefaults`, `coerceTypes`) → `transform()` → `kMetadata` attachment. `replaceEnv`
  and `upgrade` are skipped for code configs — env is the user's job, versioning is the
  package manager's job.
- Serializability is enforced with a clear error (functions, class instances, symbols →
  `InvalidConfigValueError` naming the JSON path). Config still crosses the
  `workerData` boundary, so this constraint is load-bearing. Function-shaped needs
  (logger transports, gateway handlers, `deduplication.key`) stay expressible as file
  paths loaded worker-side, exactly as in v3. A future 4.x minor can relax this by
  re-evaluating per-app config files inside workers — the file layout already supports
  that — but we make no public commitment in v4.0 (decision: see “Resolved
  decisions”).
- Per-app `watt.config.ts` files are evaluated the same way by the worker controller
  (replacing the "scan for recognized files, read `$schema`" dance in
  `worker/controller.js`): import, expect an `ApplicationDefinition`, hand its
  normalized options to `pkg.create()`.

**Precedence when both exist:** an inline root entry and a per-app file for the same
app id are deep-merged, root winning — the root config is the orchestration source of
truth, mirroring today's `autoload.mappings` behavior.

### Env files

`.env` handling is preserved but simplified and made *ambient*:

1. Before importing the config file, the loader runs today's `loadEnv` walk-up and
   **applies the result to `process.env`** (file values never overriding real env, as
   today).
2. The config file then just reads `process.env` / the `env` context argument.
3. `{PLT_X}` interpolation, `strictEnv`, `envfile` at the root level, and the YAML
   brace-quoting pre-pass no longer exist in the v4 runtime — they survive only inside
   `wattpm migrate`'s legacy reader. Per-application `env` / `envfile` (which configure
   the *worker's* environment, not the config file's) are unchanged.
4. `wattpm` exports a tiny `requireEnv(name: string): string` helper that throws a
   descriptive error — the code-first replacement for `strictEnv: true`.
5. The `*_URL` magic (`onMissingEnv` resolving `{FOO_URL}` to an app's internal URL)
   is config-time-only today and dies with interpolation. Its runtime equivalent —
   workers resolving sibling URLs via `http://<id>.plt.local` and the injected
   `PLT_<ID>_URL` worker env vars — is unaffected.

### Validation and types

- **AJV stays authoritative.** The v4 schemas are the v3 schemas minus: `$schema`
  (optional, ignored), `module` at root, `runtime` (wrapped block), `web`, `services`,
  `verticalScaler` (already migrated into `workers`), and the deprecated
  `healthChecksTimeouts`.
- TypeScript types for `WattConfig` and every factory's options are **generated from
  the schemas** by the existing `gen-types` pipeline, so types and validation cannot
  drift. Hand-written wrapper types add only the ergonomic layer (function form,
  factory flattening).
- Editor experience: JSON users had `$schema` autocomplete; TS users get strictly more
  — types, inline docs (schema `description` fields become TSDoc), and go-to-definition.

### What replaces `$schema`

| `$schema` role today | v4 replacement |
|---|---|
| Capability module selection | the imported factory (`next()` carries `module`) |
| Config version for `semgrator` upgrades | the installed package version; code configs are never auto-upgraded — breaking config changes are breaking package changes, surfaced by TypeScript |
| Editor autocomplete | TypeScript |
| `?autogenerated=true` marker | gone — zero-config no longer writes files |

The `module` property escape hatch survives inside `application({ module })` for
non-factory capabilities.

### Config-writing tooling

Three code paths write config files today: `wattpm create` (scaffolding),
`wattpm import` (append an application entry), and the CLI's temporary-config fallback.

- **`wattpm create` / `create-wattpm`**: scaffolds `watt.config.ts` (or `.js` on
  request) from templates. Straightforward — generators already template files. The
  generated root config is finally *readable*:

  ```ts
  import { defineConfig } from 'wattpm'

  export default defineConfig({
    server: { port: Number(process.env.PORT ?? 3042) },
    logger: { level: process.env.PLT_SERVER_LOGGER_LEVEL ?? 'info' },
    autoload: { path: 'web' }
  })
  ```

  Per-app scaffold: `export default node()` — or no file at all, since defaults need
  no file.
- **`wattpm import` and other mutators**: use [`magicast`](https://github.com/unjs/magicast)
  (AST-level edit that preserves formatting) to append to the `applications` array when
  the config is code. When the edit is not statically safe (config is a function, or
  the array is computed), print the exact snippet to paste and exit 0 with a notice.
  `magicast` is a devDependency-weight addition to `wattpm-utils` only.
- **Temporary-config fallback** (`fallbackToTemporaryConfigFile`): removed. Zero-config
  boot synthesizes the config in memory; nothing is written into the user's tree.
- `saveConfigurationFile` remains for the legacy JSON path and for machine-managed
  files (`.env`, scaffold output).

### JSON in v4 — and the hard cliff for everything else

JSON does not disappear — it becomes a *serialization of the same single dialect*:

- `watt.json` containing v4-shape config (runtime dialect, no `runtime` block, no
  `$schema` required; `module` allowed per application entry) loads fine. This is the
  story for machine-generated configs and for users who genuinely prefer JSON.
- **There is no compatibility path in the v4 runtime.** v2/v3 shapes and the
  YAML/JSON5/TOML formats are refused outright with an error that names the file and
  says to run `npx wattpm migrate`. The `migrate` command (which bundles the legacy
  parsing/upgrade machinery) is the only code that reads old configs.

This is a deliberate trade: a sharper upgrade cliff in exchange for the largest
possible deletion from the v4 codebase. `replaceEnv` and the `{PLT_X}` interpolation
loop, the YAML brace-quoting pre-pass, `strictEnv` normalization,
`kEnvFileFallbackKeys`, the `$schema` URL regexes and `extractModuleFromSchemaUrl`,
the `web`/`services` alias merging, `wrapInRuntimeConfig`, and the in-hot-path
`semgrator` wiring all move out of `foundation`/`runtime` and into the
`wattpm migrate` implementation (or are deleted). The v4 loader is: find file →
import or `JSON.parse` → validate → transform.

### `wattpm migrate`

A one-shot codemod, shipped in `wattpm-utils`. **Scope: v3-era configs only.** A config
whose detected version is older than 3.0.0 is refused with instructions to upgrade the
project to Platformatic v3 first (whose loader upgrades v1/v2 shapes via its own
`semgrator` chains); v4 carries none of the pre-v3 upgrade machinery.

1. Recursively find all v3 config files from the project root (reusing
   `findConfigurationFileRecursive` + `listRecognizedConfigurationFiles`).
2. Detect the version from `$schema`/`module`; refuse pre-3.0.0 with the
   "upgrade to v3 first" error.
3. For the root: unwrap `runtime` blocks (the `wrapInRuntimeConfig` inversion, applied
   once, at migration time, forever), merge `web`/`services`/`applications`, and emit
   `watt.config.ts` with capability factory imports. `{PLT_X}` placeholders become
   `process.env.PLT_X` references (with `??` defaults pulled from `.env.sample` when
   present).
4. For each app: emit `export default <capability>({ … })` or delete the file when it
   would contain only defaults.
5. Delete the old files (with `--keep` to retain them) and print a diff summary.

Because the v3 loader machinery already parses and understands every v3 shape, the
codemod is mostly plumbing we own. With the hard-cliff decision, `migrate` is also the
*only* home of that machinery in v4 — but only the v3-era slice of it: the
YAML/JSON5/TOML parsers, `replaceEnv`, the v3 `$schema` URL detection, the
`runtime`-block unwrapping, and the alias merging live inside (or are depended on by)
`wattpm migrate` exclusively. The v1/v2 `semgrator` version chains and the legacy
`platformatic.dev/schemas/v*` URL format are **not** carried into v4 at all.

---

## Breaking changes (v4)

1. `runtime` wrapped block in capability configs: **removed** (root options are
   top-level; `wrapInRuntimeConfig`, `wrappedRuntime`, `runtimeUnwrappablePropertiesList`,
   `applicationsUnwrappablePropertiesList`, and `_runtime-in-capabilities.md` are deleted).
2. `web` and `services` aliases: **removed**; `applications` only.
3. `$schema`-based module/version detection: **removed** from the runtime; understood
   only by `wattpm migrate`.
4. `{PLT_X}` interpolation, `strictEnv`, root `envfile`: **removed** from the runtime;
   converted by `wattpm migrate`.
5. YAML/JSON5/TOML configs: **refused** by the runtime; converted by `wattpm migrate`.
6. `verticalScaler`, `healthChecksTimeouts`: removed from the v4 schema (both already
   deprecated/migrated).
7. Auto-written `watt.json` (`?autogenerated=true`): removed.
8. Capability packages must export a factory (added by us to all in-tree capabilities;
   external ones keep working via `application({ module })`).

There is no deprecation window inside v4: old shapes fail fast with an actionable
error (`npx wattpm migrate`). The migration story is the codemod, not a compat layer.

---

## Implementation plan

Roughly ordered; steps 1–4 are the critical path.

1. **foundation**: add `loadCodeConfigurationFile` (import + unwrap + serializability
   check + context injection); teach `findConfigurationFile`/`findConfigurationFileRecursive`
   the new filenames; make `loadEnv` results ambient before code-config evaluation;
   route code configs into `loadConfiguration` skipping `replaceEnv`/`upgrade`. In the
   v4 branch, additionally *remove* `replaceEnv`, the YAML pre-pass, the non-JSON
   parsers, `strictEnv`, and the `$schema` regex machinery from the loader (they move
   under `wattpm migrate`); add the v2/v3-shape detection that produces the
   "run `npx wattpm migrate`" error.
2. **basic**: `defineCapabilityFactory` helper; `ApplicationDefinition` tag symbol;
   flatten/unflatten mapping between factory options and the internal per-app shape;
   worker-side per-app `watt.config.ts` loading in place of the `$schema` scan.
3. **runtime**: delete `wrapInRuntimeConfig` and alias merging; v4 schema pruning;
   accept `ApplicationDefinition` entries in `applications` and bare-definition root
   exports; in-memory zero-config synthesis.
4. **wattpm**: export `defineConfig`, `application`, `requireEnv`, `WattConfig` types;
   type generation from schemas (TSDoc from `description`).
5. **capabilities** (next, node, vite, astro, remix, nest, nitro, react-router,
   tanstack, nuxt, service, db, gateway): add the factory (~20 lines each via the
   helper) + option types.
6. **wattpm-utils**: `wattpm migrate` (absorbing the legacy parsing/upgrade machinery);
   `wattpm import` via magicast with snippet fallback; `create` templates emit
   `watt.config.ts`.
7. **create-wattpm**: wizard output switches to `.ts` (`.js` when the user opts out of
   TypeScript); drop `.env.sample` boilerplate for values now defaulted in code.
8. **docs**: collapse the runtime/capability split pages into one configuration
   reference; migration guide; keep a single legacy-format appendix.

Steps 1–3 land first behind the **gated v3 preview**: the loader and factories ship in
a late v3 minor behind an explicit opt-in (`wattpm dev --experimental-config` or
`PLT_EXPERIMENTAL_CONFIG=true`), enforcing **strict v4 shape** (no `runtime` block, no
aliases honored in code configs), clearly labeled as subject to change. This gives the
factory API real-world contact before v4.0 freezes it, at the cost of maintaining the
v4-shape validation in the v3 branch until the cut.

---

## Resolved decisions

Formerly the open questions; resolved 2026-07-30.

1. **`applications`, not `apps`.** Matches v3 canonical naming, the internal model,
   the management API, and existing docs; the codemod collapses `web`/`services` into
   it. No internal renaming.
2. **Serializable-only config in v4.0.** Non-serializable values are a hard error
   naming the JSON path. Functions remain expressible as file paths loaded worker-side
   (as in v3). Worker-side re-evaluation of per-app config files is designed-for but
   **not publicly committed** — we keep the option for a 4.x minor without promising it.
3. **magicast + snippet fallback for config mutators.** `wattpm import` AST-edits
   `watt.config.ts` when the shape is statically safe (literal `defineConfig` object,
   literal `applications` array); otherwise it prints a paste-ready snippet and exits
   0 with a notice. magicast is a dependency of `wattpm-utils` only.
4. **Gated v3 preview.** Experimental opt-in in a late v3 minor, strict v4 shape, no
   ungated availability before v4.0.
5. **Flattened factory options.** Capability-specific properties are hoisted to the
   factory's top level (`next({ trailingSlash: true })`); orchestration properties and
   shared blocks (`logger`, `cache`, `commands`) sit alongside. The factory owns the
   mapping back to the internal namespaced shape. We accept the permanent
   no-collision discipline between capability and orchestration property names —
   enforced by a test in `basic` that checks every in-tree capability's option keys
   against the orchestration key set.
6. **Hard cliff for legacy formats.** The v4 runtime loads only `watt.config.*` and
   v4-shape `watt.json`. Old shapes and YAML/JSON5/TOML are refused with a
   "run `npx wattpm migrate`" error; the codemod is the only reader of old configs.
   No deprecation window inside v4. **`migrate` supports v3-era configs only** —
   pre-v3 projects must upgrade to Platformatic v3 first; none of the v1/v2 upgrade
   machinery ships in v4.

---

## Appendix A — type sketch

```ts
// wattpm
export interface WattConfig {
  entrypoint?: string
  basePath?: string
  applications?: Array<ApplicationDefinition | ApplicationEntry>
  autoload?: { path: string, exclude?: string[], mappings?: Record<string, ApplicationOverrides> }
  server?: ServerOptions
  logger?: LoggerOptions
  workers?: number | WorkersOptions
  health?: HealthOptions
  healthProbes?: boolean | HealthProbesOptions
  metrics?: boolean | MetricsOptions
  telemetry?: TelemetryOptions
  undici?: UndiciOptions
  httpCache?: boolean | HttpCacheOptions
  gracefulShutdown?: GracefulShutdownOptions
  restartOnError?: boolean | number
  startTimeout?: number
  startupConcurrency?: number
  watch?: boolean
  managementApi?: boolean | ManagementApiOptions
  scheduler?: SchedulerJob[]
  policies?: { deny?: Record<string, string | string[]> }
  preload?: string | string[]
  extensions?: ExtensionEntry[]
  env?: Record<string, string>
  sourceMaps?: boolean
  compileCache?: boolean | CompileCacheOptions
  // …complete list generated from the v4 runtime schema
}

export type ConfigContext = { env: NodeJS.ProcessEnv, production: boolean, root: string }

export function defineConfig (config: WattConfig): WattConfig
export function defineConfig (fn: (ctx: ConfigContext) => WattConfig | Promise<WattConfig>): typeof fn
export function application (entry: GenericApplicationOptions): ApplicationDefinition
export function requireEnv (name: string): string
```

```ts
// @platformatic/next
export interface NextApplicationOptions extends ApplicationOrchestrationOptions {
  // orchestration (shared): id?, path?, workers?, health?, env?, dependencies?, …
  trailingSlash?: boolean
  standalone?: boolean
  useExperimentalAdapter?: boolean
  imageOptimizer?: ImageOptimizerOptions
  cache?: NextCacheOptions
  logger?: LoggerOptions
  commands?: BuildCommands
}
export function next (options?: NextApplicationOptions): ApplicationDefinition
```

## Appendix B — before/after: the wrapped single-app config

**v3 (capability dialect, wrapped runtime):**

```json
{
  "$schema": "https://schemas.platformatic.dev/@platformatic/next/3.65.0.json",
  "next": { "trailingSlash": true },
  "cache": { "adapter": "redis", "url": "{PLT_REDIS_URL}" },
  "runtime": {
    "server": { "hostname": "{PLT_SERVER_HOSTNAME}", "port": "{PORT}" },
    "logger": { "level": "{PLT_SERVER_LOGGER_LEVEL}" },
    "managementApi": "{PLT_MANAGEMENT_API}",
    "application": { "workers": 2 }
  }
}
```

Plus `.env`, `.env.sample`, and the knowledge of which runtime properties are legal in
the wrapped block.

**v4 (one dialect):**

```ts
import { defineConfig } from 'wattpm'
import { next } from '@platformatic/next'

export default defineConfig({
  server: { port: Number(process.env.PORT ?? 3042) },
  logger: { level: 'info' },
  applications: [
    next({
      workers: 2,
      trailingSlash: true,
      cache: { adapter: 'redis', url: process.env.PLT_REDIS_URL }
    })
  ]
})
```

And when this project later joins a monorepo, the `next({ … })` expression moves
verbatim into `web/frontend/watt.config.ts`.
