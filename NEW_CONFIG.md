# NEW_CONFIG: `watt.config.ts` — one config model for Watt v4

**Status:** Proposal, revision 3 — incorporates the adversarial review findings; clean-cut implementation
**Target:** v4 (breaking) — no v3 preview; feedback via v4.0 alphas/RCs
**Author:** Platformatic team

## Summary

Watt v4 replaces the JSON-with-`$schema` configuration system with a single, code-first
configuration format — `watt.config.ts` / `.js` / `.mts` / `.mjs` — loaded natively by
Node.js via type stripping, with full TypeScript types provided by `wattpm` and by each
capability package. **It is the only configuration format**: any `.json` configuration
file found is, by definition, a v3-era file and is refused with an instruction to run
`npx wattpm migrate`.

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
  server: { port: Number(process.env.PORT ?? 3042) },
  logger: { level: 'info' },
  applications: [
    {
      workers: 2,
      config: next({
        trailingSlash: true,
        cache: { adapter: 'redis', url: process.env.REDIS_URL }
      })
    }
  ]
})
```

Everything the JSON system can express remains expressible. The runtime's internal
config model — the normalized object that `transform()` produces and workers consume —
is unchanged; what changes is how it is authored, where it is evaluated, and how it
reaches the workers.

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
  which properties are legal inside it. (The lists are themselves buggy: `applications`
  is excluded twice while `services` is not excluded at all, so `runtime.services` is
  schema-legal today.)
- The same setting lives at different depths depending on project shape. `logger` is
  top-level in a runtime config, `runtime.logger` in a wrapped config, and *also*
  top-level in the capability config as the per-app logger.
- Growing from one app to two forces a full config rewrite: unwrap the `runtime` block,
  invert the nesting, create a new root file. The runtime performs the same inversion
  at boot (`wrapInRuntimeConfig`, `packages/runtime/lib/config.js:131`) — machinery
  that exists only to bridge the two dialects.

### Problem 2 — JSON + `{PLT_X}` interpolation is a poor programming language

- Conditional config (dev vs prod, optional telemetry) is impossible without env-var
  contortions and string-to-boolean coercion rules.
- `{PLT_X}` placeholders are stringly-typed, fail closed to `""`, and need `strictEnv`,
  a YAML brace-quoting pre-pass, and fallback-key machinery — all invisible until it
  bites. The schemas are saturated with `anyOf: [T, string]` unions that exist *only*
  to admit placeholders, poisoning validation and any types generated from them.
- No composition, no reuse, no comments in plain JSON.

### Problem 3 — `$schema` URLs as a versioning and identity mechanism

The `$schema` URL does triple duty: editor autocomplete, capability module selection,
and config version detection. It is verbose, goes stale on every release, exists in
three historical URL formats, and is the thing users most frequently delete or mangle.
In a code-first config, the imported package is the identity, and version markers are
explicit where still needed (see "Machine-generated configs").

### Non-goals

- **The runtime's internal config model** stays. `transform()` output is unchanged.
- **AJV validation** stays authoritative; TypeScript types are an authoring aid.
- **Zero-config boot** stays: `wattpm dev` in a bare Next/Vite/Node repo with no config
  file keeps working via `detectApplicationType`, and v4 stops writing an
  auto-generated `watt.json` into the user's tree — the synthesized config lives only
  in memory.

---

## Goals

1. One configuration dialect and **one configuration format**. The `runtime` wrapped
   block, `wrapInRuntimeConfig`, the `web`/`services` aliases, and all non-code config
   formats are removed.
2. `watt.config.{ts,js,mts,mjs}` loaded with **zero new dependencies** (Node ≥ 22.19
   type stripping is already our floor).
3. Full typed autocomplete backed by **tightened schemas**: the placeholder-string
   unions are audited out in v4.0, so generated types are strict at launch.
4. Single-app → multi-app is a file move; migration never edits `package.json`.
5. Env handling becomes ordinary JavaScript (`process.env`), with `.env` loaded before
   the config file is evaluated and a simplified, documented precedence.
6. A `wattpm migrate` codemod that converts anything that boots on v3 into v4 config
   files automatically.
7. ICC integration points (`setApplicationConfigPatch`, `getRuntimeConfig`) are
   preserved with identical semantics.

---

## The new model

### One dialect, three levels of ceremony

**Level 0 — no config file.** `wattpm dev` in a directory: application type is
auto-detected from `package.json` dependencies, defaults apply. Nothing is written to
disk.

**Level 1 — single app.** One file at the project root (see Summary above). Every
runtime option (`server`, `logger`, `health`, `metrics`, `telemetry`, `undici`,
`httpCache`, `gracefulShutdown`, …) is top-level — exactly where it is in a multi-app
config. **The `runtime` block does not exist in v4.**

**Level 2 — multi-app.** Same shape, more entries. The application entry carries the
orchestration properties; the capability configuration attaches through the entry's
`config` property, which accepts a capability factory call inline (it accepted a file
path in v3):

```ts
// watt.config.ts
import { defineConfig } from 'wattpm'
import { gateway } from '@platformatic/gateway'
import { node } from '@platformatic/node'
import { next } from '@platformatic/next'

const production = process.env.NODE_ENV === 'production'

export default defineConfig({
  entrypoint: 'gateway',
  server: { port: Number(process.env.PORT ?? 3042) },
  logger: { level: production ? 'warn' : 'info' },
  metrics: production && { port: 9090 },

  applications: [
    {
      id: 'gateway',
      path: 'web/gateway',
      config: gateway({
        applications: [
          { id: 'api', proxy: { prefix: '/api' } },
          { id: 'frontend', proxy: { prefix: '/' } }
        ]
      })
    },
    {
      id: 'api',
      path: 'web/api',
      workers: production ? 4 : 1,
      telemetry: { instrumentations: ['pg'] },
      config: node({
        main: 'server.js',
        telemetry: { applicationName: 'api', exporter: { type: 'otlp' } }
      })
    },
    { id: 'frontend', path: 'web/frontend', config: next({ trailingSlash: true }) }
  ]
})
```

Note the boundary: `workers`, `health`, `env`, `dependencies` and the other
orchestration properties live **on the entry**; everything the capability understands
lives **inside the factory**. The two never merge into one bag, which is what keeps
same-named properties (`telemetry` above; `server`, `logger`, `watch`) structurally
unambiguous — the adversarial review showed that flattening them together is unsound
(`telemetry` means two incompatible things for service/db/gateway, and several
capabilities collide even within themselves).

**Level 2b — monorepo with per-app config files.** `autoload` survives, and per-app
configuration moves into the app's own `watt.config.ts`, which exports **the identical
factory expression** that would appear as the entry's `config` at the root:

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

This is the unification punchline: the value of a root entry's `config` and a per-app
file's default export are the same expression. Promoting a standalone project into a
monorepo app means moving that expression — and because the per-app file imports the
capability from the app's own directory, where its dependency already lives, **no
`package.json` changes are ever required** (see "Dependency resolution").

When both a root inline entry and a per-app file exist for the same app id, they are
merged **shallowly, per-key, root winning** — the v3 `autoload.mappings` semantics —
and a root-provided `config` value replaces the per-app file's export wholesale.

### Functional form for environment-dependent config

`defineConfig` also accepts a function, sync or async:

```ts
export default defineConfig(({ env, production, root }) => ({
  server: { port: Number(env.PORT ?? 3042) },
  watch: !production,
  applications: [/* … */]
}))
```

- `env` — `process.env` after `.env` merging (see "Env files").
- `production` — `true` under `wattpm start` / `--production`.
- `root` — absolute directory of the config file.

### Capability factories

Each capability package exports one typed factory plus its option types:

```ts
// from @platformatic/next
export function next (options?: NextConfigOptions): ApplicationDefinition
```

Factory options are the capability's per-app configuration — what lived in the app's
own config file in v3 — with the capability's namespaced block flattened into the top
level (`next.trailingSlash` → `trailingSlash`) and the shared blocks (`logger`,
`server`, `watch`, `cache`, `application`) kept at their v3 positions. The
`application` block deliberately stays nested: several capabilities (remix, nuxt,
nitro, react-router) define their own `outputDirectory` alongside
`application.outputDirectory`, and hoisting both would collide.

Factories do **not** accept orchestration properties; those belong to the application
entry. TypeScript enforces the split in both directions.

The factory returns a plain, JSON-serializable object discriminated by its `module`
property — no symbols, no classes:

```ts
interface ApplicationDefinition {
  module: string          // '@platformatic/next'
  // …normalized per-app configuration (v3-internal shape)
}
```

Duck-typing on `module` (rather than a symbol tag) is deliberate: dependency-free
plain-object configs must be first-class, and symbol identity breaks across duplicated
`@platformatic/basic` copies in non-hoisted layouts. A hand-written
`{ module: '@platformatic/php' }` object is exactly as valid as a factory result —
that is also the escape hatch for capabilities that don't ship a factory:

```ts
applications: [
  { id: 'php', path: 'web/php', config: { module: '@platformatic/php' } }
]
```

Capabilities implement their factory with a helper from `@platformatic/basic`
(`defineCapabilityFactory(module, schema, mapOptions)`), ~20 lines per package.

### Remote apps

Non-capability orchestration entries keep working:

```ts
applications: [
  { id: 'legacy', url: 'https://github.com/org/legacy.git', gitBranch: 'main' }
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

There is no other supported format. When the search finds only a `.json`
configuration file (`watt.json`, `platformatic.json`, or any v3 candidate name), the
runtime exits:

```
✗ watt.json is a v3-era configuration. Watt v4 uses watt.config.ts.
  Run:  npx wattpm migrate
```

This makes legacy detection an extension check — no shape heuristics, no placeholder
scanning. The recursive upward search (`findConfigurationFileRecursive`) keeps its
semantics over the new filenames. The `--config` / `-c` flag accepts any of them.

We use `watt.config.*`, not `watt.ts`, following the `vite.config.ts` /
`next.config.ts` convention and avoiding collisions with app source files.

### Loading mechanism: the eval worker

All configuration is evaluated in a **short-lived evaluation worker thread**, spawned
per load:

1. The eval worker resolves the root, runs `loadEnv` (the `.env` upward walk), and
   applies the result to its own `process.env` — the main process env is never
   touched.
2. It imports the root config (`import(pathToFileURL(path))` — `.ts`/`.mts` via Node's
   built-in type stripping, the same mechanism the runtime already uses for
   `extensions`), unwraps the default export (object, function called with the context
   above, or a bare `ApplicationDefinition` auto-wrapped as
   `{ applications: [{ config: def }] }`), and expands `autoload` by importing **every
   per-app `watt.config.ts` in the same pass**.
3. A `module.register` resolve hook records every file URL the evaluation transitively
   imported.
4. The worker posts back `{ config, importedFiles }` and exits.

The result then enters the pipeline in the main process: **serializability check**
(functions, class instances, symbols → `InvalidConfigValueError` naming the JSON
path) → AJV validation (`useDefaults`, `coerceTypes`) → `kMetadata` attachment →
`transform()`. The check runs before metadata attachment because `kMetadata` is
symbol-keyed and non-JSON by design.

Why a throwaway worker instead of a plain `import()` in the main process: the ESM
module cache is not invalidatable, so same-process re-import would silently return
stale config on every dev reload — and the recorded import list is what lets the
watcher cover helper files (`./config/shared.ts`), not just the root file. It also
isolates `.env` mutation and config crashes/hangs from the main process.

**Config code runs exactly once per load.** Workers never import configuration:

- v3: each worker re-parsed its app's config file (`worker/controller.js`); harmless
  for JSON, wrong for code (an app with `workers: 4` would evaluate user code 5
  times, async configs would fetch secrets 5 times, and views could diverge).
- v4: each app worker receives its fully-resolved config as **data** —
  `applicationConfig.resolvedConfig` in `workerData` replaces the `config` file path.
  The worker controller's file-scanning and `$schema` resolution are deleted.

Consequence to document: per-app config files are evaluated with the *root's*
environment. Per-application `env`/`envfile` configure the worker's runtime
environment, never config evaluation.

**Serializability is the v4.0 contract.** Function-shaped needs (logger transports,
gateway handlers, `deduplication.key`) stay expressible as file paths loaded
worker-side, exactly as in v3. Re-evaluating per-app files inside workers to allow
inline functions remains possible in a later 4.x, but we make no public commitment.

**TypeScript constraints** (Node type stripping): erasable syntax only — no enums,
namespaces, or parameter properties; `tsconfig` `paths` are not applied; `.ts` config
presets cannot be imported from `node_modules`. Scaffolding and `migrate` emit
`watt.config.mts` when the target package has `"type": "commonjs"`, `.ts` otherwise.

### Dependency resolution

Factory imports follow **standard ESM resolution from the importing file** — no
loader hooks, no magic; editor and runtime always agree:

- **Per-app files** import the capability from the app directory, where its dependency
  already lives in v3. Nothing changes for any existing workflow, under any package
  manager. This is the default style: `migrate` and scaffolding emit per-app files
  plus a thin autoload root, so migration never touches `package.json`.
- **Root-inline factories** are a new, opt-in style with one plain rule: the
  capability must be resolvable from the root (add it to the root `package.json`).
  Under pnpm's strict layout an app-local dependency is not visible from the root, so
  the failure gets a targeted error naming both fixes:

  ```
  ✗ Cannot resolve '@platformatic/next' from watt.config.ts.
    Add it to the root package.json, or configure the application in
    web/frontend/watt.config.ts instead.
  ```

Runtime resolution of capability *implementations* (workers loading the capability
from the app's deps, with the runtime-bundled fallback) is unchanged.

### Env files

1. Before config evaluation, the eval worker runs the `.env` upward walk and applies
   the result to its `process.env` (file values never overriding real env). The
   config file just reads `process.env` / the `env` context argument.
2. **Precedence is simplified to two-valued** (a deliberate breaking change):
   `real env > root .env > app .env`. Once loaded, the root `.env` is
   indistinguishable from the real environment, so an application's own `.env` no
   longer overrides root-file defaults (in v3 it could, via the `kEnvFileFallbackKeys`
   machinery, which is deleted). `wattpm migrate` warns for every key present in both
   a root and an app `.env`; the runtime logs a one-time boot warning when an app
   `.env` key is shadowed.
3. Per-application `env` / `envfile` (the worker's runtime environment) are unchanged.
4. `{PLT_X}` interpolation, `strictEnv`, root `envfile`, and the YAML brace-quoting
   pre-pass do not exist in v4; they survive only inside `wattpm migrate`'s legacy
   reader.

### Inter-application URLs

v3 resolved unset `{FOO_URL}` placeholders to `http://<appid>.plt.local` at
config-parse time (`onMissingEnv`). That machinery dies with interpolation, and its
replacement is explicit:

- **In config**: write the literal virtual hostname — `origin: 'http://api.plt.local'`.
  These hostnames are resolved by the mesh at request time; no config-time knowledge
  is needed. `migrate` emits the literal for placeholders whose name matches a
  declared app id, and `process.env.X` otherwise.
- **In application code**: the runtime injects `PLT_<ID>_URL` environment variables
  into every worker (one per sibling application, uppercased id, non-alphanumerics →
  `_`; an explicitly configured variable of the same name wins). Existing app code
  reading `process.env.PLT_API_URL` keeps working.

### Validation, types, and the schema audit

- **AJV stays authoritative**, but the v4 schemas are **audited, not just pruned**.
  Beyond removing `$schema`, root `module`, `runtime` (wrapped block), `web`,
  `services`, `verticalScaler`, and `healthChecksTimeouts`, every `anyOf`/`oneOf`
  union across foundation and the capability schemas (~120 sites) is classified:
  - *placeholder-only unions* (the 14 `overridableValue` sites, `logger.level`'s
    `^\{.+\}$` pattern branch, the string forms of `workers`, `watch`,
    `restartOnError`, …) — **string branch deleted**;
  - *genuine unions* (`managementApi`'s socket-path string, `preload`'s
    string-or-array, `enabled`'s per-environment object) — kept;
  - judgment calls — decided and recorded in the schema.

  v4.0 is the only free moment for this: no v4 configs exist yet, and `migrate` emits
  correctly-typed values (its per-property target-type table is a byproduct of the
  audit). Tightening later would break real configs in minors.
- TypeScript types for `WattConfig` and factory options are **generated from the
  audited schemas** by the existing `gen-types` pipeline (schema `description` fields
  become TSDoc), so types, validation, and docs agree at launch: `workers?: number |
  WorkersOptions`, `level?: 'fatal' | 'error' | …` — no stringly unions.

### Machine-generated configs

There is no JSON config in v4, and none is needed: `defineConfig` is optional and the
loader unwraps any plain-object default export, so a dependency-free generated config
is JSON plus a prefix:

```js
// generated by pack / install / deployment tooling — no imports required
export default {
  $schema: 'https://schemas.platformatic.dev/wattpm/4.0.0.json',
  applications: [{ id: 'api', path: '.', config: { module: '@platformatic/node' } }]
}
```

- The stamped `$schema` **property** is mandatory for machine writers. The loader
  reads it for version detection only (never module selection); a stale v3 URL
  refuses with the migrate hint. This is the version marker that keeps the next
  major's migration tractable.
- Writers converted in v4: `next pack` (bundle config; gains a test asserting the
  bundle boots), the `wattpm install`/external flow (per-app files in cloned repos),
  `wattpm migrate` output, and the documented pattern for ICC-style platforms
  (`'export default ' + JSON.stringify(config)`).
- Reading configs without executing them: the plain-object form is trivially
  AST-parseable, and running systems expose the resolved config via the programmatic
  `runtime.getRuntimeConfig()`. The management API's HTTP `GET /config` endpoint is
  **removed** in v4 (its only known consumer, watt-admin, migrates off it —
  cross-repo coordination noted in the plan).

### Config patching (ICC integration)

- The programmatic API `runtime.setApplicationConfigPatch(id, ops)` /
  `removeApplicationConfigPatch(id)` **survives with identical semantics** — it is
  load-bearing for ICC via watt-extra, which feature-detects and calls it. Under the
  eval-worker design, patches are applied with `fast-json-patch` to the resolved
  per-app object at worker-spawn time instead of worker-side.
- The `wattpm patch-config` CLI command (file rewriting) is **removed**: no consumers
  exist in-tree, in watt-extra, or in icc-3.

### Config-writing tooling

- **`wattpm create` / `create-wattpm`**: scaffolds `watt.config.ts` (`.mts`/`.js`
  variants per the rules above) from templates — a thin autoload root plus per-app
  factory files.
- **`wattpm import`**: edits the root config with **magicast** (AST edit preserving
  formatting) when the shape is statically safe — literal `defineConfig` object,
  literal `applications` array; otherwise prints a paste-ready snippet and exits 0
  with a notice. magicast is a dependency of `wattpm-utils` only. In a configless
  tree, `import` scaffolds a thin autoload root first (replacing the v3
  `?autogenerated=true` marker dance, whose producer and consumer are both gone).
- **Temporary-config fallback** (`fallbackToTemporaryConfigFile`): removed;
  zero-config synthesizes in memory.

### `wattpm migrate`

A one-shot codemod in `wattpm-utils`, and **the only code in v4 that can read legacy
configs**. Scope: anything that boots on v3. To guarantee that without forking any
machinery, `wattpm-utils@4` depends on **`@platformatic/foundation@3`** (and the v3
upgrade chains) and runs the real v3 `loadConfiguration` — all formats (JSON, JSON5,
YAML, TOML), all `$schema` URL generations, and the v1/v2→v3 `semgrator` upgrades,
exactly as production v3 applies them in memory. Then:

1. Emit per-app `watt.config.ts` files (factory expression per app; file omitted when
   it would contain only defaults) and a thin root `watt.config.ts` — unwrapping
   `runtime` blocks (treating the schema-accidental `runtime.services` like
   `runtime.applications`, with a warning), merging the `web`/`services`/`applications`
   aliases, and converting `{PLT_X}` placeholders into typed values:
   `process.env.PLT_X` references with `??` defaults from `.env.sample`, wrapped per
   the audit's target-type table (`Number(...)`, boolean tests), or literal
   `http://<id>.plt.local` for app-id URL placeholders.
2. Warn for every `.env` key defined in both the root and an app `.env` (the
   two-valued precedence change).
3. Scan application sources for references to the config files about to be deleted
   (v3 scaffolded test helpers do
   `JSON.parse(await readFile(…, 'watt.json'))`): any hit downgrades that file's
   deletion to a warning with the file/line of the reference, since the codemod
   cannot safely rewrite user code.
4. Delete the unreferenced old files (`--keep` to retain all) and print a diff
   summary.

Because migration emits the per-app style, it never edits `package.json`.

---

## Breaking changes (v4)

1. `runtime` wrapped block in capability configs: **removed** (`wrapInRuntimeConfig`,
   `wrappedRuntime`, both exclusion lists, and `_runtime-in-capabilities.md` deleted).
2. `web` and `services` aliases: **removed**; `applications` only.
3. **All non-code config formats removed** — JSON included. Any `.json` config file is
   refused with the migrate hint. `getParser`/`getStringifier` and the format
   machinery are deleted from the loader.
4. `{PLT_X}` interpolation, `strictEnv`, root `envfile`: **removed**; `wattpm migrate`
   converts them.
5. `.env` precedence simplifies to `real env > root .env > app .env`; app `.env` no
   longer overrides root-file defaults (`kEnvFileFallbackKeys` deleted; migrate + boot
   warnings cover the transition).
6. `verticalScaler`, `healthChecksTimeouts`: removed from the v4 schema.
7. Schema audit: placeholder-string unions removed from every schema (validation is
   stricter; migrate emits typed values).
8. Auto-written `watt.json` (`?autogenerated=true`): removed.
9. `wattpm patch-config` (CLI): removed. The programmatic
   `setApplicationConfigPatch` API stays.
10. Management API `GET /config` endpoint: removed (watt-admin coordination required).
11. Worker boot protocol: workers receive `resolvedConfig` (data) instead of a config
    file path; per-worker config parsing is deleted.
12. Capability packages should export a factory (all in-tree capabilities get one);
    plain `{ module }` objects cover the rest.

There is no deprecation window inside v4: old shapes fail fast with an actionable
error. The migration story is the codemod, not a compat layer.

---

## Implementation plan

Roughly ordered; steps 1–5 are the critical path.

1. **foundation — a fresh loader, not a refactor.** The v4 loader is written new for
   v4: the eval-worker (fresh ESM cache per load, `.env` applied in-worker,
   import-graph collection via `module.register`), filename resolution, the `.json` →
   migrate-hint error, and the serializability check → validate → `kMetadata` →
   `transform` pipeline are a clean implementation with its own tests. The v3
   `configuration.js` (parsers, `replaceEnv`, YAML pre-pass, `strictEnv`, `$schema`
   URL machinery) is **deleted wholesale in the v4 branch, not incrementally carved
   down** — it lives on only in the v3 branch, where `wattpm migrate` consumes it via
   the `@platformatic/foundation@3` dependency. Only deliberately-kept pieces are
   carried over as code (AJV custom keywords, `loadEnv`'s upward walk, `transform`
   hooks), each by explicit decision rather than by surviving a refactor.
2. **Schema audit** (foundation + all capabilities): classify ~120 union sites, delete
   placeholder-only branches, regenerate `schema.json` + types; produce the
   per-property target-type table for migrate.
3. **basic**: `defineCapabilityFactory`; duck-typed `ApplicationDefinition`
   (`module` property, no symbols); capability-block flattening with `application`
   kept nested; delete worker-side config resolution.
4. **runtime**: delete `wrapInRuntimeConfig` and alias merging; entry `config`
   accepts inline definitions; single-pass evaluation incl. autoload'd per-app files;
   `resolvedConfig` through `workerData`; `setApplicationConfigPatch` applied
   pre-spawn via `fast-json-patch`; `PLT_<ID>_URL` injection into worker envs; remove
   `GET /config` from the management API; shallow root-wins merge (v3 semantics);
   in-memory zero-config synthesis.
5. **wattpm**: export `defineConfig`, `WattConfig` and factory types generated from
   the audited schemas.
6. **capabilities** (next, node, vite, astro, remix, nest, nitro, react-router,
   tanstack, nuxt, service, db, gateway): factory + option types (~20 lines each via
   the helper); `next pack` emits the plain-object v4 form + bundle boot test.
7. **wattpm-utils**: `wattpm import` via magicast with snippet fallback;
   external/install flow emits v4 per-app files; `create` templates emit
   `watt.config.ts`; remove `patch-config`. **`wattpm migrate` lives here too but is
   decoupled from the v4 critical path**: it is the only code depending on
   `@platformatic/foundation@3`, it shares nothing with the v4 loader, and it can be
   developed and released on its own cadence — v4.0 of the runtime does not block on
   it (though shipping them together remains the goal for launch messaging).
8. **create-wattpm + generators**: wizard output switches to `.ts` (`.mts`/`.js` per
   package type); scaffolded test helpers import the config module instead of
   `JSON.parse`-ing `watt.json`; fixture conversion codemod for the ~868 in-tree
   JSON fixtures.
9. **cross-repo**: watt-admin migrates off `GET /config`; ICC guidance for generating
   plain-object configs.
10. **docs**: one configuration reference; migration guide; erasable-TS constraints;
    env precedence; the machine-generated config pattern.

There is **no v3 preview**: nothing ships on the v3 branch (clean cut). Real-world
contact for the factory API comes from v4.0 alphas and release candidates, which are
cheap to iterate because the loader is new code with no v3 entanglement.

---

## Resolved decisions

First round (2026-07-30), amended by the adversarial review round (2026-07-31).

1. **`applications`, not `apps`.** Matches v3 canonical naming, the internal model,
   and existing docs.
2. **Serializable-only config in v4.0.** Functions stay file paths; worker-side
   re-evaluation kept open for 4.x, not publicly committed.
3. **magicast + snippet fallback** for config mutators (`wattpm-utils` only).
4. **No v3 preview** (supersedes the earlier gated-preview decision, 2026-07-31):
   clean cut — nothing ships on the v3 branch; v4.0 alphas/RCs are the feedback loop.
5. **Factory shape (amended by review B1):** orchestration properties live on the
   application entry; the entry's `config` property accepts a factory result inline;
   the factory carries only per-app capability configuration, with the capability
   block flattened and `application` kept nested. Root `config` wins wholesale over a
   per-app file.
6. **Hard cliff (amended):** v4 loads only `watt.config.{ts,js,mts,mjs}`. **JSON is
   dropped entirely** — machine writers emit dependency-free plain-object configs
   with a mandatory stamped `$schema` property (version detection only). Any `.json`
   config = legacy = migrate hint; detection is an extension check.
7. **Migrate scope (amended by review B3):** anything that boots on v3, via a
   dependency on the real v3 loader (`@platformatic/foundation@3`); the v1/v2
   upgrade chains ride along inside the codemod only. Migrate lives in
   `wattpm-utils` but is **decoupled from the v4 critical path** — it shares no code
   with the v4 loader and does not block the v4.0 release.
8. **Config reload (review B2):** throwaway eval worker per load; import-graph
   collection drives the watcher; main-process env and module cache are never touched.
9. **Evaluation site (review M3):** single main-side pass in the eval worker; workers
   receive `resolvedConfig` as data and never import config.
10. **Env (review M1/M2):** two-valued precedence (`real env > root .env > app .env`),
    fallback-keys machinery deleted, migrate + boot warnings; inter-app URLs are
    literal `http://<id>.plt.local` in config plus injected `PLT_<ID>_URL` worker env
    vars for application code.
11. **Patching (review M4):** `setApplicationConfigPatch` API preserved (ICC/watt-extra
    depends on it), applied pre-spawn; `patch-config` CLI removed (zero consumers
    found); management API `GET /config` removed.
12. **Schema audit in v4.0 (review M7):** all placeholder unions out at launch; the
    only free moment.
13. **Dependency resolution (review M5):** standard ESM from the importing file;
    per-app files are the default style (v3 placement unchanged, migration never
    edits `package.json`); root-inline is opt-in with a targeted error.
14. **Fresh loader implementation (2026-07-31):** the v4 loader is written new, with
    its own tests; v3's `configuration.js` is deleted in v4, never refactored. Pieces
    worth keeping (AJV keywords, `loadEnv` walk, `transform` hooks) are carried over
    by explicit decision.
15. **Mechanical batch (review m1–m6):** erasable-TS constraints documented +
    `.mts`-for-CJS rule; corrected pipeline order; shallow root-wins merge; duck-typed
    `module` discriminator; `runtime.services` handled by migrate + v3-branch list
    fix; `import` scaffolds a root config in configless trees.

---

## Appendix A — type sketch

```ts
// wattpm
export interface WattConfig {
  entrypoint?: string
  basePath?: string
  applications?: ApplicationEntry[]
  autoload?: { path: string, exclude?: string[], mappings?: Record<string, ApplicationEntryOverrides> }
  server?: ServerOptions
  logger?: RuntimeLoggerOptions
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
  managementApi?: boolean | string | ManagementApiOptions
  scheduler?: SchedulerJob[]
  policies?: { deny?: Record<string, string | string[]> }
  preload?: string | string[]
  extensions?: ExtensionEntry[]
  env?: Record<string, string>
  sourceMaps?: boolean
  compileCache?: boolean | CompileCacheOptions
  // …complete list generated from the audited v4 runtime schema
}

export interface ApplicationEntry {
  id?: string
  path?: string
  url?: string
  gitBranch?: string
  config?: ApplicationDefinition          // factory result, plain { module } object
  workers?: number | ApplicationWorkersOptions
  health?: ApplicationHealthOptions
  env?: Record<string, string>
  envfile?: string
  dependencies?: string[]
  telemetry?: { instrumentations?: InstrumentationEntry[] }
  preload?: string | string[]
  nodeOptions?: string
  permissions?: PermissionsOptions
  packageManager?: 'npm' | 'pnpm' | 'yarn'
  // …
}

export type ConfigContext = { env: NodeJS.ProcessEnv, production: boolean, root: string }

export function defineConfig (config: WattConfig): WattConfig
export function defineConfig (fn: (ctx: ConfigContext) => WattConfig | Promise<WattConfig>): typeof fn
```

```ts
// @platformatic/next — factory options are per-app capability config ONLY
export interface NextConfigOptions {
  trailingSlash?: boolean          // flattened from the v3 `next` block
  standalone?: boolean
  useExperimentalAdapter?: boolean
  imageOptimizer?: ImageOptimizerOptions
  cache?: NextCacheOptions
  logger?: AppLoggerOptions        // shared blocks at v3 positions
  server?: AppServerOptions
  watch?: WatchOptions
  application?: BuildableApplicationOptions   // nested on purpose (outputDirectory)
}
export function next (options?: NextConfigOptions): ApplicationDefinition
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

**v4 (one dialect, one format):**

```ts
import { defineConfig } from 'wattpm'
import { next } from '@platformatic/next'

export default defineConfig({
  server: { port: Number(process.env.PORT ?? 3042) },
  logger: { level: 'info' },
  applications: [
    {
      workers: 2,
      config: next({
        trailingSlash: true,
        cache: { adapter: 'redis', url: process.env.PLT_REDIS_URL }
      })
    }
  ]
})
```

And when this project later joins a monorepo, the `next({ … })` expression moves
verbatim into `web/frontend/watt.config.ts` as its default export — no dependency
moves, no dialect change.
