# NEW_CONFIG: `watt.config.ts` — one config model for Watt v4

**Status:** Proposal, revision 4 — incorporates two adversarial review rounds; clean-cut implementation
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
- `production` — `true` under `wattpm start` / `--production` **and under
  `wattpm build`** (build produces production artifacts, so the config must take
  the production branch).
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
that is also the escape hatch for **v4-contract capabilities** that don't ship a
factory — the capability must still implement the v4 create contract (accepting
resolved config as data). Capabilities that were never updated past the v3 contract
(whose `create(root, configPath)` re-loads a config *file* itself) are unsupported
in v4, factory or not:

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

The runtime half of `wattpm resolve` (cloning, `resolvedApplicationsBasePath`) is
unchanged. Its config-writing half changes: v3 wrote `{PLT_APPLICATION_X_PATH}`
placeholder entries plus `.env` lines; v4 writes literal relative paths into the
config (an env-var indirection would be a non-literal expression, outside
magicast's safe shape, for no benefit).

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
scanning. The `--config` / `-c` flag accepts any of the four names.

We use `watt.config.*`, not `watt.ts`, following the `vite.config.ts` /
`next.config.ts` convention and avoiding collisions with app source files.

**Root and per-app files share the same filename; the export discriminates.** The
classification rules, in precedence order:

1. a **function** export is always a root config (factories return objects);
2. an object with `module` is an `ApplicationDefinition` (per-app);
3. an object with `applications`, `autoload`, or `entrypoint` is a root config;
4. an object with both `module` and a root-only key is an **error**;
5. an empty/other object is a root config (all defaults).

**The upward walk evaluates candidates.** v3's walk read each candidate's `$schema`
to skip capability configs and keep climbing to the runtime root; v4 gets the same
behavior by classifying each candidate in the eval worker: an app-def export means
"inside an application — keep climbing". `cd web/api && wattpm dev` therefore boots
the whole runtime, exactly as v3 did. The eval worker caches classification
evaluations, so a per-app file classified during the walk is **not** re-evaluated by
the root's discovery pass — config code still runs once per load.

**When the walk finds only app-defs and no root** (a bare-export single-app repo, or
a monorepo whose root config is missing), the **topmost** app-def is auto-wrapped as
`{ applications: [{ config: def }] }` and booted. When that file sits at the walk
boundary itself — the expected single-app layout — this is silent; otherwise a
prominent warning is printed:

```
⚠ no root configuration found above web/api — booting 'api' standalone
```

Topmost (not nearest-cwd) so the outcome doesn't depend on which subdirectory the
command runs from.

**The walk stops at the repository/workspace boundary**: the first directory
containing `.git`, a `package.json` with `workspaces`, or `pnpm-workspace.yaml`.
Because v4 walking means *executing* candidate files, a stray `~/watt.config.ts`
must be structurally unreachable from inside a project — no prompt, no trust store.
If no boundary marker exists anywhere (bare container images), the walk falls back
to the full v3 reach. The `.env` walk uses the same boundary for consistency;
`--config` / `--env` are the escape hatches for above-boundary layouts.

### Loading mechanism: the eval worker

All configuration is evaluated in a **short-lived evaluation worker thread**, spawned
per load:

1. The eval worker resolves the root, runs `loadEnv` (the `.env` upward walk), and
   applies the result to its own `process.env` — the main process env is never
   touched.
2. It imports the root config (`import(pathToFileURL(path))` — `.ts`/`.mts` via Node's
   built-in type stripping, the same mechanism the runtime already uses for
   `extensions`), unwraps the default export (object, function called with the context
   above, or a bare `ApplicationDefinition` auto-wrapped per the walk rules above),
   expands `autoload`, and loads per-app `watt.config.ts` files **uniformly for every
   application entry that has a `path` and no inline `config`** — explicitly-listed
   entries and autoloaded ones behave identically, as in v3. It then validates each
   app's capability config against the capability's schema (imported via a light
   subpath export, e.g. `@platformatic/next/schema`, with `resolvePath` resolving
   against that app's root).
3. A **`module.registerHooks`** resolve hook (the synchronous API — the async
   `module.register` variant does not intercept `require()`, and a `watt.config.js`
   in a `"type": "commonjs"` package is CJS) records every file the evaluation
   transitively imported or required.
4. The worker posts back `{ config, importedFiles, env }` and exits. `env` is the
   **pre-evaluation `loadEnv` snapshot** (real environment merged with the root
   `.env`) — the runtime seeds every app worker's environment from it, exactly as v3
   seeded from `kMetadata.env`. After evaluation the worker diffs its live
   `process.env` against that snapshot: mutated keys produce a boot warning naming
   each key and its origin, pointing at the explicit `env:` property as the
   sanctioned cross-boundary channel:

   ```
   ⚠ watt.config.ts mutated process.env during evaluation; these keys do NOT
     propagate to applications:
       CACHE_PREFIX                 (watt.config.ts:8)
       OTEL_EXPORTER_OTLP_ENDPOINT  (import of @vendor/telemetry-sdk)
     Use: defineConfig({ env: { CACHE_PREFIX: … } })
   ```

   Mutations still work *within* the evaluation (it's one thread, one env); they
   just never silently cross into the runtime. Third-party import side effects warn
   rather than fail. `--debug-config` applies the same diff and warning in-process.

The result then enters the pipeline in the main process: **serializability check**
(functions, class instances, symbols → `InvalidConfigValueError` naming the JSON
path) → AJV validation (`useDefaults`, **`coerceTypes: false`**) → `kMetadata`
attachment → `transform()`. The check runs before metadata attachment because
`kMetadata` is symbol-keyed and non-JSON by design. Coercion is disabled in v4: its
only justification was placeholder strings, and on the genuine unions that survive
the audit (`boolean | number`, `boolean | object`) AJV coercion is a documented
hazard in this very codebase (`runtime/lib/config.js:490` warns that `2` would be
coerced to `true`). The audit also guarantees that schema-injected defaults are
themselves serializable.

Why a throwaway worker instead of a plain `import()` in the main process: the ESM
module cache is not invalidatable, so same-process re-import would silently return
stale config on every dev reload — and the recorded import list is what lets the
watcher cover helper files (`./config/shared.ts`), not just the root file. It also
isolates `.env` mutation and config crashes/hangs from the main process.

The costs are real and accepted: one worker spawn + type stripping per load
(order tens of milliseconds), paid at boot and on each dev reload — and CLI
dispatch must be careful not to evaluate config eagerly when only metadata is
needed. Debuggability gets an explicit escape hatch, since a throwaway thread dies
before an inspector can attach: `--debug-config` evaluates the config **in-process**
(accepting one-shot cache semantics) so breakpoints and `--inspect-brk` work, and
prints the fully resolved configuration.

**Object config sources skip the eval worker.** The programmatic API
(`create(root, configObject)`) and the zero-config in-memory synthesis pass an
object, not a file: for those, the same pipeline runs main-side with no import
step, and `loadEnv` builds the env map without mutating the main process's
`process.env`.

**Config code runs exactly once per load, and workers never import config *files* —
but the capability pipeline is split deliberately:**

- v3: each worker re-parsed, validated, *and transformed* its app's config file
  (`worker/controller.js`); harmless for JSON, wrong for code (an app with
  `workers: 4` would evaluate user code 5 times, async configs would fetch secrets 5
  times, and views could diverge).
- v4: **user config code** (root + per-app files) evaluates once, main-side; each
  app worker receives the **validated raw** capability config as data —
  `applicationConfig.resolvedConfig` in `workerData` replaces the `config` file
  path, and the worker controller's file-scanning and `$schema` resolution are
  deleted. The **capability `transform`** — deterministic capability code, not user
  config — still runs worker-side as in v3, where its context lives
  (`telemetryConfig`, watch flags). This keeps capability imports off the eval
  worker's path and, crucially, preserves patch semantics (below).

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
   machinery, which is deleted). The transition warning lives in **migrate only**:
   `wattpm migrate` statically diffs the root `.env` against every application
   `.env` and warns per conflicting key (suppressing keys whose values are equal).
   The runtime carries zero provenance and never warns — after migration, the
   two-valued precedence is simply the documented rule.
3. Per-application `env` / `envfile` (the worker's runtime environment) are unchanged.
4. `{PLT_X}` interpolation, `strictEnv`, root `envfile`, and the YAML brace-quoting
   pre-pass do not exist in v4; they survive only inside `wattpm migrate`'s legacy
   reader.

### Inter-application URLs

v3's behavior here was subtler than commonly understood: when a *worker* parsed its
app's config, any unset `{FOO_URL}` placeholder — regardless of the key name —
resolved to the URL of **the app being parsed** (`fetchApplicationUrl` ignores the
key and returns the current app's `.plt.local` URL,
`worker/controller.js:31-37`); in the *root* config, unset placeholders resolved to
`''`. That machinery dies with interpolation, and its replacement is explicit and
deliberately saner:

- **In config**: write the literal virtual hostname — `origin: 'http://api.plt.local'`.
  These hostnames are resolved by the mesh at request time; no config-time knowledge
  is needed. `migrate` emits the literal for placeholders whose name matches a
  declared app id, and `process.env.X` otherwise — and because this key-name-based
  rule is a *behavior change* from v3's current-app resolution, migrate emits a
  warning for every `*_URL` placeholder it rewrites so the mapping can be reviewed.
- **In application code**: the runtime injects `PLT_<ID>_URL` environment variables
  into every worker (one per sibling application, uppercased id, non-alphanumerics →
  `_`). Existing app code reading `process.env.PLT_API_URL` keeps working. The
  precedence ladder is explicit:

  ```
  real environment  >  env block  >  injected  >  .env files
  ```

  The runtime skips injection when the key exists in its **own real environment**
  (container/k8s overrides work, with zero provenance machinery — the runtime's
  `process.env` *is* the oracle); the injected mesh URL overrides anything sourced
  from a `.env` file, which makes the `PLT_*_URL` lines v3 generators wrote into
  root `.env` files structurally harmless; the explicit `env` block, applied last,
  beats injection and is the sanctioned override. Topology variables are
  deliberately not `.env`-configurable. Two application ids normalizing to the same
  variable name (`api-v2` and `api_v2` → `PLT_API_V2_URL`) is a **boot-time config
  error** naming both ids.

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
  load-bearing for ICC via watt-extra, which feature-detects and calls it. The split
  pipeline preserves the patch document shape exactly: workers apply `configPatch`
  to the **raw, pre-transform** config at the start of the capability transform,
  precisely where `basic`'s transform applies it in v3 — ICC patch documents are
  byte-compatible, no rewrite needed.
- The `wattpm patch-config` CLI command (file rewriting) is **removed**: no consumers
  exist in-tree, in watt-extra, or in icc-3.

### CLI commands over config

- **`wattpm config`** is **removed**; `--debug-config` is the local inspection tool.
- **`wattpm applications:add` / `applications:remove`** keep their live half —
  hot-adding/removing apps on the running runtime via `POST`/`DELETE /applications`,
  which no ruling touches. The runtime root they need for path resolution comes from
  the existing `GET /metadata` endpoint (extended with `root`/`configPath`). The
  `--save` flag is **dropped**: persistence is a manual edit of the readable code
  config, and the commands print an informational hint after the live change.
- **Capability CLI commands** (`db:migrations:apply`, `db:seed`, `db:types`,
  `gateway:*`, `next:*`) move to a **data contract**: `createCommands` becomes part
  of the v4 capability contract, and each command receives `{ root, config }` — the
  app's resolved raw config from the eval pass — instead of a config file path.
  Commands never self-load config (db's `loadConfiguration` call and its
  `utimesSync` restart hack are deleted; the restart signal is a management-API
  restart when a runtime is running). Discovery is **lazy**: config is evaluated
  only when the typed command actually matches `<namespace>:<command>` and isn't a
  builtin, or on per-app help — plain `wattpm help` is static and never executes
  user code.

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
configs**. Scope: anything that boots on v3. To guarantee that, the **complete v3
closure** is vendored under `lib/migrate/legacy/` when it is deleted from the live
packages — and the closure is larger than foundation alone:

- foundation's machinery: the parsers for all formats (JSON, JSON5, YAML, TOML),
  `replaceEnv` and the YAML brace pre-pass, all `$schema` URL generations;
- the four `semgrator` upgrade chains (from `runtime`, `service`, `db`, and
  `gateway` — including v1/v2→v3);
- **frozen v3 snapshots of the ~13 capability schemas and their transforms** —
  required because "loading as production v3" means capability-schema validation
  (defaults injection, `resolvePath`/`resolveModule`) and capability transforms
  (db resolving migration/type paths, next/vite computing directories), and the
  live v4 packages ship *audited, changed* schemas the frozen reader cannot borrow.

Everything moves with its existing tests, not rewritten. There is no dependency on
any v3-versioned package: the monorepo contains exactly one copy, living next to its
only consumer, frozen and CI'd for the life of v4. (Independently of migrate: the
gateway's *request-time* use of `replaceEnv` in `gateway/lib/capability.js` is
rewritten in the v4 gateway — that call cannot be relocated.) Migrate loads a config
exactly as production v3 would in memory, then:

1. Emit per-app `watt.config.ts` files (factory expression per app; file omitted when
   it would contain only defaults) and a thin root `watt.config.ts` — unwrapping
   `runtime` blocks (treating the schema-accidental `runtime.services` like
   `runtime.applications`, with a warning), merging the `web`/`services`/`applications`
   aliases, and converting `{PLT_X}` placeholders into typed values:
   `process.env.PLT_X` references with `??` defaults from `.env.sample`, wrapped per
   the audit's target-type table (`Number(...)`, boolean tests), or literal
   `http://<id>.plt.local` for app-id URL placeholders. `{PLT_ROOT}` gets its own
   rule: `{PLT_ROOT}/x` becomes `join(import.meta.dirname, 'x')` (adding the
   `node:path` import) — correct in migrate's per-app output, where
   `import.meta.dirname` *is* the app root; the docs flag that the expression must
   be rewritten if later moved into a root-inline entry.
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
   longer overrides root-file defaults (`kEnvFileFallbackKeys` deleted; the migrate
   static diff is the transition warning — the runtime never warns).
6. `verticalScaler`, `healthChecksTimeouts`: removed from the v4 schema.
7. Schema audit: placeholder-string unions removed from every schema (validation is
   stricter; migrate emits typed values).
8. Auto-written `watt.json` (`?autogenerated=true`): removed.
9. `wattpm patch-config` (CLI): removed. The programmatic
   `setApplicationConfigPatch` API stays, with byte-compatible patch documents
   (applied pre-transform, as in v3).
9a. `wattpm config`: removed (`--debug-config` is the local inspection tool).
9b. `wattpm applications:add`/`applications:remove`: the `--save` flag is removed
    (live hot-add/remove unchanged).
9c. Capability CLI commands (`db:*`, `gateway:*`, `next:*`): the `createCommands`
    contract changes from config-file-path to `{ root, config }` data; commands no
    longer self-load config, and the `utimesSync` restart trick is replaced by a
    management-API restart.
10. Management API `GET /config` and `GET /api/v1/applications/:id/config`
    endpoints: removed (watt-admin coordination required; the `wattpm` commands
    built on them are handled per items 9a–9c).
11. Worker boot protocol: workers receive `resolvedConfig` (data) instead of a config
    file path; per-worker config parsing is deleted. Everything typed as
    "config file path" changes accordingly: the application entry's `config`
    property no longer accepts a path (it takes an inline definition),
    `autoload.mappings[].config` (a filename) is removed, and
    `getApplicationDetails` payloads carry the resolved object instead of a path —
    a type change for every management-API consumer.
12. Capability packages must implement the v4 create contract (resolved config as
    data) and should export a factory (all in-tree capabilities get both); plain
    `{ module }` objects cover v4-contract capabilities without factories.
    Capabilities frozen on the v3 contract are unsupported.
13. Validation runs with `coerceTypes: false`: values that relied on AJV coercion
    (`"4"` as a number, `1` as a boolean) are rejected with precise errors.

There is no deprecation window inside v4: old shapes fail fast with an actionable
error. The migration story is the codemod, not a compat layer.

---

## Implementation plan

Roughly ordered; steps 1–5 are the critical path.

1. **foundation — a fresh loader, not a refactor.** The v4 loader is written new for
   v4: the eval-worker (fresh ESM cache per load, `.env` applied in-worker,
   import-graph collection via `module.registerHooks`, the collected graph wired
   into the dev watcher), filename resolution, the `.json` → migrate-hint error, and
   the serializability check → validate → `kMetadata` → `transform` pipeline are a
   clean implementation with its own tests. The v3
   `configuration.js` (parsers, `replaceEnv`, YAML pre-pass, `strictEnv`, `$schema`
   URL machinery) is **deleted from foundation in the v4 branch, not incrementally
   carved down** — it is moved, with its tests, into `wattpm-utils` as `migrate`'s
   private legacy reader. Only deliberately-kept pieces are
   carried over as code (AJV custom keywords, `loadEnv`'s upward walk, `transform`
   hooks), each by explicit decision rather than by surviving a refactor.
2. **Schema audit** (foundation + all capabilities): classify ~120 union sites, delete
   placeholder-only branches, regenerate `schema.json` + types; produce the
   per-property target-type table for migrate.
3. **basic**: `defineCapabilityFactory`; duck-typed `ApplicationDefinition`
   (`module` property, no symbols); capability-block flattening with `application`
   kept nested; delete worker-side config *file* resolution (the capability
   `transform` + pre-transform `configPatch` application stay worker-side).
4. **runtime**: delete `wrapInRuntimeConfig` and alias merging; entry `config`
   accepts inline definitions; single-pass evaluation with uniform per-app file
   discovery (autoload and explicit entries alike) and walk-boundary/classification
   rules; `resolvedConfig` (validated raw) through `workerData`; `PLT_<ID>_URL`
   injection with the `real env > env block > injected > .env` ladder and the
   id-normalization collision error; remove `GET /config` and
   `GET /applications/:id/config`, extend `GET /metadata` with `root`/`configPath`;
   shallow root-wins merge (v3 semantics); in-memory zero-config synthesis; lazy
   capability-command dispatch (no config evaluation on plain `wattpm help`).
5. **wattpm**: export `defineConfig`, `WattConfig` and factory types generated from
   the audited schemas; `wattpm dev` watches the eval worker's collected import
   graph; `--debug-config` in-process evaluation escape hatch; `build` evaluates
   with `production: true`.
6. **capabilities** (next, node, vite, astro, remix, nest, nitro, react-router,
   tanstack, nuxt, service, db, gateway): factory + option types (~20 lines each via
   the helper); light schema subpath exports (`@platformatic/<x>/schema`) for
   eval-worker validation; `createCommands` moves to the `{ root, config }` data
   contract (db drops its self-loading and `utimesSync`); the gateway's request-time
   `replaceEnv` call is rewritten; `next pack` emits the plain-object v4 form +
   bundle boot test.
7. **wattpm-utils**: `wattpm import` via magicast with snippet fallback;
   external/install flow emits v4 per-app files; `create` templates emit
   `watt.config.ts`; remove `patch-config`. **`wattpm migrate` lives here too but is
   decoupled from the v4 critical path**: it hosts the vendored v3 closure
   (foundation machinery, the four upgrade chains, frozen snapshots of the ~13
   capability schemas and transforms, with their tests) as private code, shares
   nothing with the v4 loader, and can be developed and released on its own cadence
   — v4.0 of the runtime does not block on it (though shipping them together remains
   the goal for launch messaging).
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
7. **Migrate scope (amended by review B3; relocation ruling 2026-07-31):** anything
   that boots on v3. The v3 loading/upgrade machinery (all parsers, `replaceEnv`,
   `$schema` detection, the full `semgrator` chains) is **moved into `wattpm-utils`**
   with its tests when it is deleted from `foundation` — no dependency on any
   v3-versioned package, one copy in the monorepo, frozen as a legacy reader.
   Migrate is decoupled from the v4 critical path and does not block the v4.0
   release.
8. **Config reload (review B2):** throwaway eval worker per load; import-graph
   collection drives the watcher; main-process env and module cache are never touched.
9. **Evaluation site (review M3):** single main-side pass in the eval worker; workers
   receive `resolvedConfig` as data and never import config *files* (refined by
   round-2 decision 17: capability transforms stay worker-side).
10. **Env (review M1/M2):** two-valued precedence (`real env > root .env > app .env`),
    fallback-keys machinery deleted (warning policy refined by round-2 decision 21);
    inter-app URLs are literal `http://<id>.plt.local` in config plus injected
    `PLT_<ID>_URL` worker env vars for application code (ladder in round-2
    decision 22).
11. **Patching (review M4):** `setApplicationConfigPatch` API preserved (ICC/watt-extra
    depends on it), applied pre-transform worker-side (round-2 decision 17);
    `patch-config` CLI removed (zero consumers found); management API `GET /config`
    removed.
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

Second review round (2026-07-31).

16. **Root/per-app discrimination (round-2 B1):** one filename; the export
    discriminates via specified duck-typing precedence; the walk evaluates
    candidates (with a classification cache) and climbs past app-defs, preserving
    `cd web/api && wattpm dev`; no root found → auto-wrap the **topmost** app-def
    with a loud standalone warning; the walk stops at the `.git`/workspace boundary
    (full v3 reach only when no marker exists).
17. **Split capability pipeline (round-2 B2):** eval worker validates capability
    configs (schema subpath exports, app-root `resolvePath`); capability
    `transform` + pre-transform `configPatch` stay worker-side — ICC patch
    documents byte-compatible.
18. **Config commands (round-2 M1):** `wattpm config` removed; `applications:add`/
    `remove` keep the live half, drop `--save`; `GET /metadata` extended with
    `root`/`configPath`.
19. **Capability CLI commands (round-2 M2):** `createCommands` moves to the
    `{ root, config }` data contract; no self-loading, no `utimesSync`; lazy
    discovery — plain `wattpm help` never executes user code.
20. **Eval protocol env (round-2 M3):** `{ config, importedFiles, env }` with the
    pre-evaluation `loadEnv` snapshot; config-time `process.env` mutations are
    diffed and warned, never propagated; `env:` property is the explicit channel.
21. **Shadow warning (round-2 M4):** migrate-time static `.env` diff only; the
    runtime carries zero provenance and never warns (amends the round-1 boot-warning
    promise).
22. **URL injection ladder (round-2 M5):** `real env > env block > injected > .env
    files`; stale v3 `.env` lines structurally harmless; id-normalization collision
    is a boot error.
23. **`{PLT_ROOT}` rule (round-2 M6):** migrate emits
    `join(import.meta.dirname, …)` expressions — correct in per-app output;
    documented caveat for root-inline moves.
24. **Full vendored closure (round-2 M7):** `lib/migrate/legacy/` includes
    foundation machinery, all four upgrade chains, and frozen v3 snapshots of the
    ~13 capability schemas/transforms, with tests; gateway's request-time
    `replaceEnv` rewritten in the v4 gateway.
25. **Uniform per-app discovery (round-2 M8):** explicit entries load per-app files
    identically to autoload; inline `config` wins wholesale.

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
  telemetry?: ApplicationTelemetryOverrides   // full per-app telemetry override,
                                              // merged at spawn (not just
                                              // instrumentations)
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
