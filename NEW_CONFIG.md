# NEW_CONFIG: `watt.config.ts` — one config model for Watt v4

**Status:** Proposal — clean-cut implementation
**Target:** v4 (breaking) — no v3 preview; feedback via v4.0 alphas/RCs
**Author:** Platformatic team

## Summary

Watt v4 replaces the JSON-with-`$schema` configuration system with a single, code-first
configuration format — `watt.config.ts` / `.js` / `.mts` / `.mjs` — loaded natively by
Node.js via type stripping, with full TypeScript types provided by `wattpm` and by each
capability package. **It is the only configuration format**: any `.json` configuration
file found is, by definition, a v3-era file and is refused with an instruction to run
`npx wattpm-utils migrate`.

The core structural change is that **there is exactly one configuration dialect**: the
runtime dialect. The distinction between "a single-app config with a nested `runtime`
block" and "a runtime config with nested applications" disappears. A single-app project
and a 20-app monorepo use the same dialect; scaling from one to many means **the
application definition moves unchanged** — a single app's entire `watt.config.ts`
becomes that app's per-app file verbatim, and the `next({ … })` expression is
syntactically identical in a single-app root, a root-inline entry, and a per-app
file (what differs is only which directory's env files its evaluation sees — see
"Env files").

```ts
// watt.config.ts — a complete single-app Next.js project
import { next } from '@platformatic/next'

export default next({
  cache: { adapter: 'redis', url: process.env.REDIS_URL }
})
```

That bare factory export is the **canonical single-app form** — the loader
auto-wraps it as a single-app runtime, and the file is byte-identical to a monorepo
per-app config file. Runtime orchestration options, when a project needs them, come
from `defineConfig`:

```ts
import { defineConfig } from 'wattpm'
import { next } from '@platformatic/next'

export default defineConfig({
  server: { port: Number(process.env.PORT ?? 3042) },
  logger: { level: 'info' },
  application: {
    workers: 2,
    config: next({ cache: { adapter: 'redis', url: process.env.REDIS_URL } })
  }
})
```

The singular `application` key is the single-app shorthand — the same entry shape
as one element of `applications`, normalized internally to a one-element array. It
exists so a single app with runtime options never needs a one-element
`applications` array; declaring it alongside `applications` **or** `autoload` is
an error — the shorthand is only for genuinely single-app projects, and either
combination would smuggle a multi-app runtime out of the "single-app" form. An
`application` entry that declares no `path` defaults to the config file's own
directory.

Be precise about what this is: **TypeScript-authored serializable data**, not
unrestricted TypeScript. The evaluated result must be plain data (it crosses a
worker boundary — see the serializability contract), and files load through Node's
native type stripping: erasable syntax only, no enums/namespaces, no `tsconfig`
`paths`, no `.ts` presets from `node_modules`.

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
  file keeps working via the deterministic v4 capability detector (direct capability
  dependencies first — see "Loading mechanism"), and v4 stops writing an
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
4. Single-app → multi-app: the application definition moves unchanged; migration
   never relocates dependencies.
5. Env handling becomes ordinary JavaScript (`process.env`), with `.env` loaded before
   the config file is evaluated and a fully documented precedence.
6. A `wattpm-utils migrate` codemod that automatically converts anything that boots
   on v3 with in-tree capabilities (third-party capabilities without a
   v4-compatible release stop the run before any writes).
7. ICC integration points are preserved: `setApplicationConfigPatch` keeps
   byte-compatible patch semantics; `getRuntimeConfig` survives with its payload
   shape changed as a versioned DTO (see "Machine-generated configs").

---

## The new model

### One dialect, three levels of ceremony

**Level 0 — no config file.** `wattpm dev` in a directory: application type is
auto-detected from `package.json` dependencies, defaults apply. Nothing is written to
disk.

**Level 1 — single app, capability options only.** One file at the project root
whose default export is the bare factory call — `export default next({ … })` (see
Summary above). The loader auto-wraps it as a single-app runtime with default
orchestration, and the file is byte-identical to a monorepo per-app config file.
This is the canonical single-app form; `migrate` emits it whenever the v3 config
carried no runtime settings.

**Level 1b — single app with runtime options.** When there is orchestration to
express, `defineConfig` with the singular `application` shorthand. Every runtime
option (`server`, `logger`, `health`, `metrics`, `telemetry`, `undici`,
`httpCache`, `gracefulShutdown`, …) is top-level — exactly where it is in a
multi-app config. **The `runtime` block does not exist in v4.** `migrate` emits
this form when the v3 config had a non-default `runtime` block.

**Level 2 — multi-app monorepo.** The default multi-app style is a **thin root plus
per-app config files**: the root owns orchestration and discovery (`autoload`
survives), and each application's configuration lives in the app's own
`watt.config.ts`, which exports **the identical factory expression** a single-app
project would use:

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
  cache: { adapter: 'redis', url: process.env.REDIS_URL }
})
```

This is the unification punchline: a per-app file's default export and the value of a
root entry's `config` (below) are the same expression. Promoting a standalone project
into a monorepo app means moving that expression — and because the per-app file
imports the capability from the app's own directory, where its dependency already
lives, **no `package.json` changes are ever required** (see "Dependency resolution").

**Level 2b — root-inline composition (advanced).** The whole topology can also live in
one file: application entries carry the orchestration properties *and* attach the
capability configuration inline through the entry's `config` property, which accepts a
capability factory call (it accepted a file path in v3). This is the advanced form —
it requires every capability to be resolvable from the root, which under pnpm's strict
layout means adding it to the root `package.json` (see "Dependency resolution"):

```ts
// watt.config.ts
import { defineConfig } from 'wattpm'
import { gateway } from '@platformatic/gateway'
import { node } from '@platformatic/node'
import { next } from '@platformatic/next'

export default defineConfig(({ env, production }) => ({
  entrypoint: 'gateway',
  server: { port: Number(env.PORT ?? 3042) },
  logger: { level: production ? 'warn' : 'info' },
  metrics: production ? { port: 9090 } : false,

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
    { id: 'frontend', path: 'web/frontend', config: next() }
  ]
}))
```

The functional form receives the command-aware context (`production` is `true`
under `start`/`build`); config never branches on ambient `NODE_ENV`.

Note the boundary: `workers`, `health`, `env`, `dependencies` and the other
orchestration properties live **on the entry**; everything the capability understands
lives **inside the factory**. The two never merge into one bag, which is what keeps
same-named properties (`telemetry` above; `server`, `logger`, `watch`) structurally
unambiguous — flattening them together would be unsound: `telemetry` means two
incompatible things for service/db/gateway, and several capabilities collide even
within themselves.

When both a root entry and a per-app file exist for the same app id, the
**orchestration** keys merge **shallowly, per-key, root winning** — the v3
`autoload.mappings` semantics. Capability configuration, however, has exactly **one
owner**: a root entry carrying an inline `config` while the app directory also
contains a `watt.config.*` file is a **boot error** naming both sources. The
check exempts **the deciding file itself**: an entry whose directory is the
directory of the config file that produced it (the Level 1 auto-wrap, the
`application` shorthand, a machine-generated `path: '.'` entry) is configured
*by* that file, not twice —

```
✗ 'frontend' is configured twice: inline in watt.config.ts and in
  web/frontend/watt.config.ts. Move the factory call into the per-app file,
  or remove one of the two.
```

Silent shadowing is not an option here: package-local commands evaluate the
nearest file, so a shadowed per-app config would still win under a standalone
boot — the same app running two different configurations depending on where the
command was typed. Erroring keeps root boot and standalone boot identical **on
capability configuration**; the two still differ on the root-owned env layers a
standalone boot does not apply (`envfile` and the `env` blocks — see "Env
files"), which the standalone warning names. The check is a filename-presence
test, no evaluation needed, and `migrate` never emits this state.

### Functional form and the config context

`defineConfig` also accepts a function, sync or async — and so do **per-app config
files**: a function export is called once with the context and its *resolved value*
is classified (root config or application definition) by the normal rules.

```ts
export default defineConfig(({ command, mode, production, env }) => ({
  server: { port: Number(env.PORT ?? 3042) },
  watch: command === 'dev',
  logger: { level: mode === 'staging' ? 'debug' : production ? 'warn' : 'info' },
  applications: [/* … */]
}))
```

```ts
// web/frontend/watt.config.ts — per-app conditionals, typed via the factory
import { next } from '@platformatic/next'

export default next(({ mode }) => ({
  cache: mode === 'test' ? undefined : { adapter: 'redis' }
}))
```

Every factory's options parameter also accepts a **callback** (sync or async)
receiving the typed `ConfigContext` — so per-app files get contextual autocomplete
from the import they already have, without depending on `wattpm` (which is usually
not resolvable from an app directory). The implementation reuses classification
rule 1: `next(cb)` returns the function `async ctx => next(await cb(ctx))`
(the `await` is what makes the async half of the contract work — the callback's
promise must resolve *before* the factory sees the options), which the loader
calls with the context and re-classifies — serializability is untouched (the
callback resolves before anything crosses a worker boundary). As a per-app
export the desugared function is invoked by classification rule 1; in a
root-inline entry the root worker runs an explicit **resolution pass**: after the
root export is unwrapped, every function-valued `application.config` /
`applications[].config` is awaited with the **root** `ConfigContext`, before the
serializability check — so the form composes at every position, but a root-inline
callback sees the root env view (evaluation env is directory-determined; see "Env
files"). A
bare function export (`export default (ctx) => next(…)`) remains legal — it is
exactly what the callback form desugars to — but the callback form is the
documented one because it types its parameter. The callback overload's declared
return type widens accordingly (it returns a deferred definition, not an
`ApplicationDefinition` — accessing `.module` on it is a type error).
`ConfigContext` lives in
`@platformatic/basic` and is re-exported as a type by every capability.

The context (Vite-parity, deliberately):

- `command` — `'dev' | 'build' | 'start' | 'exec'`, which CLI verb is running;
  `'exec'` is every non-boot evaluation (capability commands like
  `db:migrations:apply`, and future tooling entry points).
- `mode` — free-form variant name; defaults to `'development'` under `dev` and
  `'production'` under `build`/`start`, overridable with `--mode <name>`
  (`wattpm build --mode staging`). Mode **selects env files everywhere** — it
  travels in `workerData` and the worker-boot env reader loads the same layered
  file set config evaluation used, so config-time and runtime env agree by
  construction. It is *not* injected as an environment variable (no `PLT_MODE`).
  `start` must be given the same `--mode` as `build` to reproduce the same
  env-file view (Vite parity, documented).
- `production` — the common-case shortcut: `true` under `start`/`--production`
  **and under `build`** (build produces production artifacts).
- `env` — a **snapshot** of `process.env` after env-file and `env`-block merging,
  taken at the start of evaluation (see "Env files"); later `process.env` writes
  are visible through `process.env`, not through `ctx.env`.
- `root` — absolute directory of the config file.

### Capability factories

Each capability package exports one typed factory plus its option types:

```ts
// from @platformatic/next
export function next (
  options?: NextConfigOptions
    | ((ctx: ConfigContext) => NextConfigOptions | Promise<NextConfigOptions>)
): ApplicationDefinition
```

Factory options are the capability's per-app configuration — what lived in the app's
own config file in v3 — with the capability's namespaced block flattened into the top
level (`next.trailingSlash` → `trailingSlash`) and the shared blocks (`logger`,
`server`, `watch`, `cache`, `application`) kept at their v3 positions. The
`application` block deliberately stays nested: several capabilities (remix, nuxt,
nitro, react-router) define their own `outputDirectory` alongside
`application.outputDirectory`, and hoisting both would collide.

Flattening is defined over a **list** of blocks per capability, not a single one:
react-router flattens both `vite` (`configFile`, `devServer`, `ssr`,
`notFoundHandler`) and `reactRouter` (`outputDirectory`), and tanstack — which has
no block of its own — flattens `vite`. `defineCapabilityFactory` takes that list,
and a build-time assertion checks the flattened key set against the retained shared
blocks so a future option cannot silently collide.

Factory options are **Platformatic integration and execution settings** — caching,
observability wiring, build/serve integration. Framework-native behavior stays in the
framework's own configuration file (`next.config.ts`, `vite.config.ts`, …), which
Watt does not replace: v3 options that merely mirror a setting the framework already
owns (`next.trailingSlash`, conditionally forwarded today) are reviewed for removal
during the schema audit, so the factory surface does not drift into a second copy of
the framework config.

Factories do **not** accept orchestration properties; those belong to the application
entry. TypeScript enforces the split in both directions.

The factory returns a plain, JSON-serializable object discriminated by its `module`
property — no symbols, no classes:

```ts
interface ApplicationDefinition {
  module: string          // '@platformatic/next'
  version?: string        // stamped by factories from their own package.json;
                          // absent on hand-written { module } definitions
  // …normalized per-app configuration (v3-internal shape)
}
```

`module` and `version` are **loader metadata, not capability options**: before
the capability's AJV validation and transform run, the loader strips them into
the application entry's envelope — capability schemas keep
`additionalProperties: false` and gain no reserved properties, so a stamped
factory result validates cleanly. In the programmatic DTO they surface as
`applications[].module` and `applications[].version`, next to `resolvedConfig`,
which carries only the capability payload.

The stamped `version` closes the root/app skew hole: a root-inline factory resolves
from the root's copy of the capability, while the worker implementation may resolve
a different copy — with pnpm's strict layout those can be different versions
(`next@4.1` factory, `next@4.0` runtime), letting a 4.1-only option pass the editor
and factory only to be rejected by the 4.0 schema at boot — or silently misapplied
where the schemas differ more subtly. The check is defined
against **the canonical capability resolution order** (see "Dependency
resolution"): **app-scoped first, runtime-bundled fallback** — the order v3's
configured-app workers actually use — applied identically by the worker's
implementation import, this version-stamp check, and the main process's schema
import. At load time the main process performs that resolution from the app's
root and compares the
stamp against the version of the copy it yields (so hoisted layouts,
where factory and worker share one copy, never false-positive, and root-only
dependencies are well-defined). **Major mismatch is a boot error** naming both
resolved paths and versions; **minor mismatch is a warning** (legitimate mid-upgrade
drift); patch differences are ignored. Covered by an integration test per layout
(npm hoisted, pnpm strict, root-only). Hand-written `{ module }` objects carry no
stamp and skip the check.

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

`wattpm resolve` is unchanged, and it writes **nothing** to the configuration: it
computes `application.path` in memory from `resolvedApplicationsBasePath`, clones
or extracts, and adds the capability dependency to the cloned app's own
`package.json` (`wattpm-utils/lib/commands/external.js:325-336,343-490`). The
runtime derives the same path at boot (`runtime/lib/runtime.js:2357-2361`). That
matters in v4: `resolve` runs unattended in build and deploy pipelines, so it must
not depend on magicast's statically-safe shapes or its snippet fallback.

The `{PLT_APPLICATION_X_PATH}` placeholder entries plus `.env` lines were written
by **`wattpm import`** (`external.js:238-268`), not `resolve`. In v4 `import`
writes literal relative paths into the config instead — an env-var indirection
would be a non-literal expression, outside magicast's safe shape, for no benefit.

---

## Detailed design

### File resolution

Recognized filenames in a directory: `watt.config.ts`, `watt.config.mts`,
`watt.config.js`, `watt.config.mjs`. **Exactly one may exist** — two or more v4
candidates in the same directory produce a targeted ambiguity error naming them,
the same philosophy as legacy coexistence: silently ignoring one of two
configurations is never acceptable.

There is no other supported format. Legacy detection covers the **complete v3
candidate set, not just `.json`**, and it is **unconditional**: in every directory
the loader consults (the walk, per-app discovery), the presence of any v3 candidate
filename — `watt.*` / `platformatic.*` and the suffixed variants (`*.runtime.*`,
`*.application.*`, `*.service.*`, `*.db.*`, `*.gateway.*`, `*.composer.*`) across
all six v3 extensions (`json`, `json5`, `yaml`, `yml`, `toml`, `tml`) — is an
error naming the file it found, **even next to a `watt.config.*` file**. There are
no ignored legacy files and no coexistence states: a properly migrated tree has
none (migrate deletes them), and a tree that has one is genuinely confusing and
should say so:

```
✗ watt.yaml is a v3-era configuration. Watt v4 uses watt.config.ts.
  Run:  npx wattpm-utils migrate
```

Without this, a `watt.yaml`-only project would fall through to zero-config
synthesis and boot with inferred defaults while silently ignoring its real
configuration — worse than any hard failure. Detection remains a pure filename
check — no parsing, no shape heuristics. The `--config` / `-c` flag accepts any of
the four v4 names.

We use `watt.config.*`, not `watt.ts`, following the `vite.config.ts` /
`next.config.ts` convention and avoiding collisions with app source files.

**Root and per-app files share the same filename; the export discriminates.**
Classification is four unconditional rules:

1. a **function** export is called once with the config context; its resolved
   value then falls through the rules below — a value that is *itself* a
   function (a function returning a function) is an error naming the file;
2. an object with `module` is an `ApplicationDefinition` (per-app) —
   **unconditionally**. There is no key-collision check: capabilities
   legitimately use option names that are also root keys
   (`gateway({ applications: … })`, nitro's `entrypoint`, every capability's
   nested `application` block), so any collision list would misclassify valid
   factory results. The rule is safe in the other direction because v4 root
   configs never contain `module` — the root schema has no such key. Options
   invalid for the selected capability are rejected by that capability's own
   schema with a precise error, which scales automatically as capabilities add
   options; when the offending keys are root-only ones (`server`, top-level
   `autoload`), the error hints "this looks like a root config — remove
   `module`";
3. an object with `application`, `applications`, `autoload`, or `entrypoint` is a
   root config;
4. an empty/other object is a root config (all defaults).

**The nearest config decides — commands are package-local.** The ordering is
strict, so the deciding file always executes with real context: **(1)** find the
nearest `watt.config.*` at or above the current directory **by filename alone** (no
execution), continuing up to locate the topmost one — the **root config**, whose
directory is the project root for env purposes; **(2)** run `loadEnv` — the
deciding file's directory's env files layered over the project root's (the
two-directory rule, see "Env files"); **(3)** only then execute candidates in
their eval workers to classify them (classification is cached, so a file classified
during the walk is not re-evaluated by a later discovery pass — config code still
runs once per load):

- **Root config nearest** → one more check before booting the runtime: if cwd is
  a **proper descendant** of the root config file's directory *and* that root
  config **claims it as an application** (an entry's `path`, or a non-excluded
  subdirectory of `autoload.path`), **that app boots standalone** — a zero-config
  app behaves identically to a sibling that owns a config file, because
  package-local scoping is a property of *being an app*, not of owning a file.
  Otherwise the full runtime boots; running from the project root behaves exactly
  as v3. (The claim check is free: the walk has already evaluated the root
  config.)

  Two exemptions keep the check from firing on configurations that have no
  standalone meaning. **Standing at the root config's own directory always boots
  the full runtime**, even when an entry claims that directory — the Level 1b
  `application` shorthand, a machine-generated `path: '.'`, and migrate's
  same-directory root-inline emission all put an entry there, and re-scoping would
  discard every runtime setting in the file the user is standing next to. And an
  entry carrying an **inline `config`** is exempt wherever it sits: its entire
  capability configuration lives in the root file, so there is nothing to boot
  standalone with. Running inside such an app's directory boots the full runtime
  and prints one line saying why.
- **App-def nearest** → **that application boots standalone**: the definition is
  auto-wrapped as `{ application: { config: def } }` (the normalized singular
  form — the DTO shows this entry) and run as a single-app runtime; the entry's
  `id` defaults to the package name (directory name when absent) and its `path` to
  the config file's directory. `cd web/frontend && wattpm dev` — or
  `pnpm --filter frontend dev` — starts *only* that application, matching the
  package-local command model frontend developers expect. This is a deliberate
  break from v3, which booted the whole runtime from anywhere.

Scope is positional but never silent: every `dev` / `build` / `start` invocation
prints one line naming the config file that won the walk and what is about to boot
(the full runtime, or one named standalone app), before doing anything else. When the
standalone-booted app is part of a larger project (a root config exists further up),
a prominent warning additionally states the consequences and the alternative:

```
⚠ booting 'frontend' standalone — sibling applications and http://*.plt.local are
  unavailable, and the root config's settings (server, logger, telemetry, env,
  envfile) are not applied. Run from the project root for the full runtime.
```

In a genuinely standalone single-app repo (the app-def *is* the topmost config),
there is nothing above to miss and no warning is printed. Sibling-dependent
capabilities (a gateway's config enumerates sibling applications) get the same
warning and no special treatment: booted standalone they fail at compose time with
their own errors — documented, not prevented.

**Scope is purely positional — there is no `--all` flag.** cwd is the only scope
selector: run at the root for the runtime, in an app directory for that app;
wanting the runtime from inside an app directory means running at the root (a
`cd`, a subshell, or a root script). One rule, zero scope flags, applied uniformly
to `dev`, `build`, and `start` — no per-command exceptions. Scaffolding writes the
root `package.json` script as `wattpm dev` (runtime, because it runs at the root)
and per-app scripts as `wattpm dev` (that app, because they run in the app
directory). **Multi-app dev is the runtime's job**: `wattpm dev` at the root runs
every application on one port with the mesh — strictly more useful than N
disconnected processes. Composing N parallel *standalone* dev processes (à la
`turbo run dev`) is deliberately not an advertised workflow — not because they
collide (declaring no port, they take ephemeral ports and coexist fine) but
because they have **no mesh**: `http://*.plt.local` does not resolve, so any app
that talks to a sibling fails. Teams that want parallel standalone processes
declare a distinct `server.port` per app and wire the URLs themselves —
possible, but not the sold path.
Standalone `start` in automation gets the same warning as anywhere else —
accepted and documented, not guarded. The migration guide calls the deploy
pattern out explicitly: v3 climbed to the root from anywhere, so a Dockerfile or
deploy script whose working directory is an app directory must point at the
project root in v4.

**Build environments.** A build runs with the app's **directory-determined env**
(real environment + env files) — never with injected `PLT_<ID>_URL` variables and
never with config `env` blocks in the build subprocess's environment, *in every
mode*. Mesh names are runtime-only values, read server-side at runtime where
injection exists; baking them into artifacts was never meaningful. The one
deterministic injection is `NODE_ENV`, which defaults to `production` under
`build` when nothing else set it (see "Env files").

`turbo run build`, a standalone app-dir build, and a root build produce identical
artifacts **when no application declares `envfile` and no root or entry `env`
block feeds its config evaluation**. Outside that condition they can diverge, and
the divergence is not detectable from inside the app directory: a standalone build
never evaluates the root config — standalone means standalone — so it cannot see a
root-entry `envfile` or the `env` blocks. If a build input comes from either, move
it into the app's own env files, where a build input belonged all along; the
migration guide calls this out next to the working-directory note below.

Because nothing breaks *loudly* when an env var merely reads as `undefined`, a
**root** build prints a warning naming the root/entry `env`-block keys being
withheld from the build environment — so a v3 build that read one (`NEXT_PUBLIC_*`
baked into client bundles is the classic case) fails visibly instead of silently
baking an empty value. A standalone build cannot emit that warning: it has not
evaluated the root config and does not know the keys.

**Standalone boot mechanics and the listen rule.** The wrapped single-app runtime
makes the app its entrypoint; the *root* config's settings are **not** applied —
standalone means standalone.

**The entrypoint is selected first.** An explicit `entrypoint` names it;
otherwise a single application becomes the entrypoint; otherwise exactly one
application whose resolved `module` is `@platformatic/gateway` does; otherwise
there is none and the runtime boots mesh-only. A *named* entrypoint that does not
exist is an error. (v3 detected the gateway case by scanning for entries that
carried a config file — `runtime/lib/config.js:436-463`; in v4 capability
identity comes from the eval pass and the detector, so that file-presence guard
is dropped.)

Ports then follow one rule, everywhere (full runtime and standalone alike):

- the **entrypoint always listens**, resolving its address as root `server`
  settings → **the app definition's own `server` block** → whatever the
  application itself asks for. Declaring `entrypoint` *is* the statement that
  this app faces the world; the root `server` block is where a multi-app project
  sets its address, and an app that declares its own port keeps it when the root
  is silent. Root-wins is a **deliberate unification of two divergent v3 paths**,
  not preserved behavior: the basic family lets the app's own block win
  (`basic/lib/capability.js:89` — a later-wins `deepmerge`), the service family
  lets the root win (`service/lib/capability.js:222`). A standalone boot is the
  same rule: auto-wrap **hoists the definition's `server` block** into the
  wrapped runtime — exactly the four keys `wrapInRuntimeConfig` hoists today
  (`hostname`, `port`, `http2`, `https`; `runtime/lib/config.js:147-154`) — so
  `next({ server: { port: 8080 } })` booted standalone listens on 8080;
- **there is no port default.** When nothing declares a port, the application's
  own `listen()` call stands — a plain Express or `http` server binds what its
  code says — and an application that expresses no port of its own gets an
  OS-assigned ephemeral port, which the runtime pins so restarts reuse it
  (`runtime/lib/runtime.js:3262-3271`). This is v3 exactly: `buildListenOptions`
  is `{ port: serverConfig?.port || 0 }` (`basic/lib/utils.js:21-29`), and the
  same `|| 0` / `?? true` normalization holds for child processes
  (`basic/lib/capability.js:645`) and the framework capabilities
  (`vite/lib/capability.js:229,242`). `3042` exists nowhere in the loading path —
  only in generator templates. In v4 that convention lives where it belongs, in
  the scaffolded config itself:
  `server: { port: Number(process.env.PORT ?? 3042) }`;
- any **other** application listens when its own config's `server` block sets a
  port — an explicit additional listener, useful for a stable internal address.
  This is **new**: in v3 a non-entrypoint's `server.port` was inert
  (`worker/controller.js:218` gates listening on `useHttp` alone, and `listen()`
  no-ops for non-entrypoints at `:266-268`). Migrate therefore **strips
  `server.port` from non-entrypoint applications** — v3 generators wrote
  `"server": { "port": "{PORT}" }` into per-app configs, and carrying those over
  verbatim would have every application in a migrated monorepo race for one port;
- **`port: 0` means an ephemeral port per worker** for a non-entrypoint: each of
  the app's workers listens on its own OS-assigned loopback port, registered with
  the mesh proxy. This is the v4 spelling of v3's `useHttp` (which is removed)
  and the supported way for a multi-worker app to expose real TCP — the gateway's
  WebSocket proxying requires it, and its diagnostics say so. On the
  **entrypoint**, `port: 0` means *one* ephemeral port, reported and pinned for
  restarts — not one per worker;
- a **fixed** port with `workers > 1` works through **`reuseTcpPorts`** — an
  application- and root-level property defaulting to `true`
  (`foundation/lib/schema.js:898`, `:1108`) — which binds every worker to the same
  port via `SO_REUSEPORT`; where the OS lacks it the runtime warns and falls back
  to a single worker (`runtime/lib/runtime.js:669-687`). The deterministic
  alternative is **`server.portAssignment: 'perWorkerIncrement'`**
  (`foundation/lib/schema.js:396`), giving worker *i* port `port + i`
  (`runtime.js:2412-2416`). Both survive into v4 unchanged; both are inert on an
  ephemeral (`port: 0`) entrypoint;
- an app that is neither the entrypoint nor ported (fixed or `0`) does **not**
  call `listen` at all (mesh-only — v3's non-entrypoint behavior, kept);
- there is **no port search**: a taken port is a fast `EADDRINUSE` failure. That
  is the outcome for a fixed port with `workers > 1` only when `reuseTcpPorts` is
  `false` and `portAssignment` is `shared`.

**The walk stops after checking the repository/workspace boundary directory**: the
first directory containing `.git`, a `package.json` with `workspaces`, or
`pnpm-workspace.yaml`. Because v4 walking means *executing* candidate files, a
stray `~/watt.config.ts` — or a base image's `/watt.config.ts` — must be
structurally unreachable from inside a project — no prompt, no trust store. When
no such marker exists anywhere up the tree (the typical production container:
`/app/package.json` without `workspaces`, no `.git`), the **nearest directory
containing an ordinary `package.json` is the boundary** — config files above it
are never considered, so `/app` is self-bounding. There is no fall-through to the
filesystem root: a walk that finds neither a marker nor a `package.json` stops
with "no watt.config.* found within a project boundary" and points at `--config`
— a config found near `/` is never executed. Independently of the boundary,
**an ancestor directory is eligible to provide a config file only if it contains
a `package.json` or workspace marker** — a config file belongs to a Node project
root by definition; the current directory itself is always eligible. This closes
the ancestor-repository hole: a dotfiles `$HOME` git repository (`~/.git`) does
not make a stray `~/watt.config.ts` reachable from a project below it unless `~`
is itself a Node package — beyond that residual case the invariant is
best-effort, and stated as such.

**The boundary bounds the search, not the env root.** Env files come from the
**root config file's directory** and the application directory (see "Env files");
the boundary only limits how far the walk looks and which config files may
execute. When no root config exists anywhere (Level 0, or a genuinely standalone
app-def repo), the boundary directory is the project root; under `--config` it is
the named file's directory and no walk runs. `--config` / `--env` are the escape
hatches for above-boundary layouts.

### Loading mechanism: the eval workers

All configuration is evaluated in **short-lived evaluation worker threads** —
one for the root config, then **one per per-app config file, run in parallel**.
Evaluation is **phased by necessity**: the fan-out cannot exist before the root
export has been evaluated and `autoload` expanded, so the root worker runs
first, and everything it discovers then runs concurrently. The
ESM module cache is per-worker and isolated, and that isolation is load-bearing: a
shared helper computing values at module scope (`export const url =
process.env.REDIS_URL`) re-evaluates in each worker under *that app's* environment,
so cross-app contamination through the cache is structurally impossible. Every
eval worker is constructed with an **explicit `env`** — the computed layered view
— never by inheriting the main process's `process.env`, so a mutated parent
environment can never leak in as apparent real-environment keys. No env windows,
no apply/restore choreography — each worker simply loads its own view and
imports. Per-app files are independent by definition (cross-file coordination was
never supported), so parallel evaluation is safe and typically *faster* than any
serial scheme.

1. **The root worker** resolves the root, runs `loadEnv` (the recognized file
   set for the active `mode` in the config file's own directory — env files load
   from exactly two directories, project root and application directory, see
   "Env files"), applies the result to its
   own `process.env` — the main process env is never touched — and imports the root
   config (`import(pathToFileURL(path))` — `.ts`/`.mts` via Node's built-in type
   stripping, the same mechanism the runtime already uses for `extensions`). It
   unwraps the default export (object, function called with the context above, or a
   bare `ApplicationDefinition` auto-wrapped per the walk rules above), awaits
   every function-valued `application.config` / `applications[].config` with the
   root context (the resolution pass — see "Functional form"), and expands
   `autoload` into the application list. This is the **only** place autoload
   expansion runs; the runtime transform consumes the already-expanded list.

   **`enabled` is resolved here, before fan-out.** It is orchestration, so its
   value is always lexically present in the root config or in
   `autoload.mappings`, and the root context already carries `production` — so
   disabled entries are dropped immediately after expansion, before any per-app
   worker is spawned, before the detector runs, and before capability validation.
   This preserves v3, where `transform()` spliced disabled applications out ahead
   of `prepareApplication` (`runtime/lib/config.js:412-416` then `:428`) and no
   worker ever existed for them: a decommissioned app whose capability is absent
   from the production image, or whose config file calls migrate's
   `requiredEnv()`, must not be able to fail a boot that excludes it.
2. **One worker per per-app file**, spawned in parallel once the root result is
   in, uniformly for every
   application entry that has a `path` and no inline `config` — explicitly-listed
   entries and autoloaded ones behave identically, as in v3. (Entries *with* an
   inline `config` still get a filename-presence check in their directory: a
   `watt.config.*` file there triggers the configured-twice error — no evaluation
   involved.) Each receives the root worker's `envFileKeys` alongside the seeded
   snapshot and applies its app's layered environment (the root and entry `env`
   blocks, then app env files — or the entry's `envfile` — over the root view, per
   "Env files") to its own `process.env`, honouring the provenance classes so a
   file-sourced key never shadows a real environment variable; then it imports the
   file and unwraps the export. A per-app file
   whose export classifies as a *root* config (including an accidental empty
   object) is an **error** naming the file and both classifications — a root config
   cannot nest inside an application entry. The main process then validates each
   app's capability config against the capability's schema (imported via a light
   subpath export, e.g. `@platformatic/next/schema`, resolved **app-scoped first
   with the runtime-bundled fallback** — the canonical capability resolution
   order, so the schema copy that validates is the same copy whose
   implementation the worker will load — with `resolvePath` resolving
   against that app's root, after stripping the `module`/`version` envelope, see
   "Capability factories"). That subpath is **part of the v4 capability contract**,
   not an optimization, and it carries the package-level metadata main-side
   preparation needs besides the schema: `skipTelemetryHooks` (which decides
   whether the worker gets the OpenTelemetry `--import` hook — `runtime.js:2431`,
   set by gateway, db, and service) and `modulesToLoad`. Both move into the
   subpath's exports and the entry envelope, so the main process never has to
   import the full capability package.

   An entry with **neither** inline `config` **nor** a per-app file spawns no
   worker: its capability comes from one deterministic **detector** run against
   the app's `package.json`. Direct dependencies matching the **explicit capability
   table** win first — `@platformatic/node` included, with `@platformatic/composer`
   aliased to `@platformatic/gateway` — and **exactly one** must match: two
   capability dependencies produce an actionable ambiguity error naming both. The
   table is enumerated rather than pattern-matched on `@platformatic/*`, so
   companion packages like `@platformatic/globals` (which `@platformatic/node`'s own
   generator writes alongside it) cannot trip the ambiguity error, and the
   out-of-tree capabilities already in v3's table (`php`, `ai-warp`, `pg-hooks`,
   `rabbitmq-hooks`, `kafka-hooks`) have a defined place. A capability outside the
   table — any third-party one — is never inferred: those apps declare an explicit
   config file.
   Framework inference (`next`, `astro`, `vite`, …, with the existing
   Nitro-before-Vite ordering) is fallback-only, and the **terminal rule** keeps
   v3's zero-config floor: a directory containing JavaScript/TypeScript sources
   that matched nothing else is `@platformatic/node` (v3's `hasJavascriptFiles`
   fallback, kept); a directory with none is an error naming the app. This
   inverts the v3 detector,
   which checked framework dependencies first and reached `@platformatic/node`
   only through that terminal fallback — under that order, a generated Node app
   that later added Vite as
   unrelated tooling would silently switch capability on its next boot. Because
   scaffolding always adds the chosen capability to the app's dependencies, the
   detector provably reconstructs the wizard's choice — which is what makes
   omit-defaults generation sound. Boot logs one line per detected app
   (`web/frontend → @platformatic/next (detected)`) so the inference is never
   invisible, and there is no generic-`basic` fallback for runtime applications.
3. In every eval worker, a **`module.registerHooks`** resolve hook (the synchronous
   API — the async `module.register` variant does not intercept `require()`, and a
   `watt.config.js` in a `"type": "commonjs"` package is CJS) records every file
   the evaluation transitively imported or required; the main process merges the
   per-worker lists for the watcher.
4. Each worker runs the **serializability walk in-worker, before `postMessage`**:
   the config is about to cross Node's structured-clone boundary, where a nested
   function throws an opaque `DataCloneError` and a class instance is silently
   flattened to a plain object — both before any main-side check could see the
   original value, so a check after the boundary cannot keep its promises.
   Violations post a structured, path-aware error (`InvalidConfigValueError`
   naming the JSON path); valid results post back
   `{ config, importedFiles, env, envFileKeys }` and the worker exits.
   The root worker's `env` is the **pre-evaluation `loadEnv` snapshot** (real
   environment merged with the root env files) — the runtime seeds every app
   worker's environment from it, exactly as v3 seeded from `kMetadata.env`;
   `envFileKeys` records which keys came from files rather than the real
   environment, so app-level env files can override them at worker boot (v3's real
   rule, preserved exactly: an app env-file key applies when it is absent from the
   environment entirely, or present but file-sourced — never over a genuine
   environment variable). **`envFileKeys` travels inbound as well**: per-app eval
   workers receive it so they can apply the same rule during evaluation, and the
   worker-boot reader adds the app-file keys it applies to its own file-sourced
   set before the `env` blocks are applied. Without that, evaluation could not
   honour `real environment > env files` and the two views would disagree.
   Runtime injection updates that provenance: a key the
   runtime injects (`PLT_<ID>_URL`) is **removed from `envFileKeys`** and
   recorded in a separate `injectedKeys` list in `workerData` — the worker-boot
   rules are defined over the three provenance classes (real, injected,
   file-sourced), which is what makes the ladder's "injected beats all env
   files" rung implementable: a stale `PLT_*_URL` line in an app's `.env` can
   never override the injected mesh URL. After evaluation each worker diffs its live
   `process.env` against its snapshot: mutated keys produce a boot warning naming
   each key, pointing at the explicit `env:` property as the sanctioned
   cross-boundary channel:

   ```
   ⚠ configuration evaluation mutated process.env; these keys do NOT propagate
     to applications: CACHE_PREFIX, OTEL_EXPORTER_OTLP_ENDPOINT
     Use: defineConfig({ env: { CACHE_PREFIX: … } })
   ```

   The warning reports **keys only** — a snapshot diff cannot attribute writes to a
   module or line, and the diagnostics must not claim otherwise. (Per-write
   attribution via a `process.env` Proxy installed during evaluation is a possible
   later enhancement, not a v4.0 commitment.) Mutations still work *within* the
   evaluation (it's one thread, one env); they just never silently cross into the
   runtime. Third-party import side effects warn rather than fail.
   `--debug-config`'s in-process `--inspect-brk` mode (below) applies the same
   diff and warning, and **snapshots and restores the main process's
   `process.env`** afterwards — otherwise the "does not propagate" statement
   would be false in debug mode.

   Evaluation runs under a **configurable deadline** (default 30 s,
   `--config-timeout`): a config that never resolves — an awaited fetch to a dead
   host, a forgotten promise — terminates the worker and fails the load with a
   targeted timeout error instead of hanging boot forever.

The result then enters the pipeline in the main process: AJV validation
(`useDefaults`, **`coerceTypes: false`**) → `kMetadata` attachment →
`transform()`. The serializability check has already run in-worker (step 4); the
main process repeats it only for **object config sources** (the programmatic API
and zero-config synthesis, which never cross a worker boundary) and as defense in
depth — in both cases before metadata attachment, because `kMetadata` is
symbol-keyed and non-JSON by design. Coercion is disabled in v4: its
only justification was placeholder strings, and on the genuine unions that survive
the audit (`boolean | number`, `boolean | object`) AJV coercion is a documented
hazard in this very codebase (`runtime/lib/config.js:490` warns that `2` would be
coerced to `true`). The audit also guarantees that schema-injected defaults are
themselves serializable.

Why a throwaway worker instead of a plain `import()` in the main process: the ESM
module cache is not invalidatable, so same-process re-import would silently return
stale config on every dev reload — and the recorded import list is what lets the
watcher cover helper files (`./config/shared.ts`), not just the root file. It also
isolates `.env` mutation and config crashes/hangs from the main process. The
watcher consumes a **filtered** import list — plus the enumerable env-file set
(root and app `.env*` files for the active mode), since env files are read, not
imported, and editing them changes both evaluation and worker env —
project/workspace-local files only:
`node_modules` paths (Watt itself, capability packages, transitive dependencies)
are recorded but never watched, so dependency churn cannot trigger reloads or
exhaust watcher limits.

The costs are real and accepted: one worker spawn per config file (parallel) + type
stripping per load
(order tens of milliseconds), paid at boot and on each dev reload — and CLI
dispatch must be careful not to evaluate config eagerly when only metadata is
needed. `--debug-config` prints the fully resolved configuration using the **same
eval-worker pipeline as a real boot** — per-file isolation included, because in a
single shared process the first import would fix a shared helper's module-scope
env values for every later file, and the diagnostic would print cross-app
contaminated values that a real boot never uses. Breakpoint debugging gets an
explicit escape hatch, since a throwaway thread dies before an inspector can
attach: with `--inspect-brk`, evaluation runs **in-process** and is therefore
restricted to **one config file** — the deciding file by default, or one app's
file by path — precisely because one process has one module cache, in which only
a single file's env view can be correct. The other files still evaluate in their
workers (the printed output is the full resolved configuration either way) and are
**spawned before the in-process target's environment is applied**, so the debug
run cannot contaminate them; combined with the explicit-`env` rule above, this is
what keeps the printed configuration equal to a real boot's. The evaluation
deadline is disabled for the in-process target — a paused breakpoint session must
not be killed by the 30 s timer.

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
  deleted. At **boot**, the **capability `transform`** — deterministic capability
  code, not user config — still runs worker-side as in v3, where its context lives
  (`telemetryConfig`, watch flags). Outside boot it runs main-side, exactly as v3
  already does for CLI commands (see "CLI commands over config"). This keeps the
  *transform* — and the worker-only context it reads — off the eval worker's path
  and, crucially, preserves patch semantics (below). It does **not** keep
  capability *imports* off that path: a per-app file exists to call `next(…)`, so
  every eval worker loads the capability package, `@platformatic/basic`, and their
  transitive graph. That is the real per-file cost, and it is why the watcher
  filters `node_modules` out of the recorded import list. Because the
  symbol-keyed `kMetadata` cannot cross structured clone, **each worker rebuilds
  it locally** before the capability transform runs — `root` = the application
  directory, `path` = `configPath` (null for inline definitions),
  `module`/`version` from the entry envelope, `env` = the worker's seeded
  environment (v3's `kMetadata` carried `{ root, env, path, module }`;
  `version` is a v4 addition, and `PLT_ROOT` is deliberately absent from `env`
  now that the variable is removed) — so the worker-side consumers that read it today
  (`getApplicationEnv()`, db's sqlite-path resolution, the gateway's
  request-time origin resolution) keep working unchanged.

Per-app config files evaluate with **their application's layered environment** (see
"Env files"); the per-application `env` config property configures the worker's
runtime environment only, while `envfile` governs **both** views — the app's
config evaluation and its workers load the same named file (see "Env files").

**Serializability is the v4.0 contract, and it is deterministic:**

- object properties whose value is `undefined` are **omitted** (JSON.stringify
  semantics) — so `cache: { url: process.env.REDIS_URL }` with the variable unset
  yields `cache: {}` and the schema's defaults/required rules speak, rather than an
  error or a silent `undefined` crossing the boundary;
- `undefined` inside **arrays**, non-finite numbers (`NaN`, `Infinity`), `bigint`,
  circular references, functions, symbols, and non-plain instances are **hard
  errors** naming the JSON path.

Function-shaped needs (logger transports, gateway handlers, `deduplication.key`)
stay expressible as file paths loaded worker-side, exactly as in v3. Re-evaluating
per-app files inside workers to allow inline functions remains possible in a later
4.x, but we make no public commitment.

**TypeScript constraints** (Node type stripping): erasable syntax only — no enums,
namespaces, or parameter properties; `tsconfig` `paths` are not applied; `.ts` config
presets cannot be imported from `node_modules`. Scaffolding and `migrate` emit
`watt.config.mts` when the target package has `"type": "commonjs"`, `.ts` otherwise.

### Dependency resolution

Factory imports follow **standard ESM resolution from the importing file** — no
loader hooks, no magic; editor and runtime always agree:

- **Per-app files** import the capability from the app directory, where its dependency
  already lives in v3. Nothing changes for any existing workflow, under any package
  manager. This is the default style: `migrate` and scaffolding emit the per-app
  style (files only where non-default settings exist) plus a thin autoload root, so
  migration never *relocates* a dependency — its only `package.json` edits are the
  consented v4 range bumps and the root `wattpm` dependency (see
  "`wattpm-utils migrate`").
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

**Recognized files** (Vite parity), in both the root and each application
directory:

```
.env  .env.local  .env.<mode>  .env.<mode>.local
```

Within one directory, mode-specific beats generic and `.local` beats committed:
`.env.<mode>.local > .env.<mode> > .env.local > .env`. `mode` comes from the config
context (`--mode`); scaffolding adds `.env*.local` to `.gitignore`.

**Precedence is app-wins layering — more specific overrides less specific, real
environment always wins:**

```
real environment  >  entry env block  >  root env block
                  >  app env files  >  root env files  >  NODE_ENV default
```

(This is the **config-evaluation view** for a per-app file. The worker-runtime
view in "Inter-application URLs" is the same ladder with injected `PLT_<ID>_URL`
values inserted below the `env` blocks — the two agree rung for rung otherwise.)

The `env` blocks are visible during per-app config evaluation because they are
knowable before fan-out: orchestration is always root-lexical — a per-app file
exports an `ApplicationDefinition`, and factories reject orchestration properties
— and the root worker runs first. This is what lets a migrated
`{ "connectionString": "{DATABASE_URL}" }` become a plain
`process.env.DATABASE_URL ?? ''` and still resolve, instead of having its value
baked into source. Two positions are excluded, matching v3: the **root config's
own** evaluation (its `env` block is lexically inside the file being evaluated —
v3 applied blocks in the worker, long after `runtime/index.js` had parsed the
root), and **root-inline entries**, which are evaluated in the root worker for the
same reason.

The bottom rung is `NODE_ENV`: when `production` is `true` and nothing else in the
ladder supplied it, it defaults to `'production'`. This is v3
(`worker/controller.js:126-129`, applied after all seeding and only when the key
is absent), and it is the one injection a build is allowed to make.

This preserves v3's observable behavior (an application's `.env` overrides
root-file defaults but never genuine environment variables) — the v3
`kEnvFileFallbackKeys` mechanism returns in spirit as a small `envFileKeys`
provenance array in the eval-worker protocol, carrying which seeded keys came from
files rather than the real environment. It is load-bearing semantics, not
diagnostics.

**Evaluation env is determined by directories, never by boot style — and env
files load from exactly two directories: the project root (the **root config
file's directory**, or the boundary directory when no root config exists) and the
application directory.** This matches v3, where `loadEnv` walked up from
`dirname(configFile)` (`foundation/lib/configuration.js:503,511`); binding the
root layer to the walk boundary instead would drop the `.env` sitting beside the
config whenever a Watt project lives below a git or workspace root. Intermediate
directories
(`web/.env` between root and `web/frontend`) are **never** consulted — matching
both precedence ladders, Vite's one-envDir-per-app model, and v3 in practice
(v3 loaded one root file plus the app's own `.env`, never a layered chain). A
config file's environment is therefore "its own directory's files over the
project root's" — the identical set under a
root boot and a standalone boot, because the two directories never depend
on which config file won. A given file evaluates identically under every boot
style; only *what boots* changes with where the command runs. File **position**
is the one thing that does change the env view: the same factory expression
reads the root's env files when it lives root-inline and the app's env files
when it lives in the per-app file — directory-determined, with no pretense
otherwise. That asymmetry is one more reason the per-app file is the canonical
home for capability configuration.

**Per-app config files evaluate with their app's environment — each in its own
worker.** Every per-app file gets a dedicated eval worker whose `process.env` is
that app's layered view (app env files over the root view), with its own isolated
ESM cache — so the colocated `web/frontend/watt.config.ts` reads
`web/frontend/.env`'s `REDIS_URL`, exactly as a frontend developer expects, and a
shared helper computing values at module scope re-evaluates per worker under the
right environment (per-worker cache isolation is what makes cross-app
contamination impossible).

The per-application `env` config property configures the worker's runtime
environment **and, per the ladder above, its config evaluation** — with the two
excluded positions noted there (the root config's own evaluation, and root-inline
entries). `envfile` is an opt-out of the convention
and governs **both views**: when an entry declares it, none of the four
mode-aware app files are read for that application — exactly the named file
loads, in the app's eval worker *and* at worker boot alike, occupying the same
single rung the app file layer occupies in the ladders (v3's
replace-the-default-path behavior, extended to the set — and extended to
evaluation, so config-time and runtime env keep agreeing by construction). Mode
selection simply does not apply to that app's files; root files and every other
rung are unaffected. The path resolves **app-relative** (v3 resolved it against
the runtime root — migrate rewrites paths so they keep pointing at the same
file), and a missing explicitly-named envfile is a **boot error** (v3 silently
ignored it — defensible only for the implicit default `.env`). Declaring `envfile`
on an entry that also carries an **inline `config`** is an **error**: such an
entry has no per-app eval worker, so the file provably cannot govern both views
there. One documented asymmetry: `envfile` and the `env` blocks live on the root
entry, so a **standalone** boot — which applies no root orchestration — evaluates
and runs under the conventional file set with no blocks applied; the standalone
warning's list of omitted root settings names both, and the build section states
the consequence for artifacts. The
`--env <file>` flag is the same substitution at the **root** rung: it replaces
the root file layer in both views, mode-exempt, for the invocation. `{PLT_X}`
interpolation,
`strictEnv`, root `envfile`, and the YAML brace-quoting pre-pass do not exist in
v4; they survive only inside `wattpm-utils migrate`'s legacy reader.

### Inter-application URLs

v3's behavior here was subtler than commonly understood: when a *worker* parsed its
app's config, any unset placeholder whose key **ends in `_URL`** resolved to the URL
of **the app being parsed**, whatever the rest of the key said — `fetchApplicationUrl`
gates on the suffix and then ignores the key, returning the current app's
`.plt.local` URL (`runtime/lib/worker/controller.js:31-37`); in the *root* config,
which is loaded without `onMissingEnv`, unset placeholders resolved to `''` or
threw under `strictEnv`. That machinery dies with interpolation, and its replacement is explicit and
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
  real environment  >  entry env block  >  root env block  >  injected
                    >  app env files  >  root env files  >  NODE_ENV default
  ```

  (Both `env` blocks exist — the root-level one applied to all applications and
  the per-entry one — and the entry's wins, matching v3's *relative* block
  order. The ladder's top rung, however, is a deliberate **inversion of v3**:
  v3 applied `env` blocks over the real environment (they were pins); v4
  follows the dotenv convention — **the real environment is always
  authoritative**, over blocks and files alike, so both ladders share one top
  rung and one sentence tells the whole story. This is a declared breaking
  change. Migrate warns for **every** `env`-block key it carries over — not only
  those colliding with the migration-time environment, since the keys whose
  behavior actually flips are the ones set in the *deployment* environment and
  absent from the laptop running the codemod — and the runtime logs once at boot
  whenever a worker's `env`-block key is suppressed by the real environment, which
  is the only diagnostic channel machine-generated and ICC configs ever see. An
  application's `envfile` replaces the app-files rung — see "Env files". Injected
  URLs sit **above all env files**, including the app's own — enforced through the
  eval-worker protocol's `envFileKeys` snapshot plus the `injectedKeys` list in
  `workerData`, so stale `PLT_*_URL`
  lines in any `.env` remain structurally harmless under app-wins layering.) The
  runtime skips injection when the key exists in its **own real environment**
  (container/k8s overrides work — the runtime's
  `process.env` *is* the oracle); the explicit `env` block
  beats injection and is the sanctioned way to hand workers a value — though,
  dotenv-style, the real environment outranks even it. Injection covers **every
  application, including the app's own `PLT_<SELF>_URL`** (v3's placeholder
  machinery effectively guaranteed a self URL, and generator-emitted code reads
  it). v3's injected `PLT_DEV`, `PLT_ENVIRONMENT` and `PLT_ROOT` are **removed** —
  apps branch on their own variables, or the decision moves into config where the
  typed context lives; migrate's source scan flags every occurrence. `PLT_ROOT`
  existed to make `{PLT_ROOT}` placeholders resolve
  (`foundation/lib/configuration.js:512`) and was already excluded from every
  generated `.env` (`generators/lib/base-generator.js:243`); with interpolation
  gone its only remaining reader would be application code, and
  `import.meta.dirname` is the v4 answer. `NODE_ENV` is the one variable the
  runtime still defaults, at the bottom of the ladder (see "Env files").
  Topology variables are
  deliberately not `.env`-configurable. Two application ids normalizing to the same
  variable name (`api-v2` and `api_v2` → `PLT_API_V2_URL`) is a **boot-time config
  error** naming both ids.

### Validation, types, and the schema audit

- **AJV stays authoritative**, but the v4 schemas are **audited, not just pruned**.
  Beyond removing `$schema`, root `module`, `runtime` (wrapped block), `web`,
  `services`, `verticalScaler`, and `healthChecksTimeouts`, every `anyOf`/`oneOf`
  union across foundation and the capability schemas (~120 sites) is classified:
  - *placeholder-only unions* (the 13 `overridableValue` call sites,
    `logger.level`'s
    `^\{.+\}$` pattern branch, the string forms of `workers` and `watch`,
    `managementApi`'s top-level string — the socket path is the *object* property
    `managementApi.socket`, and a bare string is merely truthy
    (`runtime/lib/management-api.js:421`); the branch exists only to admit
    `'{PLT_MANAGEMENT_API}'` — …) — **string branch deleted**;
  - *genuine unions* (`preload`'s string-or-array, `extensions`'
    string-or-object-or-array, `enabled`'s per-environment object) — kept;
  - judgment calls — decided and recorded in the schema.

  `enabled`'s object form is **keyed by `mode`**, not by a separate binary
  environment. `production`/`development` remain the default mode names under
  `start`/`build` and `dev`, so every existing config keeps its meaning, and
  `enabled: { staging: false }` now does what it looks like under
  `--mode staging` — where v3 silently ignored the key
  (`runtime/lib/config.js:298-318`). `enabled` is resolved in the root eval
  worker, before fan-out (see "Loading mechanism").

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
  reads it for version detection only (never module selection) and **strips it
  before AJV validation** — the v4 root schema does not admit it, and without the
  strip every machine-generated config would fail validation. A stale v3 URL
  refuses with the migrate hint. This is the version marker that keeps the next
  major's migration tractable.
- Writers converted in v4: `next pack` (bundle config; gains a test asserting the
  bundle boots), the `wattpm install`/external flow (per-app files in cloned repos),
  `wattpm-utils migrate` output, and the documented pattern for ICC-style platforms
  (`'export default ' + JSON.stringify(config)`).
- Reading configs without executing them: the plain-object form is trivially
  AST-parseable, and running systems expose the resolved config via the programmatic
  `runtime.getRuntimeConfig()`. The management API's HTTP `GET /config` endpoint is
  **removed** in v4 (its only known consumer, watt-admin, migrates off it —
  cross-repo coordination noted in the plan).
- **The programmatic payloads are a versioned public DTO, and they change shape.**
  Consumers observing `getRuntimeConfig().applications[].config` — or
  `getApplicationDetails().config`, which is a flat object with a top-level
  `config` (`runtime/lib/runtime.js:2076-2093`) — received a *file path* in v3; in
  v4 each entry carries
  **both** `configPath` (the per-app file path, or absent for inline definitions)
  and `resolvedConfig` (the validated raw capability payload), plus `module` and
  `version` — the loader-metadata envelope split off the definition (see
  "Capability factories"). Payload compatibility and patch-
  document compatibility are **separate contracts**: patch documents stay
  byte-compatible (below), while the payload change is a declared breaking change
  coordinated with every consumer (watt-extra reads `applications[].type`, which is
  unchanged).

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
  hot-adding/removing apps on the running runtime via `POST`/`DELETE /applications`.
  The live half is **not untouched by the new loader**, though: in v3 the posted
  worker self-loaded its config file — machinery v4 deletes — so
  `POST /applications` runs the same per-app discovery/eval/validation pass as
  boot for each posted entry (env layering, legacy detection, classification,
  capability validation, detector), surfacing failures as HTTP errors; the
  request body's `ApplicationEntry.config` type change is part of the declared
  DTO break (breaking change 14). The same eval pass applies to the **ITC**
  `management:addApplications` handler (`runtime/lib/management-handlers.js:136-146`),
  reachable from any application with `management: true` — it is a second live
  hot-add path with the same worker-self-loading assumption. What these commands
  need from the running runtime comes from `GET /metadata`, extended with `root`,
  `configPath`, and **`autoload`** — `applications:remove --save` resolves the
  live `autoload.path` to decide whether the removed app must be appended to
  `autoload.exclude` (`wattpm/lib/commands/applications.js:110-112`), and that is
  the only surviving source once `GET /config` is removed. `applications:add`'s
  on-disk JSON spec file carries **orchestration only**; capability configuration
  comes from the app's own `watt.config.*` or the detector.
  **Requirement: `--save` is retained**, implemented on the same magicast machinery
  as `wattpm import` — the canonical scaffolded shape (literal `defineConfig`
  object, literal `applications` array; for removal, also appending to a literal
  `autoload.exclude`) is edited in place, and non-static shapes get the paste-ready
  snippet fallback. Shipping magicast for `import` while dropping `--save` would be
  an avoidable regression. (Placement: magicast is a dependency of
  `wattpm-utils` and — imported lazily, only when `--save` is actually used — of
  `wattpm` itself.)
- **Capability CLI commands** (`db:migrations:apply`, `db:seed`, `db:types`,
  `gateway:*`, `next:*`) move to a **data contract**: `createCommands` becomes part
  of the v4 capability contract, and each command receives `{ root, config }` — the
  app's config from the eval pass, **with the capability `transform` applied
  main-side** — instead of a config file path. The transform is not optional here:
  db's rewrites the relative sqlite path to absolute and injects the
  `migrations.table` / `db.ignore` defaults `Migrator` requires
  (`db/lib/config.js:6-50`), so a command handed raw config would migrate the
  wrong database. This is what v3 already does — `loadConfiguration(configFile,
  schema, { transform })` in the CLI process (`db/lib/commands/migrations-apply.js:11`)
  — and the main process synthesizes the `kMetadata` the transform reads
  (`root`, `path: configPath`, `module`, `version`, `env`). Context that only
  exists in a worker is absent and documented as such: no `configPatch` is applied
  and `watch.enabled` is `false`, which is exactly how `basic`'s transform already
  behaves outside a worker (`basic/lib/config.js:57,68` optional-chain
  `workerData`). Commands never self-load config (db's `loadConfiguration` call and
  its `utimesSync` restart hack are deleted; the restart signal is a
  management-API restart when a runtime is running). These evaluations run with
  **`command: 'exec'`** in the config context, defaulting to `mode:
  'development'`, `production: false` — the safe direction for a laptop
  `db:seed` — and every capability command accepts `--production` / `--mode
  <name>` to select other views (CI runs `wattpm db:migrations:apply
  --production`). **`--production` implies `mode: 'production'`** unless `--mode`
  is also given, matching the boot verbs; env-file selection then follows mode
  exactly as it does there, so the CI invocation above reads the production env
  files rather than the development ones. Discovery is **lazy**: config is evaluated
  only when the typed command actually matches `<namespace>:<command>` and isn't a
  builtin, or on per-app help — plain `wattpm help` is static and never executes
  user code.

### Config-writing tooling

- **`wattpm create` / `create-wattpm`**: scaffolds configuration **only where it
  configures something** — the same omit-defaults rule migrate follows. A
  single-app project with default answers gets **no Watt config file** (zero-config
  detection covers it); a monorepo gets the thin autoload root (genuinely
  load-bearing: autoload path, entrypoint) and per-app `watt.config.ts` files
  (`.mts`/`.js` variants per the rules above) only for apps where the wizard set
  non-default options — omission is safe because the wizard adds the chosen
  capability to the app's dependencies, and the deterministic detector
  reconstructs exactly that choice (see "Loading mechanism"). The wizard's closing output prints where `watt.config.ts`
  goes and the one-line bare-factory form, so later customization is one
  copy-paste away.
- **`wattpm import`**: edits the root config with **magicast** (AST edit preserving
  formatting) when the shape is statically safe — literal `defineConfig` object,
  literal `applications` array; otherwise prints a paste-ready snippet and exits 0
  with a notice. magicast is a dependency of `wattpm-utils` only. In a configless
  tree, `import` scaffolds a thin autoload root first (replacing the v3
  `?autogenerated=true` marker dance, whose producer and consumer are both gone).
- **Temporary-config fallback** (`fallbackToTemporaryConfigFile`): removed;
  zero-config synthesizes in memory.

### `wattpm-utils migrate`

A one-shot codemod in `wattpm-utils`, invoked as **`npx wattpm-utils migrate`** —
**not routed through `wattpm`**. It is a **stable-v4.0 release gate**: v4 refuses
every legacy configuration, so the migrator is functionally part of the breaking
change — GA does not ship without a published, tested migrate (alphas and RCs may
precede it; early adopters hand-convert). Release *cadence* stays decoupled after
4.0: because `npx` resolves the package at *invocation* time, migrate fixes ship on
`wattpm-utils`' own schedule and reach every already-installed v4 runtime with no
runtime re-release.

It is **the only code in v4 that can read legacy configs**. Scope: anything that
boots on v3. To guarantee that, the **complete v3
closure** is vendored under `lib/migrate/legacy/` when it is deleted from the live
packages — and the closure is larger than foundation alone:

- foundation's machinery: the parsers for all formats (JSON, JSON5, YAML, TOML),
  `replaceEnv` and the YAML brace pre-pass, all `$schema` URL generations, and a
  **v3 → v4 module rename table** (`@platformatic/composer` →
  `@platformatic/gateway`; the identity is extracted *before* the upgrade chains
  run, `foundation/lib/configuration.js:166-179` at `:573`, so composer-era apps
  keep the old module name and must be renamed explicitly);
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
rewritten in the v4 gateway — that call cannot be relocated.)

Migrate works from **three views** of the legacy configuration, because the v3
production pipeline destroys exactly the information generation needs: env
replacement runs *before* upgrade, validation, and transform, so a set
`PLT_REDIS_URL` has already become its literal value (possibly a secret that
must never be baked into source), an unset one has already become `''` or its
fallback, and an embedded placeholder
(`http://127.0.0.1:{PLT_OTLP_PORT}/v1/metrics`) is an ordinary string whose
expression boundaries are gone; capability and runtime transforms then rewrite
authored values and drop environment-disabled applications. The views:

- the **lexical view** — the parsed file with `{PLT_X}` placeholder tokens
  intact and no defaults injected; every authored application is present
  regardless of the migration-time environment. Its **module list** — what the
  third-party gate and the generation table key off — is
  `config.module ?? extractModuleFromSchemaUrl(config)` with
  `splitModuleFromVersion` applied, since a top-level `module` string is the
  canonical v3 spelling for capabilities without a published `$schema` URL
  (`foundation/lib/configuration.js:157-158`, `foundation/lib/module.js:129-140`);
- the **upgraded view** — the lexical data run through the `semgrator` chains.
  Because the chains branch on values that may be tokens (v1's
  `if (config.hotReload)` is always truthy on a token; one service chain
  overwrites a `watch` token with literal `true`), **each chain runs twice** —
  once on the token view, once on a resolved clone — and every site where the
  two runs took different branches is flagged *requires-review* instead of
  trusted. Structural validation runs against a **token-masked disposable
  clone**: each placeholder is replaced by a type-appropriate sentinel from the
  audit's target-type table, validated with `useDefaults: false` and coercion
  off, then discarded — v3 only ever validated *after* replacement with
  `coerceTypes: true`, so tokens in number/boolean positions
  (`"startTimeout": "{PLT_START_TIMEOUT}"`) can never validate un-masked, and
  running the vendored validator directly would inject defaults and coerce the
  authored values it exists to preserve;
- a **disposable resolved view** — the config loaded as production v3 would,
  built entirely from migrate's **vendored replica** of the v3 pipeline: the
  closure includes the runtime's config machinery (wrapping, autoload
  expansion, entrypoint detection) and a module → frozen-schema/transform map,
  so **no project-installed v3 package is ever imported**; `strictEnv` is
  forced to `'warn'` so strict projects can migrate on machines missing
  production secrets. Used *only* for the equivalence check, never as a
  generation source.

The **equivalence check** compares **both** the root configuration and each
application's capability configuration, **validated but pre-transform**, under a
pinned `{ production, env }` context. Comparing only per-application configs would
leave the entire root conversion — `runtime` unwrapping, alias merging, `autoload`,
`entrypoint`, `useHttp` relocation — unverified. The exclusion list covers what
cannot match by construction: `$schema`, tool-injected `preload` entries (the pprof
capture path resolves against whatever ran the loader, and is injected by the
*runtime transform*, `runtime/lib/config.js:502`), `watch` and `restartOnError`,
`inspectorOptions`, properties the v4 schema removes, the deliberate `*_URL`
rewrites, and `kMetadata`. Equality is **modulo the audit's per-property
target-type table**, not raw: the v3 side validates with `useDefaults: true,
coerceTypes: true` (`basic/lib/config.js:76-80`) and the v4 side against the
audited schema with coercion off, so a raw comparison would mismatch on every
project the audit touched. A mismatch outside the exclusions is reported per-path.

The check runs **twice**: once as described, once with every referenced variable
masked to *unset*, so the fallback-path emissions (`?? ''`, per-property boolean
rules) are exercised too. The masked run covers only keys that are **not**
`requiredEnv`-wrapped — executing those would throw by design — and `requiredEnv`
keys are sentinel-injected in both runs, with the sentinel echoed into the v3
side's pinned `env` so both sides agree. When any application declares `enabled`,
the check additionally runs across both `production` values, since an
environment-disabled application is otherwise absent from the resolved view and
never compared at all.

Its position in the sequence is **step 3b** — after step 2's install and step 3's
load, because the v4 comparand does not exist until the files are written and the
v4 packages are actually installed. A mismatch triggers the manifest rollback of
step 5's machinery (created files removed, tracked files restored, lockfile
restored), so the install is inside the transaction. Generation reads only the
lexical and upgraded views. Then:

1. Emit the v4 files: for a v3 **single-app** project, one root file — the bare
   factory export when the v3 config carried no runtime settings, `defineConfig`
   with the singular `application` shorthand when it did (Levels 1/1b); for a
   **multi-app** project, per-app `watt.config.ts` files plus a thin root
   `watt.config.ts`. A per-app file is omitted only when it would contain
   nothing but defaults **and** the v4 detector provably reconstructs the v3
   `$schema` capability — exactly one app-local `@platformatic/*` dependency,
   equal to it; otherwise the file is emitted or the dependency added in step 2
   (v3's `$schema` + runtime-bundled fallback made app-local capability deps
   optional, so `$schema`-only apps must not lose their identity to framework
   inference). A **renamed** module never satisfies the gate on its old name: a
   `@platformatic/composer` app always gets an emitted `gateway(…)` file, and the
   superseded dependency is removed in step 2 — the one sanctioned `package.json`
   edit beyond ranges and additions. A **`module`-identified** app never satisfies
   it either (its capability is not `@platformatic/*`, so the detector cannot
   reconstruct it) and always gets an emitted `{ module: '…' }` plain-object
   config. An application whose directory coincides with the root — or with
   any directory already owning the root file — is emitted **root-inline**
   (`applications[].config: factory(…)`, resolvable by definition since its
   dependencies live at that root): the per-app style would put two v4
   candidates in one directory, which the loader rejects. Emission unwraps
   `runtime` blocks (treating the schema-accidental `runtime.services` like
   `runtime.applications`, with a warning), merges the `web`/`services`/`applications`
   aliases, and converts `{PLT_X}` placeholders into typed expressions that
   **preserve v3's unset-variable semantics** — v4 omits `undefined`-valued
   properties, so a bare `process.env.PLT_X` would silently change all three v3
   behaviors. Under effective non-strict mode a string position becomes
   `process.env.PLT_X ?? ''` (v3 replaced a missing variable with `''`); under
   effective `strictEnv: true` / `'warn'` the emitted file gets a small generated
   `requiredEnv('PLT_X')` helper that throws (or warns) when the variable is
   unset — a project that refused to boot without `TOKEN` still refuses after
   migration. Two carve-outs: "effective strictEnv" per app file follows v3's
   precedence (`strictEnvOption ?? config.strictEnv` — the *root* config's value
   wins when defined, `foundation/lib/configuration.js:540` with
   `runtime/lib/worker/controller.js:99,146`), and `*_URL`
   placeholders in **application** configs never get `requiredEnv` even under
   strict mode — v3 resolved unset `*_URL` keys through the current-app fallback,
   which warns and never throws — they get the literal or `?? ''` plus the review
   warning. That carve-out is application-scoped: `onMissingEnv` is supplied only
   where a worker parses an app config (`worker/controller.js:145`), so a
   **root**-config `*_URL` placeholder under effective `strictEnv` does throw on
   v3 and gets `requiredEnv` like any other key.
   Embedded placeholders become template literals with the same
   per-variable wrapping
   (`` `http://127.0.0.1:${process.env.PLT_OTLP_PORT ?? ''}/v1/metrics` ``);
   typed positions get the explicit coercion the audit's target-type table
   prescribes — and for booleans that table records **each property's exact v3
   rule**, because they differ by site (`enabled` is `!== 'false'`, so unset
   keeps the app; `watch` is `=== 'true'`, so unset is false) — or are flagged
   for review when no
   faithful expression exists; app-id URL placeholders become the literal
   `http://<id>.plt.local` per "Inter-application URLs"; positions on a
   capability's `replaceEnvIgnore` list (vendored into the generation table —
   db's OpenAPI `ignoreRoutes`, where `/users/{id}` is placeholder-shaped but
   must stay a literal) are emitted **verbatim**. Placeholders that v3 resolved
   from config `env` blocks or `envfile` contents — the v3 worker applied both to
   `process.env` *before* parsing the app's config — need **no special handling**:
   v4 makes both layers visible to per-app config evaluation (see "Env files"), so
   the ordinary `process.env.X ?? ''` emission resolves to the same value. Nothing
   is ever inlined; a codemod must not bake an `env`-block credential or a
   gitignored envfile's contents into tracked source. The two positions where the
   layers are not visible — the root config's own evaluation and root-inline
   entries — match v3, which never resolved those from `env` blocks either.
   Literal values in typed positions get the same treatment as placeholders: v3
   validated with `coerceTypes: true`, so `"port": "3001"` and `"workers": "4"`
   boot on v3 and are coerced at generation time per the target-type table rather
   than emitted as strings the v4 loader rejects. `strictEnv` itself has
   no v4 meaning and does not survive — its effect is baked into the emitted
   expressions, which users can hand-simplify to bare references afterwards: an
   informed edit, not a silent change. Property mappings with new v4 spellings:
   `useHttp: true` becomes `server: { port: 0 }` (the ephemeral-listener
   spelling) **only when the capability config declares no port of its own** —
   in v3 the app's own `server` block overrode the `useHttp` defaults
   (`basic/lib/capability.js:89`), so an app with both keeps its fixed port and
   gets a requires-review note; `keepAliveTimeout: 5000` and the non-entrypoint
   loopback `hostname: '127.0.0.1'` are carried over, and `useHttp` forces
   per-app-file emission regardless of the omit-defaults gate. `server.port` is
   **stripped from non-entrypoint applications**, since v4 turns it into a real
   listener and v3 generators wrote it into every per-app config (see "the listen
   rule"). Per-app `envfile` paths are rewritten from v3's root-relative
   base to app-relative so they keep pointing at the same file; a root
   `envfile` is converted by **promoting** the named file's contents to the root
   `.env` and renaming any pre-existing `.env` to `.env.v3-unused`, reporting every
   key whose v3 value differed — v3's `customEnvFile` *replaced* the whole `.env`
   walk (`foundation/lib/configuration.js:349-356`), so merging would both fail on
   ordinary dev/prod splits and silently activate keys v3 never read. Every
   `env`-block key migrate carries over gets a warning that v4's dotenv-order
   precedence means the real environment now outranks it. `.env.sample` values are **suggestions, not runtime truth** — v3
   never loaded that file, so turning samples into executable `??` defaults would
   change behavior when the real variable is absent; migrate emits them as defaults
   only under an explicit `--use-sample-defaults` flag, and otherwise notes them as
   comments. `{PLT_ROOT}` gets its own rule: `{PLT_ROOT}/x` becomes
   `join(import.meta.dirname, 'x')` (adding the `node:path` import) — correct in
   migrate's per-app output, where `import.meta.dirname` *is* the app root; the docs
   flag that the expression must be rewritten if later moved into a root-inline
   entry.
2. **Audit and install v4 dependencies before validating anything.** The emitted
   per-app files import v4 factories and the thin root imports `defineConfig`
   from `wattpm` — and validation must run against what those imports will
   *actually resolve*: editing a version range changes nothing on disk, and ESM
   resolution from an app-local file still finds the installed v3 package, which
   has no factory export and follows the dead v3 contract. So migrate: detects
   the package manager from the lockfile; adds or upgrades the root `wattpm`
   dependency (umbrella-`platformatic` projects never had it) and every emitted
   factory's app-local `@platformatic/*` dependency to the current major —
   including dependencies previously satisfied only by the runtime's bundled
   fallback (range and dependency-list edits only; dependency *placement* is
   still never changed); asks for consent once and **runs the install itself**,
   with the lockfile joining the migration transaction
   (`--install`/`--no-install` for non-interactive runs; `--no-install` stops
   after emitting files and manifests, prints the install command, and defers
   the rest to **`migrate --resume`** — which exempts exactly the persisted
   manifest's entries from the dirty-tree check, skips regeneration of
   unmodified emitted files, and continues at install/validation). An
   install failure aborts before anything is deleted. The third-party check —
   **any capability outside the vendored closure** stops the run with
   "hand-conversion required", naming the packages that block it — actually
   executes **before step 1 writes anything**: it needs only the lexical view's
   module list, and "stops before modifying any file" must be literally true. The
   gate is deliberately about closure membership, not v4 readiness: without a
   frozen v3 schema, transform, upgrade chain, and target-type table, migrate
   cannot build the resolved view for that app or decide whether `"{ACME_PORT}"`
   is a number, boolean, or string position — which matches Goal 6's stated scope
   ("anything that boots on v3 **with in-tree capabilities**"). A documented
   contribution point — a capability shipping its own frozen
   `{ schema, transform, upgrade, targetTypes }` bundle — is a possible post-4.0
   addition.
3. **Validate the emitted files by explicit path**: migrate loads the generated
   configuration through the real v4 loader via a **private, migrator-only
   direct-path entry** that skips **the upward walk and the legacy-coexistence
   guard only** — the legacy files are still present at this point by design.
   Everything else runs: per-app discovery, `autoload` expansion, the per-app eval
   workers, the capability detector, capability validation, and the version-stamp
   check. (Skipping *discovery* would leave multi-app output — where migrate does
   most of its work — validated only at the root.) This bypass is *not* the public
   `--config` flag:
   `--config` performs the full unconditional legacy scan of the selected
   directory and every discovered app directory, so it can never be used to
   sidestep the no-coexistence guard. Validation injects recorded **sentinel
   values** for `requiredEnv`-wrapped keys — executing the emitted helpers
   would otherwise throw on any machine missing the production secrets — and
   the summary reports the required-variable list instead. If validation
   fails, report and stop;
   nothing has been deleted yet.
4. Scan application sources for references to the legacy config files (v3
   scaffolded test helpers do `JSON.parse(await readFile(…, 'watt.json'))`) and
   for `PLT_DEV` / `PLT_ENVIRONMENT` / `PLT_ROOT` reads (all three injected
   variables are removed in v4): any
   hit is reported with the file/line of the reference, since the codemod cannot
   safely rewrite user code and the change will make that code fail or branch
   differently.
5. **Delete the legacy files** and print a summary. There is no rename, no
   `.v3.bak`, no `--keep` — **version control is the undo mechanism**: migrate
   refuses to run on a dirty git tree (`--force` overrides, with a loud warning;
   same flag for no-VCS trees), so review is `git diff`. The dirty check counts
   **untracked legacy candidates** as dirty and blocks, naming them: an
   untracked or gitignored `platformatic.json` (secrets are a common reason)
   would be unrecoverable after deletion — `git restore` cannot resurrect what
   git never tracked — so the user commits it or excludes it deliberately
   first. Rollback is precise,
   not blanket: `git restore .` alone would resurrect the legacy files while
   leaving the newly created — untracked — `watt.config.ts` files in place,
   reproducing exactly the forbidden coexistence state. Migrate therefore keeps
   a **manifest of every file it created or modified**, persisted as
   `.wattpm-migrate.json` for the life of the run (it is what `--resume` reads,
   and it is deleted on completion): on any mid-run failure
   it removes its own creations automatically, and on success the summary prints
   the exact path-scoped undo (`git restore <tracked…> && rm <created…>`) — never
   a bare `git restore .`, and never any form of `git clean`.

(No `.env` *file* conflict warning is needed — app-wins layering preserves v3's
observable file precedence; the `env`-block precedence change has its own
per-key warning in step 1.)

Because migration emits the per-app style, dependency *placement* is never
changed — the only `package.json` edits are the consented dependency changes from
step 2: the v4 range bumps, missing app-local capability entries, and the root
`wattpm` dependency.

---

## Breaking changes (v4)

1. `runtime` wrapped block in capability configs: **removed** (`wrapInRuntimeConfig`,
   `wrappedRuntime`, both exclusion lists, and `_runtime-in-capabilities.md` deleted).
2. `web` and `services` aliases: **removed**; `applications` only.
3. **All non-code config formats removed** — JSON included. Any `.json` config file is
   refused with the migrate hint. `getParser`/`getStringifier` and the format
   machinery are deleted from the loader.
4. `{PLT_X}` interpolation, `strictEnv`, root `envfile`: **removed**; `wattpm-utils migrate`
   converts them.
5. Env files: the recognized set grows to `.env`, `.env.local`, `.env.<mode>`,
   `.env.<mode>.local`, and layering reads **root and app files together** where
   v3's first-hit walk read exactly one file. This is a **behavior change**:
   pre-existing `.env.local`/`.env.production` files written for *other* tools
   (Next.js uses exactly these names) become live in worker environments. The
   walk is also **narrower**: v3 climbed to the filesystem root with a cwd
   fallback; v4 reads exactly two directories (the root config file's directory
   and the application directory), never above the boundary — `.env` files v3
   found elsewhere stop loading. Precedence direction stays v3-compatible for
   files (app overrides root-file defaults; the real environment always wins).
   The root and entry `env` blocks are now also visible during **per-app config
   evaluation**, which v3 achieved by applying them to `process.env` before the
   worker parsed the app's config; the root config's own evaluation and
   root-inline entries are excluded, as in v3.
6. `verticalScaler`, `healthChecksTimeouts`: removed from the v4 schema.
7. Schema audit: placeholder-string unions removed from every schema (validation is
   stricter; migrate emits typed values).
8. Auto-written `watt.json` (`?autogenerated=true`): removed.
9. `wattpm patch-config` (CLI): removed. The programmatic
   `setApplicationConfigPatch` API stays, with byte-compatible patch documents
   (applied pre-transform, as in v3).
10. `wattpm config`: removed (`--debug-config` is the local inspection tool).
11. `wattpm applications:add`/`applications:remove`: the endpoints survive, but
    `POST /applications` now runs the full per-app eval/validation pass (posted
    workers no longer self-load config) and its request-body `config` type
    changes with item 14; `--save` is retained via magicast (snippet fallback
    for non-static shapes).
12. Capability CLI commands (`db:*`, `gateway:*`, `next:*`): the `createCommands`
    contract changes from config-file-path to `{ root, config }` data; commands no
    longer self-load config, and the `utimesSync` restart trick is replaced by a
    management-API restart.
13. Management API `GET /config` and `GET /api/v1/applications/:id/config`
    endpoints: removed (watt-admin coordination required; the `wattpm` commands
    built on them are handled per items 10–12).
14. Worker boot protocol: workers receive `resolvedConfig` (data) instead of a config
    file path; per-worker config parsing is deleted. Everything typed as
    "config file path" changes accordingly: the application entry's `config`
    property no longer accepts a path (it takes an inline definition),
    `autoload.mappings[].config` (a filename) is removed, and
    `getRuntimeConfig`/`getApplicationDetails` payloads carry `configPath` +
    `resolvedConfig` as a versioned DTO instead of a bare path — a declared type
    change for every management-API consumer, separate from patch-document
    compatibility (which is preserved).
15. Capability packages must implement the v4 create contract (resolved config as
    data) and should export a factory (all in-tree capabilities get both); plain
    `{ module }` objects cover v4-contract capabilities without factories.
    Capabilities frozen on the v3 contract are unsupported.
16. Validation runs with `coerceTypes: false`: values that relied on AJV coercion
    (`"4"` as a number, `1` as a boolean) are rejected with precise errors.
17. `wattpm dev`/`build`/`start` become **location-sensitive**: run inside an
    application directory they act on that application standalone (with a warning
    when a root config exists above); v3 booted the whole runtime from anywhere.
    Scope is purely positional — the runtime-wide behavior means running from the
    project root; there is no scope flag. Build environments exclude injected URLs
    and `env` blocks in any mode, and a **root** build warns naming the withheld
    `env`-block keys; a standalone build cannot, and can therefore diverge from a
    root build whenever an application declares `envfile` or an `env` block feeds
    its config evaluation. Under `build`, `production` is `true`, so `enabled`
    resolves against the production mode where v3's build resolved against
    development.
18. Worker env precedence: config `env` blocks **no longer override the real
    environment** — v4 follows the dotenv convention (the real environment is
    always authoritative; blocks beat injection and files, nothing beats the
    real environment). v3 applied blocks last, as pins; migrate warns per
    colliding key.
19. `useHttp`: **removed** — an app's `server: { port: 0 }` is the v4 spelling
    (ephemeral port per worker); migrate rewrites it, and the gateway's
    WebSocket diagnostics now point at `server.port: 0`.
20. Injected variables: `PLT_DEV`, `PLT_ENVIRONMENT` and `PLT_ROOT` are
    **removed** (the migrate source scan flags reads); `PLT_<ID>_URL` injection
    now covers every application including the app's own self-URL. `NODE_ENV`
    remains, as the **lowest** rung of both ladders: it defaults to `production`
    when `production` is `true` and nothing else supplied it, exactly as in v3
    (`worker/controller.js:126-129`), under `start` and `build` alike.
21. Per-application `envfile`: now governs **config evaluation and runtime
    alike**, resolves **app-relative** (v3 resolved against the runtime root —
    migrate rewrites paths), and naming a missing file is an error (v3
    silently ignored it). Declaring it on an entry that carries an inline
    `config` is an error — that entry has no per-app eval worker.
22. **Listening changed in three ways.** A non-entrypoint application whose own
    `server` block sets a port now opens a real listener; in v3 that value was
    inert (`worker/controller.js:218`), so migrate strips it from non-entrypoint
    apps. The entrypoint's address resolves root `server` → its own `server`
    block, a **unification** of two divergent v3 merge orders (basic-family let
    the app win, service-family let the root win) and a change for the former.
    And there is **no port default**: when nothing declares a port the
    application's own `listen()` stands, or it gets an ephemeral port —
    unchanged from v3, but the `PORT`/3042 convention now lives visibly in
    scaffolded config rather than implicitly in the loader. `reuseTcpPorts` and
    `server.portAssignment` survive unchanged.
23. `@platformatic/composer` (the deprecated `@platformatic/gateway` alias
    package) is **removed**. Migrate renames the module and removes the
    superseded dependency.

There is no deprecation window inside v4: old shapes fail fast with an actionable
error. The migration story is the codemod, not a compat layer.

---

## Implementation plan

Roughly ordered; steps 1–5 are the critical path.

1. **foundation — a fresh loader, not a refactor.** The v4 loader is written new for
   v4: the eval-worker (fresh ESM cache per load, `.env` applied in-worker,
   import-graph collection via `module.registerHooks`, the collected graph wired
   into the dev watcher), filename resolution and the bounded walk, the `.json` →
   migrate-hint error, and the in-worker serializability check (pre-`postMessage`)
   → validate → `kMetadata` → `transform` pipeline are a
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
   accepts inline definitions; phased evaluation (root worker first, per-app
   workers in parallel) with uniform per-app file
   discovery (autoload and explicit entries alike) and walk-boundary/classification
   rules; the deterministic zero-config capability detector (capability
   dependencies first, ambiguity error on two, JS-files → node terminal rule);
   entrypoint listen resolution (root `server` → own `server` → defaults) with
   auto-wrap server hoisting and the `port: 0` per-worker ephemeral listener
   class; `resolvedConfig` (validated raw) through `workerData` with
   worker-side `kMetadata` reconstruction; `PLT_<ID>_URL`
   injection (self included) with the ladder defined in "Inter-application URLs",
   `injectedKeys` provenance and inbound `envFileKeys`, and the
   id-normalization collision error; the `'exec'` config context for capability
   commands, with the capability transform and synthesized `kMetadata` main-side;
   `POST /applications` **and the ITC `management:addApplications` handler**
   running the boot-time eval pass; remove
   `GET /config` and
   `GET /applications/:id/config`, extend `GET /metadata` with
   `root`/`configPath`/`autoload`;
   shallow root-wins merge (v3 semantics); in-memory zero-config synthesis; lazy
   capability-command dispatch (no config evaluation on plain `wattpm help`).
5. **wattpm**: export `defineConfig`, `WattConfig` and factory types generated from
   the audited schemas; `wattpm dev` watches the eval worker's collected import
   graph; `--debug-config` via the eval-worker pipeline, with the single-file
   in-process `--inspect-brk` mode; `build` evaluates
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
   `watt.config.ts`; remove `patch-config`. **`wattpm-utils migrate` lives here,
   under `wattpm-utils`' own binary — no `wattpm` routing**: it hosts the vendored
   v3 closure (foundation machinery, the four upgrade chains — dual-run against
   token and resolved views — frozen snapshots of
   the ~13 capability schemas, transforms, and `replaceEnvIgnore` lists, plus
   the runtime's config machinery for the resolved view, with their tests) as
   private code
   behind the three-view reader (lexical / upgraded / resolved-for-verification),
   runs the consented dependency install, keeps the `.wattpm-migrate.json`
   manifest for `--resume` and rollback,
   shares nothing with the v4 loader, and releases on its own cadence. **Stable
   v4.0 gates on it** — GA requires a published, tested migrate — while post-GA
   fixes stay decoupled: `npx` resolves at invocation time, so they reach every
   installed v4 runtime without a runtime re-release.
8. **create-wattpm + generators**: wizard output switches to `.ts` (`.mts`/`.js` per
   package type) and emits config only for non-default answers (single-app defaults
   produce no config file); scaffolded test helpers import the config module instead
   of `JSON.parse`-ing `watt.json`; fixture conversion codemod for the ~868 in-tree
   JSON fixtures.
9. **cross-repo**: watt-admin migrates off `GET /config`; **`@platformatic/control`**
   drops or re-points `getRuntimeConfig`/`getApplicationConfig`
   (`control/lib/index.js:246,263`, both removed endpoints) — a published-package
   API change, not an internal detail; the out-of-tree capabilities (`php`,
   `ai-warp`, `pg-hooks`, `rabbitmq-hooks`, `kafka-hooks`) get the v4 create
   contract, a factory, and a `/schema` subpath, or are declared unsupported;
   ICC guidance for generating plain-object configs.
10. **docs**: one configuration reference; migration guide; erasable-TS constraints;
    env precedence; the machine-generated config pattern.

There is **no v3 preview**: nothing ships on the v3 branch (clean cut). Real-world
contact for the factory API comes from v4.0 alphas and release candidates, which are
cheap to iterate because the loader is new code with no v3 entanglement.

---

## Appendix A — type sketch

```ts
// wattpm
export interface WattConfig {
  entrypoint?: string
  basePath?: string
  application?: ApplicationEntry           // single-app shorthand; exclusive
                                           // with applications AND autoload
  applications?: ApplicationEntry[]
  autoload?: { path: string, exclude?: string[], mappings?: Record<string, ApplicationEntryOverrides> }
  // ApplicationEntryOverrides = Omit<ApplicationEntry, 'config' | 'path'> —
  // the orchestration subset: env, envfile, workers, health, enabled,
  // dependencies, telemetry, preload, … (v3's mappings[].config is removed)
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
  applicationTimeout?: number
  messagingTimeout?: number
  workersRestartDelay?: number
  watch?: boolean
  managementApi?: boolean | ManagementApiOptions   // socket path is .socket
  management?: boolean
  scheduler?: SchedulerJob[]
  policies?: { deny?: Record<string, string | string[]> }
  preload?: string | string[]
  extensions?: string | ExtensionEntry | (string | ExtensionEntry)[]
  env?: Record<string, string>            // workers' runtime env, and visible to
                                          // per-app config evaluation (see
                                          // "Env files")
  reuseTcpPorts?: boolean                 // default true — SO_REUSEPORT
  resolvedApplicationsBasePath?: string   // used by `wattpm resolve`
  exitOnUnhandledErrors?: boolean
  sourceMaps?: boolean
  compileCache?: boolean | CompileCacheOptions
  // …complete list generated from the audited v4 runtime schema
}

export interface ServerOptions {
  hostname?: string
  port?: number                            // 0 = ephemeral
  portAssignment?: 'shared' | 'perWorkerIncrement'
  backlog?: number
  http2?: boolean
  https?: HttpsOptions
  // …
}

export interface ApplicationEntry {
  id?: string
  path?: string
  url?: string
  gitBranch?: string
  config?: ApplicationDefinition          // factory result, plain { module } object,
    | DeferredApplicationDefinition       // or a callback form awaited by the
                                          // root worker's resolution pass
  enabled?: boolean | Record<string, boolean>   // keyed by `mode`; resolved in the
                                                // root worker, before fan-out
  workers?: number | ApplicationWorkersOptions
  health?: ApplicationHealthOptions
  env?: Record<string, string>            // worker runtime env, and visible to
                                          // this app's config evaluation
  envfile?: string                        // replaces the app's four-file env set
                                          // in BOTH views (evaluation + runtime);
                                          // app-relative; missing file = error;
                                          // error alongside an inline `config`
  reuseTcpPorts?: boolean
  restartOnError?: boolean | number
  management?: boolean                    // gates the ITC ManagementClient
  arguments?: string[]
  execArgv?: string[]
  nodeModulesSourceMaps?: boolean
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

export type ConfigContext = {
  command: 'dev' | 'build' | 'start' | 'exec'   // 'exec' = capability commands
                                                // and other non-boot evaluation
  mode: string
  production: boolean
  env: Readonly<Record<string, string | undefined>>  // snapshot, not live process.env
  root: string
}

export function defineConfig (config: WattConfig): WattConfig
export function defineConfig (fn: (ctx: ConfigContext) => WattConfig | Promise<WattConfig>): typeof fn
```

```ts
// @platformatic/next — factory options are per-app capability config ONLY
export interface NextConfigOptions {
  trailingSlash?: boolean          // flattened from the v3 `next` block; audit
                                   // removal candidate (mirrors next.config.*)
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
export function next (
  cb: (ctx: ConfigContext) => NextConfigOptions | Promise<NextConfigOptions>
): DeferredApplicationDefinition               // resolved by the loader before
                                               // classification; `.module` is not
                                               // readable on it
// ConfigContext re-exported from @platformatic/basic
```

## Appendix B — before/after: the wrapped single-app config

**v3 (capability dialect, wrapped runtime):**

```json
{
  "$schema": "https://schemas.platformatic.dev/@platformatic/next/3.65.0.json",
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
  application: {
    workers: 2,
    config: next({
      cache: { adapter: 'redis', url: process.env.PLT_REDIS_URL }
    })
  }
})
```

And when this project later joins a monorepo, the `next({ … })` expression moves
verbatim into `web/frontend/watt.config.ts` as its default export — no dependency
moves, no dialect change.
