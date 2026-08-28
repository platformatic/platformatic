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
`npx wattpm-utils@4 migrate`.

The core structural change is that **there is exactly one configuration dialect**: the
runtime dialect. The distinction between "a single-app config with a nested `runtime`
block" and "a runtime config with nested applications" disappears. A single-app project
and a 20-app monorepo use the same dialect; scaling from one to many means **the
application definition moves unchanged** — a single app's entire `watt.config.ts`
becomes that app's per-app file, and the `next({ … })` expression is
syntactically identical in a single-app root, a root-inline entry, and a per-app
file. Two things differ and neither is the shape: which directory's env files the
evaluation sees (see "Env files"), and a port expression naming the global `PORT`,
which has to be scoped when siblings appear beside it (see the Summary).

```ts config
// watt.config.ts — a complete single-app Next.js project
import { next } from '@platformatic/next'

export default next({
  server: { port: Number(process.env.PORT || 3042) },
  cache: { adapter: 'redis', url: process.env.REDIS_URL ?? '' }
})
```

The `server` block is not decoration: an application declares its own address, and
one that declares none is mesh-only and serves no external traffic (see "How
applications are exposed"). Every example below that is meant to be reachable
therefore carries one.

That bare factory export is the **canonical single-app form** — the loader
auto-wraps it as a single-app runtime, and the file is byte-identical to a monorepo
per-app config file.

**One expression in it does not travel, and it is the port.** `process.env.PORT` is
right for a single application, because that is the variable every platform sets and
there is one application to give it to. Put the same file in a monorepo beside three
siblings and all four read it: an operator setting `PORT=8080` hands 8080 to every
application, the real environment outranks every app-local `.env` that might have
said otherwise, and no file below can repair it. Dropping the port is not the way
out either — a framework application with no port does not start under `dev` (see the
matrix in "How applications are exposed"; Vite in SSR mode is the exception, being
classified by its worker). So an application that joins a monorepo **scopes its port
variable** — `process.env.PLT_FRONTEND_PORT`, the `PLT_<ID>_` spelling the mesh
already uses for `PLT_<ID>_URL`, and the one v3's generators switched to the moment
an application was in runtime context rather than standalone
(`generators/lib/base-generator.js:112-120`). The file's *shape* is portable. A
variable that means "the port" to the whole machine is not, and byte-identical is a
claim about the first.

Runtime orchestration options, when a project needs them, come
from `defineConfig`:

```ts config
import { defineConfig } from 'wattpm'
import { next } from '@platformatic/next'

export default defineConfig({
  logger: { level: 'info' },
  application: {
    workers: 2,
    config: next({
      server: { port: Number(process.env.PORT || 3042) },
      cache: { adapter: 'redis', url: process.env.REDIS_URL ?? '' }
    })
  }
})
```

Note where the port is: **inside the factory**. v4 has no runtime-level listener —
each application exposes itself through its own capability configuration (see "How
applications are exposed").

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

Everything the JSON system can express remains expressible. The **capability payload**
— the normalized per-application configuration a capability receives and validates —
is unchanged; what changes is how it is authored, where it is evaluated, and how it
reaches the workers. The runtime's own model does move in two stated ways: workers
receive `resolvedConfig` as data rather than a file path to re-read (BC 14), and
`autoload` expansion happens in the root eval worker ahead of `transform()` rather
than inside it.

---

## Motivation

### Problem 1 — two dialects, and the `runtime` block is the worst of it

Today a multi-app project has a root config in the *runtime dialect*:

```json v3
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

```json v3
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
  at boot (`wrapInRuntimeConfig`, `packages/runtime/lib/config.js:135`) — machinery
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

- **The capability payload stays.** What a capability receives and validates is the
  same normalized object, so capabilities need no change on that axis. The runtime's
  own model is not wholly unchanged — see the Summary for the two places it moves.
- **AJV validation** stays authoritative; TypeScript types are an authoring aid.
- **Zero-config boot** stays: `wattpm dev` in a bare Next/Vite/Node repo with no config
  file keeps working via the deterministic v4 capability detector (direct capability
  dependencies first — see "Loading mechanism"), and v4 stops writing an
  auto-generated `watt.json` into the user's tree — the synthesized config lives only
  in memory. Synthesis supplies `server: { port: Number(env.PORT || 3042) }` from the
  resolved env map, so a bare framework repo is actually reachable and a `PORT` in its
  `.env` is honoured — see "How applications are exposed".

---

## Goals

1. One configuration dialect and **one configuration format**. The `runtime` wrapped
   block, `wrapInRuntimeConfig`, the `web`/`services` aliases, and all non-code config
   formats are removed.
2. `watt.config.{ts,js,mts,mjs}` loaded with **zero new dependencies** (Node ≥ 22.19
   type stripping is already our floor).
3. Full typed autocomplete backed by **tightened schemas**: the placeholder-string
   unions are audited out in v4.0, so generated types are strict at launch.
4. Single-app → multi-app: the application definition moves unchanged apart from a
   global `PORT` expression, which scopes to `PLT_<ID>_PORT`; migration never
   relocates dependencies.
5. Env handling becomes ordinary JavaScript (`process.env`), with `.env` loaded before
   the config file is evaluated and a fully documented precedence.
6. A `wattpm-utils migrate` codemod that automatically converts v3 projects built on
   in-tree capabilities. The promise is **never silently**, not "always faithfully":
   where v3 and v4 cannot agree, migrate either stops or tells you, and both sets are
   enumerated in one place (see "`wattpm-utils migrate`").

   - **Refusals** — the pre-flight gate, before any write. These are inputs with no
     single correct v4 form, where picking one reading would be worse than naming the
     file and stopping.
   - **Reported divergences** — conversions that are emitted but change behaviour,
     each carrying a *requires-review* note that names the file, the position and
     what changed. A placeholder whose value came from an `env` block now yields
     `''`; every carried `env` key is now outranked by the real environment; a
     structural path may be recovered from `.env.sample` or the `web/<id>`
     convention rather than from a value v3 actually had.

   The second class exists because the alternative is worse: refusing them would
   reject shapes ordinary v3 projects have. What migrate must never do is convert and
   say nothing.
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
orchestration, and the file is byte-identical to a monorepo per-app config file
except for the port variable, which scopes when siblings exist (see the Summary).
This is the canonical single-app form. `migrate` emits it when the v3 config carried
no runtime settings **and** the v4 default id matches the v3 one — a bare factory
export has no entry to carry an explicit `id`, so a project whose id would move needs
Level 1b instead (see "`wattpm-utils migrate`").

**Level 1b — single app with runtime options.** When there is orchestration to
express, `defineConfig` with the singular `application` shorthand. Every runtime
option (`logger`, `health`, `metrics`, `telemetry`, `undici`,
`httpCache`, `gracefulShutdown`, …) is top-level — exactly where it is in a
multi-app config. **The `runtime` block does not exist in v4.** `migrate` emits
this form when the v3 config had a non-default `runtime` block.

**Level 2 — multi-app monorepo.** The default multi-app style is a **thin root plus
per-app config files**: the root owns orchestration and discovery (`autoload`
survives), and each application's configuration lives in the app's own
`watt.config.ts`, which exports **the same factory expression** a single-app
project would use, with the port variable scoped to the application:

```ts config
// watt.config.ts (root)
import { defineConfig } from 'wattpm'

export default defineConfig({
  autoload: { path: 'web' }
})
```

```ts config
// web/frontend/watt.config.ts
import { next } from '@platformatic/next'

export default next({
  server: { port: Number(process.env.PLT_FRONTEND_PORT || 3042) },
  cache: { adapter: 'redis', url: process.env.REDIS_URL ?? '' }
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

```ts config
// watt.config.ts
import { defineConfig } from 'wattpm'
import { gateway } from '@platformatic/gateway'
import { service } from '@platformatic/service'
import { next } from '@platformatic/next'

export default defineConfig(({ env, production }) => ({
  logger: { level: production ? 'warn' : 'info' },
  metrics: production ? { port: 9090 } : false,

  applications: [
    {
      id: 'gateway',
      path: 'web/gateway',
      config: gateway({
        server: { port: Number(env.PLT_GATEWAY_PORT || 3042) },
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
      config: service({ basePath: '/api' })
    },
    {
      id: 'frontend',
      path: 'web/frontend',
      config: next({ server: { port: 0 } })
    }
  ]
}))
```

The functional form receives the command-aware context (`production` is `true`
under `start`/`build`); config never branches on ambient `NODE_ENV`.

`api` declares no `server` block and is therefore reachable only through the mesh;
`frontend` declares `port: 0` because a framework capability does not start under
`dev` without one; `gateway` declares the fixed public port. That is the whole exposure
model — see "How applications are exposed".

Note the boundary: `workers`, `health`, `env`, `dependencies` and the other
orchestration properties live **on the entry**; everything the capability understands
lives **inside the factory** — `server` among them, with no root or entry-level
counterpart to merge against. The two never merge into one bag, which is what keeps
same-named properties (`telemetry` above; `logger`, `watch`) structurally
unambiguous — flattening them together would be unsound: `telemetry` means two
incompatible things for service/db/gateway, and several capabilities collide even
within themselves.

A per-app file contributes **capability configuration only** — it exports an
`ApplicationDefinition`, and factories reject orchestration properties — so
orchestration is always root-lexical, which is what lets the loader know an app's
`env`, `envfile` and `enabled` before that app is evaluated. Where two *entries*
describe the same app id — one discovered by `autoload`, one listed explicitly —
their orchestration keys merge **shallowly, per-key, the explicit entry winning**
(`runtime/lib/config.js:476-481`, v3 semantics) — **but only once the two are known
to be the same application.** v3 matched on `id` alone, which is not sufficient: an
explicit `{ id: 'api', url: '…' }` beside an autoloaded `web/api` merges into an entry
that keeps the local `path` *and* carries the `url`, so `wattpm resolve` skips the
remote (its path exists) and the runtime boots local code while the configuration
names a repository. v4 merges only when the entries identify the same application —
equal canonical `path`, or a `url` matching what the autoloaded directory resolves
to — and otherwise reports a **duplicate id** naming both sources. An id is the mesh
hostname, the injected `PLT_<ID>_URL`, the metrics label and `wattpm inject`'s
argument, so two distinct applications cannot share one. (Filed against the runtime
as platformatic/platformatic#5079; v4 does not inherit it.) Capability configuration
has exactly **one
owner**: a root entry carrying an inline `config` while the app directory also
contains a `watt.config.*` file is a **boot error** naming both sources. The
check exempts **the deciding file itself**: an entry whose directory is the
directory of the config file that produced it (the Level 1 auto-wrap, the
`application` shorthand, a machine-generated `path: '.'` entry) is configured
*by* that file, not twice —

``` output
✗ 'frontend' is configured twice: inline in watt.config.ts and in
  web/frontend/watt.config.ts. Move the factory call into the per-app file,
  or remove one of the two.
```

Silent shadowing is not an option here: package-local commands evaluate the
nearest file, so a shadowed per-app config would still win under a standalone
boot — the same app running two different configurations depending on where the
command was typed. Erroring removes the *shadowing*; it does not make the two boots
identical, and this document should not claim it does. **Three things differ**, all
of them environmental rather than structural: the root-owned `envfile` and `env`
blocks a standalone boot does not apply, the sibling `PLT_<ID>_URL` values that only
exist inside a mesh, and **topology-key stripping** — a per-app worker has the
injected names removed from its environment and the root worker cannot, so a file
that reads one gets a different answer depending on which worker runs it (see "Env
files"). What erroring buys is that the same *file* is used either way; the
standalone warning names all three. The check is a filename-presence
test, no evaluation needed, and `migrate` never emits this state.

### Functional form and the config context

`defineConfig` also accepts a function, sync or async — and so do **per-app config
files**: a function export is called once with the context and its *resolved value*
is classified (root config or application definition) by the normal rules.

```ts config
import { defineConfig } from 'wattpm'

export default defineConfig(({ command, mode, production, env }) => ({
  watch: command === 'dev',
  logger: { level: mode === 'staging' ? 'debug' : production ? 'warn' : 'info' },
  applications: [/* … */]
}))
```

```ts config
// web/frontend/watt.config.ts — per-app conditionals, typed via the factory
import { next } from '@platformatic/next'

export default next(({ mode }) => ({
  cache: mode === 'test' ? undefined : { adapter: 'redis', url: process.env.REDIS_URL ?? '' }
}))
```

Every factory's options parameter also accepts a **callback** (sync or async)
receiving the typed `ConfigContext` — so per-app files get contextual autocomplete
from the import they already have, without depending on `wattpm` (Node's `node_modules` walk-up
usually does resolve it from an app directory, but the typing is the point). The implementation reuses classification
rule 1: `next(cb)` returns the function `async ctx => next(await cb(ctx))`
(the `await` is what makes the async half of the contract work — the callback's
promise must resolve *before* the factory sees the options), which the loader
calls with the context and re-classifies — serializability is untouched (the
callback resolves before anything crosses a worker boundary). As a per-app
export the desugared function is invoked by classification rule 1; in a
root-inline entry the root worker awaits every function-valued
`application.config` / `applications[].config` after unwrapping the root export
and before the serializability check.

**The context is the same object at every position a callback is legal.** `ctx.env`
is the evaluating worker's environment view, and no `env` block ever contributes to it
(see "Env files") — so the eager and deferred forms observe an identical environment.
This is a property of evaluation happening *in a worker Watt constructed*, which is
why the callback form is rejected in a programmatic object source, where there is no
such worker (see "Object config sources"). An eager expression in a programmatic
object is evaluated by the embedder before `create()` is called at all, so it reads
the embedder's environment by construction — that is inherent to passing an
already-built object, not something the loader could change.
`config: next({ url: process.env.X })` and
`config: next(ctx => ({ url: ctx.env.X }))` resolve `X` the same way — absent
mutation during evaluation, since `ctx.env` is a snapshot taken at the start and
`process.env` stays live (the diff-and-warn below exists for exactly that case). The callback
exists to type its parameter and to allow asynchronous option construction, not to
observe anything the eager form cannot; there is no position whose environment
depends on the file having been unwrapped first, which is what keeps the loader
free of a per-entry resolution pass. A
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
  travels in `workerData`, and the **main process** resolves each worker's env from
  the same layered file set config evaluation used — workers never read env files
  themselves — so for an application configured by a **per-app
  file** the two views' env-file rungs agree by construction. (A **root-inline**
  entry is evaluated in the root worker, so it reads the root file's directory,
  while its workers read the application's directory over the nearest files above
  it — see the position asymmetry in "Env files".) It is *not* injected as an environment variable (no `PLT_MODE`).
  `start` must be given the same `--mode` as `build` to reproduce the same
  env-file view (Vite parity, documented).
- `production` — the common-case shortcut: `true` under `start`/`--production`
  **and under `build`** (build produces production artifacts).
- `env` — a **snapshot** of `process.env` after env-file merging, taken at the start
  of evaluation (see "Env files"); `env` blocks are not part of it, at any position.
  Later `process.env` writes are visible through `process.env`, not through
  `ctx.env`. The context and its `env` are **frozen**, not merely typed
  `Readonly<…>`: one context object is handed to every callback in a file, so a
  config that wrote to `ctx.env` would change what later deferred entries observe,
  make the result depend on evaluation order, and do it without tripping the
  `process.env` mutation warning — which watches a different object.
- `root` — absolute directory of the config file.
- `addWatchFile(path)` — declares a file the configuration **reads** rather than
  imports, so `wattpm dev` watches it (see "Loading mechanism"). It is the one member
  that is a function rather than data, and it does not make the context mutable: it
  reports a path outward and returns nothing, so two callbacks in one file cannot
  observe each other through it. Outside a watching command it is a no-op, which keeps
  a config that calls it from behaving differently under `start`.

### Capability factories

Each capability package exports one typed factory plus its option types:

```ts decl
// from @platformatic/next
import type { ApplicationDefinition, ConfigContext, DeferredApplicationDefinition } from '@platformatic/basic'
import type { NextConfigOptions } from '@platformatic/next'

export declare function next (options?: NextConfigOptions): ApplicationDefinition
export declare function next (
  cb: (ctx: ConfigContext) => NextConfigOptions | Promise<NextConfigOptions>
): DeferredApplicationDefinition
```

**Two overloads, not a union parameter.** The callback form returns a
`DeferredApplicationDefinition` — a function the loader awaits — so reading `.module`
on it is a type error until it has run. A single signature returning
`ApplicationDefinition` for both forms would typecheck `next(cb).module`, which is
exactly the mistake the deferred type exists to prevent.

Factory options are the capability's per-app configuration — what lived in the app's
own config file in v3 — with the capability's namespaced block flattened into the top
level (`next.trailingSlash` → `trailingSlash`) and the shared blocks (`logger`,
`server`, `watch`, `application`) kept at their v3 positions. The
`application` block deliberately stays nested: several capabilities (remix, nuxt,
nitro, react-router) define their own `outputDirectory` alongside
`application.outputDirectory`, and hoisting both would collide.

Flattening is defined over a **list** of blocks per capability, not a single one:
every vite-derived capability flattens `vite` plus its own block (remix, nuxt,
nitro, react-router), while tanstack — which has no block of its own — flattens
`vite` alone. `nitro`'s block contributes both `outputDirectory` and `entrypoint` — the latter a
v3-era name that is no longer a root key, so only `outputDirectory` collides today. `defineCapabilityFactory` takes that list in its options, and a build-time assertion
checks that the flattened key set collides neither with itself nor with any
**retained top-level key of that capability's own schema**.

The assertion is not hypothetical: `db`'s block carries a `cache` property
(boolean), and top-level `cache` exists in exactly one capability schema — `next`'s.
`cache` is therefore a **per-capability** block, not a shared one, and the audit
records the `db.cache` decision (rename, keep nested, or exclude from flattening)
so the assertion passes on day one. Two capabilities meaning structurally different
things at one flattened key is precisely the hazard the entry/factory split exists
to prevent.

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

```ts decl
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
`applications[].module` and `applications[].definitionVersion` — renamed on the way
out because `getApplicationDetails().version` already means the capability version
the *running worker* loaded (see "Machine-generated configs") — next to
`resolvedConfig`, which carries only the capability payload.

The stamped `version` closes the root/app skew hole: a root-inline factory resolves
from the root's copy of the capability, while the worker implementation may resolve
a different copy — with pnpm's strict layout those can be different versions
(`next@4.1` factory, `next@4.0` runtime), letting a 4.1-only option pass the editor
and factory only to be rejected by the 4.0 schema at boot — or silently misapplied
where the schemas differ more subtly. The check is defined
against **the canonical capability resolution order** (see "Dependency
resolution"): **app-scoped first, runtime-bundled fallback**, applied identically by
the worker's implementation import, this version-stamp check, and the main process's
schema import. **That order is v4's, and it inverts v3's.** v3's worker tries a bare
`import(pkg)` first — resolved lexically from `@platformatic/basic`, which is to say
from the runtime's own position — and only falls back to a `createRequire` scoped to
the application directory when that throws
(`basic/lib/modules.js:24-36` pre-`b7d953770`, BC 26).
Keeping v3's order would leave this check unimplementable rather than merely
different: the stamp compares the factory's copy against the copy the worker will
run, so a check resolving app-first against a worker resolving lexically would
compare a copy nobody executes — reporting skew where there is none, and missing it
where there is. At load time the main process performs that resolution from the app's
root and compares the
stamp against the version of the copy it yields (so hoisted layouts,
where factory and worker share one copy, never false-positive, and root-only
dependencies are well-defined). **Major mismatch is a boot error** naming both
resolved paths and versions; **minor mismatch is a warning** (legitimate mid-upgrade
drift); patch differences are ignored. **A prerelease component on either side
demands exact identity**: `4.0.0-alpha.1`, `4.0.0-rc.2` and `4.0.0` agree on major,
minor and patch while differing in schema and factory shape, so the relaxed policy
would pair incompatible halves precisely during the alpha/RC period, when they move
fastest and the project explicitly expects users to be on them. Covered by an integration test per layout
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

```ts config refused
import { defineConfig } from 'wattpm'

export default defineConfig({
  applications: [{ id: 'php', path: 'web/php', config: { module: '@platformatic/php' } }]
})
```

Capabilities implement their factory with a helper from `@platformatic/basic`
(`defineCapabilityFactory(module, schema, mapOptions)`), ~20 lines per package.

### Remote apps

Non-capability orchestration entries keep working:

```ts config
import { defineConfig } from 'wattpm'

export default defineConfig({
  applications: [{ id: 'legacy', url: 'https://github.com/org/legacy.git', gitBranch: 'main' }]
})
```

**A remote application must itself be v4.** `resolve` clones a repository the
consuming project does not own, and legacy detection is unconditional in every
directory the loader consults — a clone included — so a pinned revision still
carrying `platformatic.json` is refused. Migrating locally does not fix this: the
clone is a build artifact, so a clean CI checkout re-fetches the v3 configuration
and fails again. Migrate therefore lists every remote entry it cannot reach and
says what to do:

``` output
2 remote applications reference revisions this run cannot migrate —
they live in other repositories:

  legacy   github.com/org/legacy@main
  billing  github.com/org/billing@v2.3.0

Migrate each repository, then update the pinned revision here.
```

That is a coordination requirement, not a mechanism: a project adopting v4 needs
the repositories it consumes to have adopted it too, or to pin a revision that
has. The migration guide states it, because the failure otherwise appears on the
first clean build rather than during migration.

`wattpm resolve` is otherwise unchanged, and it writes **nothing** to the configuration: it
computes `application.path` in memory from `resolvedApplicationsBasePath`, clones
or extracts, and installs dependencies
(`wattpm-utils/lib/commands/external.js:569-697`). That matters in v4: `resolve`
runs unattended in build and deploy pipelines, so it must not depend on magicast's
statically-safe shapes or its snippet fallback.

Because the path exists only in memory, **the root eval worker backfills it** —
`join(root, resolvedApplicationsBasePath, id)` — during the same expansion step
that runs `autoload` and resolves `enabled`, before fan-out. v3 could defer this to
`#setupApplication` (`runtime/lib/runtime.js:2583,2595`) because per-app config was
loaded worker-side; v4 needs an absolute `path` during loading to find the per-app
file, run the detector, and validate the capability. An entry with a `url` whose directory — backfilled or declared — **does not exist
yet** is recorded **unresolved** and skipped by per-app discovery entirely: no
per-app file lookup, no detector, no capability validation. This is v3's
`type: 'unknown'` (`runtime/lib/config.js:277-279`, whose comment gives the same
reason: detection on a missing directory would glob the cwd), adapted to the fact
that v4 always has a `path` and only the directory may be absent.

**Which is why a `url` entry must declare an `id`.** Everywhere else the id is
derivable — the `package.json` `name`, the directory — and v4 derives it. A remote
entry has neither until the clone exists, and the clone's location is
`<resolvedApplicationsBasePath>/<id>`, so the one input the backfill needs is the one
thing that would have to come from the thing it is computing. v3's schema required
`id` for both entry shapes (`foundation/lib/schema.js:869`); v4 relaxes it for local
entries, where there is something to derive from, and keeps it for remote ones. The
type sketch in Appendix A models the two as a union for the same reason.

**Loading must succeed in that state, because it is the only state `resolve` ever
runs in.** `resolveApplications` calls `loadConfiguration` first and *then* selects
the applications whose path is missing (`wattpm-utils/lib/commands/external.js:595,614-625`),
so a configuration that refuses to load without its clones could never produce them.

**`resolve` must see every entry a later boot will need**, and what makes that hard
is the loader, not the user: `resolve` is not a boot, so it evaluates with
`command: 'exec'` and development defaults, while the boot it prepares for evaluates
as `dev`/`start`/`build`, often `--production`. If an entry exists in the second
context and not the first, `start` fails telling you to run the command that cannot
see it. Three different things follow from that, and they are not one rule:

- **`resolve` prepares for a command you name: `--for <command>`, defaulting to
  `start`.** The context it evaluates is that command's, with that command's own
  defaults — `--for build` is `production: true` and `mode: 'production'` unless
  `--mode` says otherwise, exactly as `wattpm build` would be — so what runs is a
  context some boot actually produces rather than a synthetic one. `--production` and
  `--mode <name>` still override, because those describe the deployment and are the
  operator's to state, where `command` describes the invocation.

  **This replaces an earlier design in which `resolve` evaluated all four contexts
  and unioned them, and the reason it was wrong is worth keeping.** Topology is not
  separable from the rest of the root callback: the same function that returns the
  application list also throws on a missing dev certificate, awaits a service
  discovery lookup, or branches its logger on `command`. Evaluating it under a
  command nobody asked for runs all of that. `resolve --production` failing because
  the `dev` branch wants a local-only variable is a worse failure than the one the
  union existed to prevent, and "four evaluations cost nothing" was a claim about one
  example rather than about arbitrary trusted code — an async root pays it four times
  in network calls or four times in `--config-timeout`.

  **The union survives as `--for all`**, for a project that genuinely branches
  topology on `command` and wants one command to cover every boot. It evaluates each
  boot command under its own defaults and fetches the union of the candidates, and
  because the operator asked for those evaluations, a failure in any of them is a
  failure of the run rather than something to swallow. Under `--for all` the
  candidates are matched by id, and **an id that resolves to two different clones is
  refused** — differing `url`, `gitBranch` or destination path (see below) — naming
  the id, both values and the commands that produced them. One directory cannot hold
  two checkouts, and choosing silently is how a deploy ships the wrong code. An id
  present under some commands and absent under others needs no such treatment: it is
  fetched, and a clone nobody boots costs disk.

  Per-application *settings* may branch on `command` freely; `watch: command === 'dev'`
  is the canonical example and stays legal. Topology that branches on it is legal too,
  and now has a supported way to be resolved — one `--for` per target, or `--for all`
  — which is what the earlier stated-but-unchecked rule was standing in for.
- **The set of applications *may* vary with `ctx.mode`, and `resolve` takes its mode
  from its target.** A staging deployment that runs one extra application is coherent,
  and forbidding it was overreach. `resolve` accepts `--production` and `--mode
  <name>`, but **it does not default them the way other `exec`-context commands do**
  (see "CLI commands over config"): the target chosen by `--for` supplies them, so
  `--for start` and `--for build` evaluate with `production: true` and
  `mode: 'production'`, `--for dev` with development, and `--for all` gives each
  target its own. Naming a target is what makes that coherent — a bare `wattpm
  resolve` prepares for `start`, which is what a default deployment boots, and would
  fetch a different topology from a root that branches on `mode` if it evaluated a
  development context instead. The flags override where a deployment is neither:
  `--for start --mode staging` resolves what `wattpm start --mode staging` will
  boot.
- **`enabled` must not hide an entry from `resolve`.** It is the supported way to
  exclude an application, so it cannot also be the thing that prevents the exclusion
  from ever being undone. `resolve` collects entries with a `url` and a missing
  directory **before** the `enabled` filter, and clones them all: fetching a
  repository you will not boot costs disk, and disk is cheaper than a topology that
  cannot be resolved from the context you are in. (v3 filtered first — `transform()`
  spliced disabled applications out ahead of resolve — so a v3 project with
  `enabled: false` on a remote entry has always had this hole. v4 closes it.)

  **Where that list comes from is the load-bearing part**, because `resolve` cannot
  produce it. The filter runs inside the root eval worker, which drops the disabled
  entries and exits; by the time `resolveApplications` has called `loadConfiguration`
  (`external.js:595`) nothing is left holding the pre-filter list, and re-deriving it
  would mean evaluating the root a second time. So the worker records it on the way
  past — every entry carrying a `url`, projected to `{ id, url, path, gitBranch }` —
  and posts it beside the config as `resolveCandidates` (see "Loading mechanism",
  step 4). **`gitBranch` is in the projection because dropping it changes which
  revision lands on disk.** `resolveGitApplication` selects with
  `application.gitBranch ?? parsedGitUrl.branch` (`external.js:450`), so a disabled
  remote pinned to `release` would otherwise be cloned from the URL's branch. It
  travels **as authored**: the projection is taken in the worker, ahead of the
  main-side schema pass, so an undeclared `gitBranch` stays undeclared rather than
  arriving as the schema's `'main'` default and shadowing a `#branch` fragment the
  URL carried. A disabled remote pinned to a non-default branch is an integration
  test.

  **Main-side, the candidates ride on `kMetadata`.** `loadConfiguration` keeps
  returning the configuration object, so every caller keeps working; the list is
  attached to the symbol-keyed metadata envelope beside `root`, `path`, `env` and
  `module`, and `resolve` reads `config[kMetadata].resolveCandidates` rather than
  filtering the returned application list as it does today (`external.js:614-625`).
  That envelope is the right home rather than a convenient one: it already exists to
  carry facts *about* a load that are not part of the configuration, it is already
  stripped from the public payloads by the shallow spread in `getRuntimeConfig()`,
  and being symbol-keyed it cannot reach a schema, a DTO or a JSON round-trip. The
  alternatives both cost more than they buy — putting the list in validated
  configuration data would put it in the schema and the DTO, and a second entry point
  returning `{ config, candidates }` would have to be adopted by every caller to serve
  one.

  **`path` is the fourth field for the same reason `gitBranch` is the third**: it is
  where the clone lands. `resolveApplications` clones into `application.path`,
  defaulting it from `resolvedApplicationsBasePath` when the entry declares none
  (`external.js:614-644`), so a candidate is identified by its **effective
  destination** — the declared path if there is one, otherwise
  `join(root, resolvedApplicationsBasePath, id)` — canonicalized before comparison,
  since `./external/api` and `external/api` are one directory. Under `--for all` a
  destination that differs between commands is refused with the rest: `path:
  'external/api-dev'` under `dev` and `'external/api'` under `start` is the same
  repository fetched to two places, and a union keyed on id alone would keep one and
  leave the other boot looking at an empty directory, printing a resolve command that
  makes the identical choice again. `resolvedApplicationsBasePath` varying by command
  produces the same conflict through the backfill and is caught by the same test,
  which is why the comparison is on the resulting destination rather than on the
  entry's own `path` field.

  **The map runs the other way as well: one destination, one producer.** Matching by
  id answers "is this the same application under two commands" and says nothing about
  two *different* ids naming one directory. `{ id: 'api', path: 'external/shared' }`
  beside `{ id: 'billing', path: 'external/shared' }` passes every id-keyed check and
  is incoherent on disk: `resolveApplications` gathered both into `toResolve` and
  cloned them in sequence (`external.js:538-561` pre-`9b6b991b6`), so the first created the
  directory and the second failed into it — and on the next run the existing-path check
  skipped both (`external.js:510-512` pre-`9b6b991b6`), so nothing repaired it and one
  application booted the other's checkout. That is the same local-path/URL incoherence the duplicate-id merge
  rule already refuses at load, arriving through a door id-matching does not watch.
  So `resolve` builds a **canonical destination → producers** map over every
  `url`-bearing candidate — not only across commands, but across the whole candidate
  set in a single context — and refuses a destination claimed by more than one
  repository/revision pair, naming both ids and the path. **Over every candidate, not
  every candidate it is about to fetch**: existence filtering runs after it, dropping
  any entry whose path already exists (`external.js:614-621`), and that is exactly the
  state this refusal exists for — a directory left holding one of the two clones, from
  a previous run or a failed one, is the case where the conflict is already doing
  damage and the filter would hide it. Existence decides whether a *coherent* producer
  still needs fetching; it never decides whether conflicting producers get validated.
  Nothing on disk is consulted to find the conflict: `{ destination, url, gitBranch }`
  is already in the projection, so the check is a comparison of declarations and runs
  before the filter. The one coherent case is two
  entries resolving to the *same* repository at the same revision, a deliberately
  shared checkout: that is fetched **once** rather than refused, and once rather than
  twice.

  Nothing else changes: `enabled` is still resolved before fan-out, disabled entries
  still spawn no worker, and the candidate list is a projection of the same canonical
  snapshot, recorded during the same evaluation rather than produced by a second one.

When a boot does find an unresolved entry, the error names the possibility rather
than repeating the instruction that failed: it reports the missing directory and
prints the `resolve` invocation **matching the context this boot is in** — `wattpm
resolve --for dev`, or `--for start --production`, never a bare `wattpm resolve`. That
is the whole recovery, and it is what the earlier unenforced rule was missing: an
entry visible under `dev` and not under `start` is no longer a loop with nothing to
turn, because the command that would fetch it is printable and the operator can run
it. Where the entry exists under no command at all, the remaining explanation is an
expression depending on something the resolving environment did not have — a variable
set only in the deployment — and the message says so.

Back to loading order: a load-time failure would make `wattpm resolve` fail on a
clean checkout telling you to run `wattpm resolve`. Migrate's step 3 has the same
shape over its own emitted output. Only `dev`, `start` and `build` — the commands
that need the code to be present — promote an unresolved entry to an error, and it
is the message above, never a detector "no JavaScript sources" error.

The `{PLT_APPLICATION_X_PATH}` placeholder entries plus `.env` lines were written
by **`wattpm import`** (`external.js:321-349`), not `resolve` — as is the capability
dependency added to a cloned app's `package.json` (`external.js:376-411`, inside
`importLocal`). Against a v3 root `import` still writes a `watt.json` `$schema`
stub, which v4's unconditional legacy check would refuse; against a v4 root it emits
the v4 per-app form instead, and the dialect follows the root rather than a flag
(`external.js:194-205`). In v4 `import`
writes literal relative paths into the config (`external.js:213-252`) — an env-var indirection
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

``` output
✗ watt.yaml is a v3-era configuration. Watt v4 uses watt.config.ts.
  Run:  npx wattpm-utils@4 migrate
```

Without this, a `watt.yaml`-only project would fall through to zero-config
synthesis and boot with inferred defaults while silently ignoring its real
configuration — worse than any hard failure. Detection remains a pure filename
check — no parsing, no shape heuristics. The `--config` / `-c` flag accepts any of
the four v4 names.

We use `watt.config.*`, not `watt.ts`, following the `vite.config.ts` /
`next.config.ts` convention and avoiding collisions with app source files.

**Root and per-app files share the same filename; the export discriminates.**
Classification is four unconditional rules. Rule 1 is the unwrap itself; rules 2–4
read keys, and they read them off the **canonical snapshot**, never off the raw
export — after the walk, not before it (see "Loading mechanism", step 2):

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
   options; when the offending keys are root-only ones (top-level `autoload`,
   `workers`, `managementApi`), the error hints "this looks like a root config —
   remove `module`";
3. an object with `application`, `applications` or `autoload` is a
   root config;
4. an empty/other object is a root config — *classified* as one, which is not the
   same as valid. The runtime schema requires one of `autoload` or `applications`
   (today an `anyOf` over `autoload`/`applications`/`services`/`web`,
   `runtime/lib/schema.js:64-68`; the audit narrows it to the two v4 spellings plus
   the singular `application` shorthand), so `{}` classifies here and is then rejected
   by validation with an actionable message rather than booting an empty runtime.
   Classification answers "what kind of file is this", not "is it usable". An **empty
   config file is a statement, not an absence**: it does not fall through to
   zero-config detection, which is for a project that has no configuration at all.

**The rules are total over objects, and everything else is refused ahead of them.**
Canonical data is not only objects: `null`, arrays, strings, numbers and booleans all
survive the walk — arrays legitimately, since configuration values contain them — and
none of them is a configuration. So the step that ends the unwrap is a plain-object
test, and a top-level export that fails it is refused naming the file and the type
received. `null` is the one worth spelling out, because it is the one that would
otherwise get further: `typeof null === 'object'`, so it reaches rule 2 as a property
read on nothing, and the difference between a `TypeError` from one implementation and
an AJV error from another is exactly the divergence the four rules exist to prevent.
Rule 4's "empty/other object" means an object. It is not a resting place for values
that are not.

**Run what is here.** The whole rule is three steps: **(1)** find the nearest
`watt.config.*` from the current directory upward, stopping at — and including —
the nearest ancestor containing a `package.json`, and searching the current
directory alone when there is no such ancestor; that is the **deciding file**,
found **by filename alone**, with no execution; **(2)** run `loadEnv` from the
deciding file's directory, resolving its layered chain (see
"Env files"); **(3)** only then execute the deciding file in its eval worker to
classify it (classification is cached, so a file classified here is not
re-evaluated by a later discovery pass — config code still runs once per load).

The stop condition is the one thing worth stating plainly: **the search never
leaves your package.** A directory with a `package.json` is where a Node project
begins, so a `watt.config.*` above it belongs to something else. This is what makes
`wattpm start` inside an application run *that application* — the application's
directory has its own `package.json`, so the search begins and ends there — and it
is also the whole of the trust story: a stray `~/watt.config.ts` is never found,
because reaching it would mean walking out of the package you are standing in.
Nothing above the stop point is executed, and nothing needs to be: env files are
data and are found separately, by their own walk.

What the deciding file *is* then decides what boots:

- **Root config nearest** → **the full runtime boots**, exactly as in v3. There is
  no further test: the loader does not inspect the root's entries or expand
  `autoload` to work out whether the current directory happens to be one of its
  applications. Scoping is a property of **owning a config file**, not of being
  claimed by one — which is what makes it independent, since an application that
  owns a file never causes the root to be evaluated at all. An application with no
  file of its own is one the root describes entirely, and it is reachable at
  `http://<id>.plt.local` once the runtime is up; booting it alone would produce an
  application configured by defaults, listening on nothing, with no mesh to serve.
  Giving it a `watt.config.*` is how you ask for it to be bootable on its own.
- **App-def nearest** → **that application boots standalone**: the definition is
  auto-wrapped as `{ application: { config: def } }` (the normalized singular
  form — the DTO shows this entry) and run as a single-app runtime; the entry's
  `id` follows **one derivation, used at every position and under every boot style**
  (though not always over the same inputs — see below): an
  explicit `id` in configuration wins; failing that, the `package.json` `name` **with
  any scope stripped** — `@acme/frontend` is `frontend`; failing that, the directory
  name. Its `path` defaults to
  the config file's directory. One rule matters because the id is not cosmetic
  either: it is the mesh hostname, the injected `PLT_<ID>_URL` name, the metrics
  label, `wattpm inject`'s argument and how siblings name each other in
  `dependencies`. A default that varied by boot style would move all five at once —
  so **`autoload` uses the same rule**, where v3 used the directory name alone
  (`runtime/lib/config.js:465`, `mapping.id ?? entry.name`). Stripping the scope is not cosmetic: the id becomes a
  DNS label in `http://<id>.plt.local` (`runtime/lib/utils.js:12-14`, no
  sanitization), so keeping `@acme/frontend` would emit
  `http://@acme/frontend.plt.local`, where `@acme` parses as userinfo. v3 stripped it
  for the same reason (`runtime/lib/config.js:136-147`, still present at HEAD). An id that
  still cannot be a DNS label is a configuration error naming the entry and asking for
  an explicit `id`, rather than a mesh address that silently does not resolve. The
  test is the label grammar itself, not a list of bad characters:
  **`^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$`** — letters, digits and hyphens,
  no leading or trailing hyphen, 1–63 octets. That rejects `my_app` and `api.v2` as
  well as `@acme/frontend`, which an enumeration of `@`, `/`, `:` and whitespace would
  have admitted. It is checked **before** the id reaches either consumer: the
  hostname (`http://<id>.plt.local`) and the topology-variable normalization
  (`PLT_<ID>_URL`).

  This bites the *derived* id as often as an authored one — a directory named
  `my_app`, or a package named `@acme/my.app`, produces an invalid label — which is
  why the error names the entry and asks for an explicit `id` rather than trying to
  sanitize. Silently rewriting `my_app` to `my-app` would move the mesh hostname, the
  injected variable and the metrics label without the user asking.

  **One rule is not one answer, and the gap is the explicit `id` itself.** The rule
  takes a configured `id` first — and a configured `id` lives on a root *entry*:
  orchestration, root-lexical by design, invisible to a standalone boot of that
  directory, which never evaluates the root. That is not an oversight in the rule, it
  is what makes standalone independent. So a root entry
  `{ id: 'api', path: 'web/frontend' }` is `api` under the root and `frontend` on its
  own, and the five things an id decides move with it. The derivation is identical in
  both boots; the *inputs* are not, because one of them is a fact only the root holds.

  **The root boot is the one that can see it, so that is where it is reported.** It
  has the explicit `id` and can derive what the application would call itself alone —
  same `package.json` name, same directory — so a mismatch is a load-time warning
  naming both spellings, once per entry. The standalone "what is not applied" warning
  names the id in use, which is the other half of the same fact. Neither is an error:
  calling an entry `api` while its directory is `web/backend` is ordinary, and
  `migrate` emits exactly that shape whenever it pins a v3 id.

  Making the answer invariant instead costs more than the divergence does, in both
  available directions. Putting `id` in the per-app file takes identity out of
  root-lexical orchestration, and the root needs every id **before** per-app
  evaluation — to merge an autoloaded entry with an explicit one, to key the fan-out,
  to compute the injected variable names — so a file able to rename itself while being
  evaluated would have to be read before the topology it belongs to exists. Rejecting
  an explicit `id` that differs from the derived one forbids the ordinary case above,
  and would refuse most migrated projects on sight.

  `cd web/frontend && wattpm dev` — or
  `pnpm --filter frontend dev` — starts *only* that application, matching the
  package-local command model frontend developers expect. This is a deliberate
  break from v3, which booted the whole runtime from anywhere.

Scope is positional but never silent: every `dev` / `build` / `start` invocation
prints one line naming the deciding file and what is about to boot (the full
runtime, or one named standalone app), before doing anything else. A prominent
warning is added when **both** conditions hold: the deciding file classified as an
**app-def**, *and* a `watt.config.*` exists in some ancestor directory. It then
states what is not applied:

``` output
⚠ booting 'frontend' standalone — sibling applications and http://*.plt.local are
  unavailable. Nothing the runtime configuration says is applied: neither its own
  settings (logger, telemetry, the env blocks, envfile) nor this application's
  entry (workers, health, dependencies, enabled). Its own server settings are
  unchanged: it listens exactly as it does under the full runtime. Run wattpm where
  your runtime configuration lives to start everything.
```

`enabled` has no meaning in a standalone boot, which is why the warning lists it: it
lives on the *entry*, and a standalone boot has no entry to read. Asking for an
application directly is the explicit request `enabled: false` exists to override, so
an application disabled in the runtime still boots when you stand in its directory
and run `wattpm`.

Both conditions earn their place. Without the **app-def** half, a nested *root*
config — a second runtime under `tools/sandbox` — would trigger it, telling the user
the mesh is unavailable while a full runtime with a working mesh boots. Without the
**ancestor** half, the canonical single-app project (Level 1 is a bare factory call,
which classifies as an app-def) would print it on every boot, announcing missing
siblings to a project that has none.

The ancestor test is **the one thing that looks above the search stop point**, and
it is deliberate: a warning about what you are missing has to know whether you are
missing anything. It is a filename check that **executes nothing**, and it never
decides *which* configuration boots — the deciding file was already chosen, below the
stop point, before this walk runs.

**It is not, however, behaviour-free, and calling it diagnostics-only would be
wrong.** It is the **same walk that finds the env root** (see "Env files"), and the
env root decides how far up `.env` layering reaches. So a stray `watt.config.*` in an
unrelated ancestor does more than mislead a warning: it extends the env chain, and
files that were inert become live — which can change what a callback computes, which
port is chosen, which variables `requiredEnv` finds, or whether evaluation throws at
all. That is the honest scope of the residual, and it is why the trust warning
matters rather than being boilerplate: a directory you did not write is contributing
to your environment.

The bound keeps it small and the direction of travel shrinks it further. Under
**root-directed fan-out** there is no ambiguity at all — the root knows its own env
root and passes it to each per-app worker explicitly, so no worker re-derives one by
walking. The residual is **standalone discovery**, where there is nothing above to
ask. Because it is a filename check it also cannot know
whether that ancestor is a *root* config, so the warning names the file it found and
says what a runtime configuration would have applied, rather than asserting that one
did. Sibling-dependent capabilities (a gateway's config enumerates
sibling applications) get the same warning and no special treatment: booted
standalone they fail at compose time with their own errors — documented, not
prevented.

**Scope is purely positional — there is no `--all` flag.** cwd is the scope
selector, and the nearest config file is the whole of the rule: run at the root for
the runtime, in an app directory that owns a config file for that app;
wanting the runtime from inside an app directory means running at the root (a
`cd`, a subshell, or a root script) or naming the configuration with `--config`,
which is not a scope flag but does take cwd out of the decision. One rule, no
scope flags, applied uniformly
to `dev`, `build`, and `start` — no per-command exceptions. Scaffolding writes the
root `package.json` script as `wattpm dev` (runtime, because it runs at the root)
and per-app scripts as `wattpm dev` (that app, because they run in the app
directory). **Multi-app dev is the runtime's job**: `wattpm dev` at the root runs
every application in one process tree with the mesh — strictly more useful than N
disconnected processes. Composing N parallel *standalone* dev processes (à la
`turbo run dev`) is deliberately not an advertised workflow, because they have
**no mesh**: `http://*.plt.local` does not resolve, so any app that talks to a
sibling fails. They also collide unless each app declares a distinct
`server.port` — which under v4's exposure model each app does anyway, since a
port is per-application configuration and two apps sharing one is a boot error
(see "How applications are exposed"). Wiring the resulting URLs together by hand
is possible, but not the sold path.
Standalone `start` in automation gets the same warning as anywhere else —
accepted and documented, not guarded. The migration guide calls the deploy
pattern out explicitly: v3 climbed to the root from anywhere, so a Dockerfile or
deploy script whose working directory is an app directory must either `cd` to the
project root or pass `--config <root file>`, which names the configuration and
suppresses the standalone re-scope.

**Build environments.** A build runs with **the application's environment,
resolved exactly as it is for that application's workers** — the full worker-runtime
ladder from "Env files": real environment, entry `env` block, root `env` block,
injected `PLT_<ID>_URL`, the application's own env files or its `envfile`, the
the rest of its chain up to the env root, then the `NODE_ENV` default. Env
files are read and layered the same way they are at runtime; **there is no reduced
or special build environment, and no rung is excluded**. This is what v3 did and
what the runtime does today
— `buildApplication` sends `build` over ITC to a normally spawned worker
(`runtime/lib/runtime.js:1014,1050`), which has already applied both `env` blocks
(`worker/main.js:265,268`) — and a build that reads an author-supplied constant
should keep reading it.

The injected `PLT_<ID>_URL` values are included, and they are the case that most
needs to be: a bundler inlines `process.env.PLT_API_URL` at build time, so omitting
the rung would bake `undefined` into the artifact. Including it is safe because the
injected value is a **stable virtual hostname** — `http://<id>.plt.local`, a pure
function of the application id (`runtime/lib/utils.js:12-14`), identical at build
time and at run time, and resolved by the mesh at request time. It requires no
sibling to be running to compute, and baking it records exactly the address the
application would have used anyway. Excluding it would create a third environment
variant against the "one implementation of the ladder" claim, and would make `build`
differ from `dev`, where compilation happens inside a serving worker that does see
them.

`NODE_ENV` defaults to `production` under `build` when nothing else supplied it
(see "Env files"). That is **new**: v3's build created the runtime with no
production flag (`wattpm/lib/commands/build.js:43` pre-`b1e03a5b9` → `runtime.js:303`), so
`worker/controller.js:125-126` never fired and builds ran with `NODE_ENV` unset.
Bundlers and Babel configurations that branch on it will produce different — and
correct — artifacts.

A **standalone** app-dir build differs from a root build in three ways, all following
from the same fact — it applies no root orchestration. It sees neither the root `env`
block nor a root-entry `envfile` (see "Env files"); **no sibling `PLT_<ID>_URL`
exists**, because injection is one variable per *sibling* application and a standalone
boot declares exactly one; and **topology-key stripping does not happen**, because the
application's own file is the deciding file and runs in the root worker, which cannot
strip names it does not yet know (see "Env files").

The last two combine into two outcomes, and only one of them is `undefined`. Where
**nothing supplies** `PLT_API_URL`, standalone code reads `undefined`, and a bundler
inlining it bakes `undefined` where a root build would have baked
`http://api.plt.local`. Where an **app env file carries a stale** `PLT_API_URL`, the
root build never sees that value — injection outranks env files at runtime, and
stripping removes the key during evaluation — while the standalone build has nothing
to override it and keeps the file's value in both views. The artifact, and
`resolvedConfig` with it, then carries a stale URL rather than an obviously absent
one, which is the worse of the two because it looks like it worked. `turbo run build`
is a standalone build, so this is the shape most likely to meet either.

A standalone build **states the difference without enumerating variables**: it prints
that sibling `PLT_<ID>_URL` values are absent from this build, that a bundler inlining
one will bake `undefined`, and that an app env file supplying one is used as written
rather than replaced. It does not name them, and that is deliberate — there is no
honest source for a list. Migrate's source scan covers what step 4 enumerates, not
`PLT_*_URL`; its manifest is deleted on completion; and a greenfield application was
never migrated at all. Matching at
build time is no better: a standalone boot never reads the root configuration, so it
does not know the declared ids and could only match by prefix and suffix — which
would flag an unrelated `PLT_STRIPE_URL`, the exact false positive the exact-key
rule elsewhere exists to prevent. The application's own `PLT_<SELF>_URL` is injected
in both boot styles and is unaffected either way.

**Where a build needs a sibling's URL, the fix is a root-directed build**, not an env
file. Putting the value in the application's own `.env` is the durable answer for
ordinary build inputs and the wrong one for a topology key: under a root build,
injection outranks that file and stripping removes it, so the two builds agree only
where the file happens to hold exactly the mesh URL — by coincidence, maintained by
hand. A genuinely standalone build that must have a URL should take it from the real
environment, which outranks everything in both styles, or use a setting that is not a
topology key at all.

**How applications are exposed — there is no entrypoint and no runtime-level
listener.** `entrypoint` and root
`server` are gone from the runtime schema, and `server` and `useHttp` are gone from
application entries — the v4 upgrade chain deletes `entrypoint`, root `server` and
every per-application `server`
(`runtime/lib/versions/v4.0.0.js:16-27`), while explicitly preserving the
capability-owned `server` of a standalone application config (`:10-14`). It does
**not** delete `useHttp`, which no longer has a reader; migrate is what converts it
(see "Migrating from v3"). The
runtime no longer holds a URL: `#url`, `getUrl()` and `getEntrypointDetails()` are
gone. **Each application exposes itself through its own capability
configuration**, and this section is the whole of the model. It applies uniformly
to a full runtime boot and to a standalone one — the wrapped single-app runtime
applies no *root* config settings (standalone means standalone), but there were
never any exposure settings there to apply, so an application listens identically
either way. `next({ server: { port: 8080 } })` listens on 8080 in a monorepo and
listens on 8080 alone in its own directory; nothing is hoisted, merged or
overridden on the way.

The rules, in full:

- **`server` is capability configuration only.** It lives inside the factory
  (`next({ server: … })`), and every capability schema keeps its own top-level
  `server` block — the shared five (`hostname`, `port`, `backlog`, `http2`,
  `https`) for the framework and node capabilities, the full Fastify set for
  service/db/gateway. `BaseCapability` builds `this.serverConfig` from
  `config.server` alone (`basic/lib/capability.js:89`); the runtime supplies
  nothing to merge against, so the two divergent v3 merge orders — basic-family
  own-wins, service-family context-wins — both collapse into "the capability's
  own block, verbatim". There is no root or entry-level counterpart, hence no
  precedence question to answer.
- **A managed listener opens if and only if `server.port` is defined.** Every
  capability's `_listen` returns early on `typeof this.serverConfig?.port ===
  'undefined'` (`service/lib/capability.js:299`, `node/lib/capability.js:473-478`,
  and the same guard in `vite`, `astro`, `remix`, `nest`). No schema supplies a
  default. So **omitting `server` means no managed listener** — nothing binds a
  socket — and a declared port is the statement that this application faces something
  outside the runtime. Whether the application is then *reachable* at
  `http://<id>.plt.local` through the in-thread dispatch target
  (`basic/lib/capability.js:434-436`) is capability- and mode-specific, and the matrix
  below is the answer: for `service`/`db`/`gateway` always, for the Vite family in
  production, for `next`/`nitro`/`nuxt`/`tanstack` never, and for `node` when its
  code says so. "No listener" and "mesh-only" are not the same statement.
- **`port: 0` is the ephemeral spelling**, one OS-assigned port per worker:
  `buildListenOptions` is still `{ port: serverConfig?.port || 0 }`
  (`basic/lib/utils.js:22`). This is the v4 replacement for v3's `useHttp`, and
  it remains what the gateway's WebSocket proxying requires — real TCP, per
  worker.
- **A fixed port with `workers > 1` requires `SO_REUSEPORT`, and there is no
  fallback.** The capability enables it when none of its three inputs says `false`,
  at least one says `true`, and the platform supports it
  (`basic/lib/capability.js:105-110`). Only **two of those three are configurable**:
  the application entry and the runtime root. The third is the capability's own
  `reuseTcpPorts`, which `:105` reads but **no capability schema declares** — it is
  reachable from capability code, not from a configuration file. It is then
  applied by a `net.server.listen` subscriber that sets `options.reusePort =
  true` (`:845-859`). Both `reuseTcpPorts` properties default to `true`
  (`foundation/lib/schema.js:905-908` for the entry, `foundation/lib/schema.js:1111-1114` for the root),
  and the
  **entry-level one now reaches the decision** — the runtime passes the whole
  application entry into the capability context (`worker/controller.js:83`), which
  is the plumbing v3 lacked. Where the OS lacks `SO_REUSEPORT`
  (`features.node.reusePort` is `false` on macOS and Windows,
  `foundation/lib/node.js:77`) a fixed port with `workers > 1` cannot be shared.
  How the runtime behaves there was a **runtime concern, and the runtime has now
  answered it**: it sets up the first worker, asks whether that worker's listener
  ended up on a shared fixed port, and if so warns and clamps the application to a
  single worker, disabling dynamic scaling with it
  (`runtime/lib/runtime.js:2628-2644`, `edf83931d`, closing
  platformatic/platformatic#5070). That the check runs *after* the first worker
  exists is the point, and it is why this never belonged in the format: the listener
  is owned by the capability, so whether a fixed port is really shared is not
  decidable from the configuration file. A config naming `port` and `workers` stays
  platform-independent and valid everywhere; what varies by platform is how many
  workers it gets, reported at start rather than refused at load.
- **Custom listeners are observed, never rewritten.** `createServerListener()`
  now takes no arguments and only reports the address a server chose
  (`basic/lib/worker/listeners.js:4`); the child-process path likewise stopped
  assigning `options.port` / `options.host`
  (`basic/lib/worker/child-process.js:586-597`). A Node application without a
  `create()`/`build()` factory, and any application started through a custom
  command, binds exactly what its own code says, and the runtime records the
  result.
- **`server.portAssignment` moves into the capability block and stays.** v3 had it
  on the *runtime* `server` because ports were entrypoint-wide; v4 ports are
  per-application, so it belongs where the port does:
  `node({ server: { port: 3000, portAssignment: 'perWorkerIncrement' } })`. `shared`
  (the default) puts every worker on one port and therefore needs `SO_REUSEPORT`;
  `perWorkerIncrement` binds worker *i* at `port + i` and needs nothing. It is
  **required**, not optional: `features.node.reusePort` is `false` on macOS and
  Windows (`foundation/lib/node.js:77`), so without it "fixed port + `workers > 1`"
  has no working configuration on either platform. `e2da15eda` removed the key and
  its implementation along with the entrypoint; `468c64604` restored both on `v4`,
  in the capability `server` block exactly as this format assumed
  (`foundation/lib/schema.js:400` for the basic family, `:515` re-exporting it to
  `fastifyServer`, so both server literals carry it), with the runtime tracking each
  worker's port offset so restarts, scale-up and scale-down keep their ports. Two consequences the
  runtime owns: an application with N workers from `port` occupies `port … port+N-1`,
  so the collision scan must reject a sibling declaring any port in that range —
  at load, not when the second worker starts — and `getUrls()` reports N distinct
  URLs for that application.
- **`application.entrypointPort` is removed** for the same reason as custom
  listeners: it
  overwrote the port of an *observed* URL
  (`basic/lib/capability.js:924-928` pre-`3c92a2a64`) so the runtime would report a port other than
  the bound one — meaningful only while an entrypoint proxied the application, and
  without a referent since `e2da15eda`. It was also load-bearing in a place it was
  never meant to reach: the reported URL is the only input to the collision scan
  (`runtime.js:5150-5166` → `:5120-5141`), so two applications on genuinely distinct
  ports that both set `entrypointPort: 3000` raised a spurious `AddressInUseError`,
  while two sharing a real port with different values escaped detection. Nothing in
  the codebase sets it outside its own two tests. `_getEntrypointUrl` keeps only its
  `[::]`/`0.0.0.0` → `localhost` normalization, so the reported URL is always the
  bound one and the collision scan always compares real ports.
- **Two applications cannot share a port.** When a worker reports a URL, the
  runtime checks the port against every *other* application's listening workers
  and raises `AddressInUseError` — `Port %d is already in use by applications
  "%s" and "%s"` (`runtime/lib/errors.js:14-17`, raised at
  `runtime/lib/runtime.js:5164-5166`, ownership scan at `runtime/lib/runtime.js:5120-5141`). Workers of
  the *same* application are exempt by construction (`runtime/lib/runtime.js:5126`), which is what makes
  `SO_REUSEPORT` legal. An OS-level `EADDRINUSE` carrying a port is upgraded to
  the same error (`runtime/lib/runtime.js:3552-3562`), and `EADDRINUSE` / `EACCES` / `EADDRNOTAVAIL`
  are excluded from restart-on-error (`runtime/lib/runtime.js:3590-3594`) — a port problem fails fast
  instead of looping. There is still **no port search**.

  **A declared duplicate is caught at load, before any worker starts** — with a
  narrower reach than that sentence on its own suggests, and the narrowing is the
  substance.

  **It runs after the per-app workers, not after the root worker.** A `server.port`
  may be declared in an application's own file, and those are evaluated in the
  fan-out (see "Loading mechanism", step 2), so the complete set of declared ports
  does not exist until every per-app evaluation has returned. The check sits at the
  end of the loading pipeline, main-side, over the resolved entries.

  **The set is built from listeners the boot will actually create, not from every
  declared `server.port`.** A framework capability checks its custom command for the
  active mode *before* its server configuration and returns through
  `startWithCommand` (`next/lib/capability.js:198-212`, `:312-327`; the others are the
  same shape), so an application with a command for the mode this boot will use never
  binds the port its configuration declares — the command picks an address and the
  runtime observes it. Claiming that range would reject two `next` applications
  carrying the same harmless default port while their production commands bind
  different addresses, and the omitted-`hostname` rule below makes that the *likely*
  outcome rather than a corner: same capability, both hosts omitted, treated as
  overlapping. So an application whose active-mode command takes precedence
  contributes **nothing** to the preflight set, and its collisions belong to the
  runtime scan, which sees what the command actually bound. Because the command is
  mode-specific, so is the set: `dev` and `start` are separate cases and separate
  tests.

  **It compares ranges, not points, and skips the two spellings that mean "no fixed
  port".** An application with no `server.port` binds nothing — whether it *serves*
  the mesh is a separate question the matrix answers, and irrelevant here, since this
  check is only about sockets. An
  application with `port: 0` is asking the OS for a port per worker, so two of them
  are not a conflict — that is the entire point of the ephemeral spelling, and the
  only mode that rejects it is `perWorkerIncrement` (below). Everything else occupies
  a range rather than a point: under `perWorkerIncrement` an entry claims `port …
  port + workers − 1`, computed against the **maximum** worker count for the same
  reason the 65535 bound is, since scaling up later must not walk into a sibling.

  **Host overlap is a table, deliberately a small one.** Two ranges conflict only if
  their hosts overlap, and the loader decides that the way the runtime already does:
  a wildcard (`0.0.0.0`, `::`, `[::]`) overlaps everything, and otherwise the hosts
  must be equal, case-insensitively (`runtime/lib/runtime.js:5143-5148`). Anything
  that would need name resolution — two DNS names for one address, a name pointing at
  an interface something else has bound — is **not** compared here and is left to the
  runtime scan, which sees addresses that are actually bound. A static check that
  guessed at resolution would refuse valid configurations on the strength of a guess.

  **An omitted `hostname` is the common case and needs its own rule.** `server.hostname`
  is optional with no schema default (`foundation/lib/schema.js:394`), and the listener
  leaves `host` unset on purpose so the framework picks its own — `buildListenOptions`
  is `{ port: serverConfig?.port || 0 }` and adds `host` only when one was configured
  (`basic/lib/utils.js:21-26`). So for most applications there is no host string to put
  in the table at all, and the two tempting answers are both wrong: treating absence as
  a wildcard refuses configurations whose listeners would never have met, and skipping
  every omission drops the single most common collision — two applications on 3042
  with no hostname between them. The rule is therefore: two entries that **both** omit
  `hostname` are compared **only when they resolve to the same capability**, since that
  is the one case where the unknown default is the *same* unknown; an omission compared
  against a declared host, or against a different capability's omission, is not decided
  here. That keeps the check on the collision it exists for and off the ones it cannot
  see, and it is why the runtime scan is not optional.

  **The error names the applications, the host and the port, and nothing else.** It
  cannot name the environment variable behind a collision, and this document should
  not have said it could: by the time a port is a number, arbitrary JavaScript has
  run, and the worker protocol carries no provenance by design (see "Loading
  mechanism") — a value from `process.env.PORT`, from a helper, or from an awaited
  lookup is indistinguishable afterwards. What the check buys is not a better message
  than `AddressInUseError` but an earlier one: nothing has started, so no application
  is half-up, and both configurations are named rather than whichever worker lost the
  race.

  The runtime scan stays regardless — a capability that binds a port nobody declared
  is visible only once it has bound it, which is what that scan is for.
- **The runtime reports a map of URLs, not one URL.** `getUrls(applicationId?)`
  returns `{ '<app>:<worker>': url }` for every listening worker
  (`runtime/lib/runtime.js:1618-1632`); `start()` returns it (`runtime/lib/runtime.js:507`) after
  logging one line per **application** rather than one per listening worker
  (`#showUrls`, `runtime/lib/runtime.js:2561-2581`) — an application with several workers on distinct
  ports lists them together rather than N times over. `getRuntimeMetadata()` carries
  `urls` (`runtime/lib/runtime.js:1659`), `getApplicationDetails()` carries `urls` plus a first-element
  `url` convenience (`runtime/lib/runtime.js:2320-2322`), and worker records carry their own `url`
  (`runtime/lib/runtime.js:2439`). `wattpm ps` dropped its URL column and `wattpm applications` its
  Entrypoint column (`wattpm/lib/commands/management.js:81`, `:102-103`); `wattpm inject` now
  requires an application name unless the runtime has exactly one
  (`wattpm/lib/commands/inject.js:79-88`).
- **`basePath` now applies to every application**, not only the one facing the
  network (`runtime/lib/worker/main.js:309-313`, where the strip is no longer
  gated on `applicationConfig.entrypoint`).

The consequence for scaffolding is that the `3042` convention becomes
per-application and visible: `service`'s generator writes `server: { hostname,
port, logger }` into every application's own config
(`service/lib/generator.js:432-438` — the `!isRuntimeContext` guard is gone) and
the runtime generator hands application *i* port `3042 + i`
(`runtime/lib/generator.js:211-214`) while writing no root `server` block at all.
v4's code-first equivalent is the same thing spelled in the factory, with the
variable scoped as v3 scoped it: `next({ server: { port:
Number(process.env.PLT_API_PORT || 3043) } })`. v3's `getEnvVarName` returned a bare
`PORT` only for a standalone project and `PLT_<PREFIX>_PORT` for anything in runtime
context, the prefix derived from the application name
(`generators/lib/base-generator.js:112-120`, `:170-171`), so the scoping is not new —
it is the part the code-first translation must not lose. **Multi-application
scaffolding therefore never emits a global `PORT`**: one variable every application
reads is one port every application binds. Single-app scaffolding keeps
`process.env.PORT`, which is correct there and is what the platform expects, and
`migrate` carries across whatever v3 had — already the scoped name for any
runtime-context project. `3042` still
exists nowhere in the loading path.

**`||`, not `??`, and the difference is a real port.** An env file containing the
ordinary empty assignment `PORT=` supplies `''`, which is *present*, so `??` does not
fall back and `Number('')` is `0` — an OS-assigned ephemeral port where the reader of
that line expects 3042. `||` treats the empty string as absent and gives 3042, while
still honouring a deliberate `PORT=0`, since `'0'` is a non-empty string. Every port
expression in this document uses it, and scaffolding emits it. Zero-config
**synthesis** goes further, because it is loader-owned rather than user code and can
say what went wrong: an unset or empty `PORT` is 3042, a canonical integer in
0–65535 is used as written, and anything else — `PORT=abc`, `PORT=8080x`, a float —
is a load error naming `PORT` and the value it found, instead of a `NaN` that fails
later as a schema type error about a port the user never typed.

**A framework capability without a port means different things in development and in
production, and this document previously said otherwise.** The claim was that
`@platformatic/next`, `vite`, `astro`, `remix` and `nest` all return from their start
path when `server.port` is undefined, in both modes, so "no port" means "does not
start". That is true of the **development** paths and false of most of the production
ones, and the citations that supported it were the development returns.

- **Development, no port, no command**: the capability returns before building
  anything (`vite/lib/capability.js:221-223`, `astro/lib/capability.js:190`,
  `nest/lib/capability.js:79-82`). Nothing is constructed, so there is nothing to
  dispatch to — genuinely inactive. The `vite` citation is `ViteCapability`; an SSR
  Vite application runs a different class entirely and is not covered by this bullet
  (see the matrix).
- **Production, no port, no command**: `vite`, `astro`, `remix` and `nest` construct
  an in-thread Fastify application, register their routes and `await ready()`
  **before** the port check (`vite/lib/capability.js:279-303`,
  `astro/lib/capability.js:305-309`, `remix/lib/capability.js:167-172`,
  `nest/lib/capability.js:262-275`). The port check then returns without listening,
  and the inherited dispatch target falls back to the capability object
  (`basic/lib/capability.js:434-436`), through which `inject()` reaches the
  initialized instance (`vite/lib/capability.js:163-166`). That is a **working
  mesh-only application serving built artifacts**, not an inactive one.
- **Four capabilities return before building in production too**: `next`
  (`next/lib/capability.js:326-328`, before creating the child manager), `nitro`
  (`nitro/lib/capability.js:184-186`, and `:582-584` in the second capability class the package ships, `NitroViteCapability`), `nuxt` (`nuxt/lib/capability.js:81-83`) and
  `tanstack` (`tanstack/lib/capability.js:63-65`), each of which checks the port
  before selecting a startup path at all. For these, "no port" means "does not
  start" in both modes.

`react-router` extends `ViteCapability` and additionally selects an SSR production
path from `react-router.config.*`, read at worker startup
(`react-router/lib/capability.js:58-77`, `:118-131`). Which in-thread application it
builds is therefore not visible to the loader — but it builds one either way, so
*that it serves* stays decidable even though *what it serves* is not.

**The matrix is exhaustive over the shipped capabilities, because a partial one is
what produced this error twice.** Columns are the two boot modes; the value is what
happens with **no port and no command for that mode**:

| capability | `dev` | `start` |
| --- | --- | --- |
| `service`, `db`, `gateway` | mesh-only | mesh-only |
| `astro`, `remix`, `nest`, `react-router` | inactive | mesh-only |
| `vite` without `vite.ssr.enabled` | inactive | mesh-only |
| `vite` with `vite.ssr.enabled` | worker-classified | worker-classified |
| `next`, `nitro`, `nuxt`, `tanstack` | inactive | inactive |
| `node` | worker-classified | worker-classified |

`service`, `db` and `gateway` build their application before `_listen`, which is the
only thing the port guards (`service/lib/capability.js:299-301`), so the dispatch
fallback always has something to reach. `node` is classified by the started worker
because two of `#hasServer()`'s three inputs come from the application's own code.

**`vite` has two rows because the package has two capability classes**, and which one
runs is decided by the configuration, not by the package: `create()` selects
`ViteSSRCapability` when `vite.ssr.enabled` and `ViteCapability` otherwise
(`vite/index.js:60-63`). `ViteSSRCapability extends NodeCapability`
(`vite/lib/capability.js:334`), so an SSR Vite application runs Node's startup path
and inherits Node's uncertainty exactly — its serving state depends on the module's
`hasServer` and its factory's `isBackgroundApplication`. A single per-package answer
would reject a valid no-port SSR factory under `dev` and promise a mesh URL under
`start` for a module that reports `hasServer = false`.

**So the declaration is a function of the resolved capability configuration, not a
constant.** The schema subpath (`@platformatic/<x>/schema`) currently exports the
schema, `skipTelemetryHooks` and `modulesToLoad`; it gains `servesWithoutPort`, read
main-side with the schema, after validation and before any worker exists — which is
precisely when the resolved capability config is available:

```ts decl
import type { ServesWithoutPort } from '@platformatic/basic'

// Every capability exports this under the name `servesWithoutPort`; the five shapes are:
export const alwaysServes: ServesWithoutPort = { development: true, production: true }
// service, db, gateway
export const servesInProductionOnly: ServesWithoutPort = { development: false, production: true }
// astro, remix, nest, react-router
export const neverServes: ServesWithoutPort = { development: false, production: false }
// next, nitro, nuxt, tanstack
export const onlyTheWorkerKnows: ServesWithoutPort = 'worker'
// node

export const theConfigurationDecides: ServesWithoutPort = config => {      // vite
  const ssr = (config as { vite?: { ssr?: boolean | { enabled?: boolean } } }).vite?.ssr
  return ssr === true || (typeof ssr === 'object' && ssr?.enabled === true)
    ? 'worker'
    : { development: false, production: true }
}
```

A constant is the common case and stays legal; the callable form exists for the
capability whose behaviour its own configuration selects, which is the shape a
per-package constant cannot express and the shape this document got wrong.

**A callable receives the configuration as *authored and validated*, never as
transformed**, and Vite is the reason to say so rather than leave it implied.
`servesWithoutPort` is read main-side, after validation and before any worker; the
capability `transform` runs worker-side, later. So a callable sees whatever shapes the
*schema* admits, and Vite's `ssr` is an `anyOf` of a boolean and an object
(`vite/lib/schema.js:47-63`) that only `transform` normalizes to the object form
(`vite/index.js:12-19`). Testing `ssr?.enabled` alone reads `undefined` for
`vite({ ssr: true })` — a supported spelling — and classifies an SSR application as
ordinary Vite: rejecting a valid in-process SSR factory under `dev`, and promising
mesh availability under `start` for a module that may report no server. Any capability
whose schema accepts a shorthand has the same trap, so the rule is stated once here:
**read authored shapes, not transform outputs**, and cover every spelling the schema
admits in the tests.

**Absent means `'worker'`, not `false`.** A third-party capability that does not
declare this is one the loader knows nothing about, and the two wrong answers are
opposite: `false` rejects at load a capability that would have served the mesh
perfectly well, and `true` prints a mesh URL that answers nothing. Deferring to the
started worker does neither — it costs the fail-fast only for capabilities outside
this repository, which is exactly where the certainty is missing. The in-tree
capabilities all declare it, and the plan's capability item covers adding it.

The command exception is unchanged and applies in both modes: a declared
`application.commands.*` is checked **before** the port and starts the application on
its own terms (`next/lib/capability.js:198-212`, `:312-327`), with the runtime
observing whatever it binds. Scaffolding and `migrate` still emit a port for a
framework application — a production-only mesh-only mode is a deliberate thing to
choose, not a default worth generating into.

**Zero-config boot supplies its own port.** Level 0 — `wattpm dev` in a bare
Next/Vite repo with no config file — is a stated non-goal to break, and on v3 it
worked because the single application became the entrypoint and
`buildListenOptions(undefined)` gave it `{ port: 0 }`. With the entrypoint gone
the synthesized config would carry no `server.port` and a framework application
would start nothing, so **synthesis supplies a port of `Number(env.PORT || 3042)`**,
where `env` is the map `loadEnv` has already resolved for that directory — the same
answer the expression `Number(process.env.PORT || 3042)` gives when scaffolding writes
it into a real file, arrived at differently because synthesis is an object source.
A file is evaluated in a worker whose `process.env` **is** the resolved map, so the
expression reads env files; synthesis runs main-side and does not mutate
`process.env` (see "Object config sources"), so it must read the resolved map
directly. Taking the ambient `process.env` instead would ignore a `PORT=4000` sitting
in the project's own `.env` and bind 3042 — the one file a zero-config user is most
likely to have written. The ordering is what makes this work: `loadEnv` is step 2 of
the walk and synthesis happens after it. The convention therefore still lives in
configuration rather than becoming a hidden loader default; synthesis simply *is*
the configuration for a zero-config boot. It applies **only to a
single-application project**, which is the only shape zero-config can produce:
detection resolves one application type for the root directory
(`foundation/lib/cli.js:298-317`). Multi-application projects get their ports from
their own configuration, never from a default.

Synthesis is **not gated on what sits above**: running in an application directory of
a larger project still synthesizes, and warns that the configuration above is not
applied (see "Scope"). The alternative — refusing — requires deciding that an
ancestor config describes this directory, which a filename check cannot establish and
an evaluation could only establish by executing a file above the search's stop point.

**Not listening has four meanings, and the startup output must tell them apart.**
Without a port, an application is **mesh-only** — reachable at
`http://<id>.plt.local` because `getDispatchTarget()` falls back to in-thread
dispatch (`basic/lib/capability.js:434-436`) — or **inactive**, because its
capability's start path returns early when `server.port` is undefined, or
**background**, a `node` application that declares it has no server and is not
supposed to be reachable at all, or **inactive at runtime** — the fourth case, which
exists only for a worker-classified capability, because that is the one kind nothing
rejects at load (see the predicate below, where both earn their place). The second
is real, and it is **mode-specific**: `next` returns without starting in both modes
(`next/lib/capability.js:209`, `:326`), while `vite`, `astro`, `remix` and `nest` do
so only under `dev` — in production they build an in-thread application first and are
mesh-only (see "How applications are exposed"). Reporting an inactive framework
application as "mesh-only" would be worse than printing nothing, since it names an
address that answers nothing; reporting a production one as inactive would be the
same mistake pointed the other way.

Which applies is decided by a **predicate over the capability and the entry
together**, not by a capability flag alone. An application will serve if **any** of
three things holds:

1. its capability can serve without a listener **in the mode this boot will use** —
   read from `servesWithoutPort` in the capability's schema subpath, per mode rather
   than per capability, because that is how the capabilities actually behave. The
   matrix in "How applications are exposed" is the authority; an absent declaration
   means `'worker'`, which never produces this error;
2. its `server.port` is defined;
3. it declares a **custom command for the mode this boot will use** —
   `application.commands.development` under `dev`, `application.commands.production`
   under `start`.

The third is not a technicality. Every framework capability checks its command
*before* the port: `if (command) return this.startWithCommand(command, …)` precedes
`if (typeof this.serverConfig?.port === 'undefined') return` on both paths
(`next/lib/capability.js:198-212` and `:312-327`; `vite`, `astro`, `remix` and `nest`
are the same shape). A framework application with a custom command and no
`server.port` is therefore **valid and starts** — its command binds whatever it
binds, and the runtime observes the address, which is exactly the "custom listeners
are observed, never rewritten" rule. A predicate that looked only at the capability
would reject that configuration at load.

**Which command counts is decided by the mode, not by either command existing.**
`#startDevelopment` reads `commands.development` and `#startProduction` reads
`commands.production` (`next/lib/capability.js:198,310`); neither falls back to the
other. An application declaring only a development command and booted with `start`
has no command *and* no port, and would start nothing — so the predicate asks about
the command that will actually run. The root context already carries `production`
when the predicate is evaluated, so this stays a load-time decision; it is the same
kind of mode-dependence `enabled` already has, and unlike the `SO_REUSEPORT` case it
depends on what the operator asked for rather than on the machine they asked for it
on.

All three inputs are configuration, so the predicate is decidable **before boot**.
An application satisfying none of them is a **load-time error** naming it and its
capability — fail fast, rather than booting a runtime with one application silently
missing.

**The error belongs to the rows the matrix decides statically, and to nothing
else.** Those are the
start paths that return early on a missing port before building anything, so "no
port, no command" provably starts nothing there: a framework capability under `dev`,
and `next`, `nitro`, `nuxt` and `tanstack` under either. **Worker-classified rows are
exempt in both modes** — `node`, and `vite` with SSR enabled — because nothing
main-side can prove they start nothing, which is what worker classification means.
Reading "framework capability under `dev`" as covering Vite SSR would reject exactly
the configuration the matrix exists to admit. A production `vite`, `astro`,
`remix`, `nest` or `react-router` never reaches it, because that boot has an
in-thread application to dispatch to — the mode is part of the predicate's input,
not a detail of it. `service`, `db`, `gateway` and `node` never reach it either, but
`node` is exempt for a different reason, and collapsing the two is what
makes rule 1 look like it decides more than it can. A `node` application serves the
mesh in-thread **when it has a server**, and `#hasServer()` reads three things
(`node/lib/capability.js:264-269`): `config.node.hasServer`, which is configuration;
`module.hasServer`, a module-level export; and `isBackgroundApplication` on the
factory's result. The last two are known only once the application's own code has
been imported and its factory called. Whether a given `node` application will serve
is therefore **not a load-time fact**, and the honest consequence is that it can
never be a load-time error: a background worker that serves nothing is a supported
thing to write, not a misconfiguration to reject.

**Which makes a third state, and the startup report needs it.** A background `node`
application is neither mesh-only nor inactive-because-misconfigured:
`getDispatchFunc()` hands back `#backgroundServiceInject`, which destroys any request
that arrives — "Background services cannot receive HTTP requests via the mesh
network" (`node/lib/capability.js:468-470`, `:578-579`). Printing
`http://<id>.plt.local` for it would name an address that answers by hanging up,
which is the failure the mesh-only/inactive distinction exists to prevent, one
capability further along. So the report carries **background** beside the other two,
and it comes from the started worker, which is the first thing in the system that
knows.

The loader does not warn per application: in a typical monorepo most applications
are deliberately mesh-only, and a warning would fire N−1 times on every boot. What
changes is the report. `#showUrls` (`runtime/lib/runtime.js:2557-2577`) currently
does `if (!url) continue`, so a project that binds nothing prints no address and no
explanation. It prints **one line per application**, in one of four shapes, so the
set of externally reachable applications is always visible:

``` output
gateway    listening at http://127.0.0.1:3042
api        mesh-only — http://api.plt.local
frontend   listening at http://127.0.0.1:52418        (port: 0 — ephemeral)
jobs       background — no HTTP dispatch target
worker-x   inactive — capability reports no serving state
```

**Worker-classified rows are reported by the worker, not derived by the report**, and
that needs a contract rather than an inference. `getDispatchTarget()` falling back to
the capability object proves nothing: `basic`'s fallback returns `this` whenever there
is no URL (`basic/lib/capability.js:434-436`), whether the start method built a
dispatcher or returned without building anything. So the v4 capability contract adds
**`getServingState()`**, returning `'listening' | 'mesh-only' | 'background' |
'inactive'`, travelling with the status reply the worker already sends. `node`
implements it from `#hasServer()` — false via `config.node.hasServer`, a module-level
`hasServer` export, or `isBackgroundApplication` on the factory result
(`node/lib/capability.js:264-269`), two of which are only knowable after the
application's code has run — and `ViteSSRCapability` inherits that implementation
along with the rest of Node's startup path.

**It is a new field, `servingState`, and it does not touch `status`.** The two are
different questions — `status` is worker lifecycle, and the runtime gates URL
emission on `status === 'started'` (`runtime/lib/runtime.js:2320`), so overloading it
with a serving enum would drop every URL the moment `'listening' !== 'started'`.
`servingState: 'listening' | 'mesh-only' | 'background' | 'inactive'` is added to the
worker info reply and surfaces beside `status` on `ApplicationDetails`
(`runtime/index.d.ts:116-134`) and in the management payload. For an application that
is not running it is **absent**, not `'inactive'`: a stopped application is not making
a claim about how it would serve, and conflating "not started" with "started and
serving nothing" is the distinction this field exists to draw. A report shape the
programmatic API cannot answer is a shape that exists only in a terminal, which is why
it goes in the DTO rather than only in the printed line.

**Every worker answers, and they must agree.** `servingState` is computed per worker,
and for a worker-classified capability it depends on invoking the application's
factory *in that worker* — nothing stops arbitrary code from returning a Fastify app
from worker 0 and a background result from worker 1. Sampling one worker, which is
what `getApplicationDetails()` does today, would make the reported value depend on
which worker the selector happened to pick. That is the smaller half of the problem:
the larger one is that mesh dispatch would then route a share of requests to a worker
that destroys them. So the runtime **collects `servingState` from every worker and
refuses a mixed answer**, at start and again at scale-up, naming each worker and the
state it reported. One application is one thing; workers that disagree about whether
it serves HTTP are a bug in the application, and failing loudly beats destroying a
fraction of mesh requests. Merely naming the sampled worker in the report would be
the cheaper answer and the wrong one: it makes the reported value honest and leaves
the routing hazard exactly where it was.

**`BaseCapability`'s default is deliberately pessimistic**: `this.url ? 'listening' :
'inactive'`. A third-party capability that neither declares `servesWithoutPort` nor
overrides this method is one nothing in the system can vouch for, and of the two ways
to be wrong, under-reporting a working application is the recoverable one —
over-reporting prints a mesh address that answers nothing, which is the failure this
whole section exists to prevent. The row says which it is (`inactive — capability
reports no serving state`), so the fix is legible to the capability's author rather
than mysterious to its user.

**There is a fourth shape after all, and only for worker-classified capabilities.**
An `inactive` row is reachable at runtime precisely because nothing rejected the
application at load: that is the cost of `'worker'` classification, accepted
knowingly. For every capability the matrix decides statically the old rule is intact
— a configuration that would serve nothing is refused at load, where the message can
name the entry, its capability and the
three ways to satisfy it. A status row would be the same information delivered after
the runtime had already booted around the hole. `background` is the opposite
situation and that is why it earns a row: nothing is wrong, and the thing that knows
is the worker.

A custom-command application appears as `listening`, at whatever address its command
chose: the runtime observes it rather than assigning it, so the report shows what it
actually bound.

The predicate proves *intent*, not *outcome* — a declared command is a statement that
something will bind, and no configuration check can promise that an arbitrary command
does. `startWithCommand` waits for the child to report a URL
(`basic/lib/capability.js:622`), and a command that never reports one is bounded from
outside rather than left hanging: the runtime runs `sendViaITC(worker, 'start')` under
`executeWithTimeout` and raises `ApplicationStartTimeoutError` after `startTimeout`
milliseconds — 30 s by default (`foundation/lib/schema.js:1115-1119`), the worker
terminated and the application named
(`runtime/lib/runtime.js:3501-3508`). So a command that never binds does not need a
report row of its own: it never reaches the report at all, because the boot failed
first and said which application and how long it waited.

An application with `workers` and `portAssignment: 'perWorkerIncrement'` lists its
whole range on that one line (`http://127.0.0.1:3000-3002`), since `getUrls()`
carries a URL per worker.

Two invariants come with that mode, both **load-time** errors because both are
computable from configuration alone. `port: 0` with `perWorkerIncrement` is
rejected: the offset is added to the declared port
(`runtime/lib/runtime.js:1993-1997` pre-`e2da15eda`), so worker 0 would request an
ephemeral port while workers 1 and 2 requested ports 1 and 2 — privileged, and
unrelated to each other. And `port + workers − 1` must not exceed 65535, checked
against the **maximum** worker count when `workers` is dynamic, since scaling up
later must not walk off the end of the range.

**The search never leaves your package**, and that single stop condition is the
whole of the trust story. Because v4 searching means *executing* what it finds, a
stray `~/watt.config.ts` — or a base image's `/watt.config.ts` — must be
structurally unreachable **from the search**. It is: the search runs from the
current directory up to the nearest ancestor holding a `package.json` and stops
there, so reaching `~` would mean walking out of the package you are standing in.
A directory that is inside no package at all searches only itself, so running
`wattpm` in some scratch directory cannot reach a config file above it either.
No marker list, no workspace detection, no eligibility test, no trust store, no
prompt. A path someone **names** is a different act and is not governed by this
rule: `--config`, and hot-add's `POST /applications` naming an absolute path, are
deliberate requests from someone who already has runtime privileges — the search is
what must not wander, not the operator. The one residual case is a `$HOME` that is
*itself* a Node package, where
`~/watt.config.ts` is reachable from a loose directory below it; as in v3 the
invariant is best-effort, and stated as such. When the search finds nothing,
zero-config synthesis applies if the detector recognizes the directory (see "How
applications are exposed"); otherwise the run stops with an error naming the
directories searched and pointing at `--config`.

**Synthesis is never refused on account of a configuration above.** If a
`watt.config.*` **or a v3 legacy configuration** exists in an ancestor, the boot
proceeds and says so — the ancestor scan looks for the complete candidate set, not
just the v4 names, because a v3 monorepo is exactly where a configless subpackage is
most likely to be found, and synthesizing there while an ancestor `platformatic.json`
describes the application is the same silence with an older filename:

``` output
⚠ web/api has no watt.config.* of its own and is booting with inferred defaults.
  A Watt configuration exists at ../../watt.config.ts; if it describes this
  application, none of what it says — workers, health, env, telemetry, and the
  port it assigns — is applied here. Run wattpm there to start it with the
  runtime, or add web/api/watt.config.ts to configure it standalone.
```

and where the ancestor is a v3 file, the same warning names the upgrade instead:

``` output
⚠ web/api has no watt.config.* of its own and is booting with inferred defaults.
  A v3 configuration exists at ../../platformatic.json, which this version cannot
  read. Run npx wattpm-utils@4 migrate there, then run wattpm from that directory.
```

This is a deliberate choice against a stricter alternative, and the reasoning is
worth recording because it cuts the other way at first glance. Booting on `3042`
when the runtime would have assigned `3001` is a real hazard. But refusing means
deciding that an ancestor config *describes* this directory, and a filename check
cannot know that: the ancestor may be a Level 1 app-def describing only itself, in
which case the refusal names a file that never mentions this directory and sends
the user somewhere that boots something else. Establishing the fact requires
evaluating a config above the point the search deliberately stopped at — buying
strictness with the trust boundary. Running `wattpm` inside a directory is a
request to run *that* directory; the cost of honouring it is visible in the
warning, and the fix is one file.

**The ancestor check selects no configuration file**, and that is the property this
paragraph rests on: nothing above the stop point can decide which config boots. It
is *not* inert, and "Scope" says why — the same walk picks the env root, so an
ancestor `watt.config.*` extends `.env` layering upward and can change what an
expression computes. The warning above is diagnostics; the walk that produced it is
not.

**Naming a directory is not searching for one.** The stop condition governs the
*search* for a config file and nothing else. An application entry's `path` is
trusted wherever it resolves, `../` included: pointing at a directory beside the
runtime rather than beneath it is an ordinary layout, and 39 in-tree configurations
already do it. (The **runtime** trusts it; `migrate` is stricter, and refuses to
mutate a tree outside its transaction root — see "`wattpm-utils migrate`". Reading a
directory a configuration names and rewriting another project's files are different
acts.) The same holds for `resolvePath` keywords and every other path a
configuration names — a configuration is trusted code, and a directory it names is
part of what it describes. The one containment rule lives in `resolve`, and it
governs *creating* directories rather than reading them: `resolveApplications`
refuses to clone into a path outside the project root, skipping that entry with a
warning (`wattpm-utils/lib/commands/external.js:637-645`), while a directory that
already exists is used as-is whatever its location. That rule is stated as v4 keeps
it, not as the current code implements it: the check is a string prefix match, so
`/tmp/app-evil` passes as contained by `/tmp/app` and a symlinked ancestor inside
the root redirects the write outside it. Filed as
[#5078](https://github.com/platformatic/platformatic/issues/5078) — a boundary test
on canonical paths, not a prefix comparison. The format inherits neither the bug nor
its fix; it inherits the rule.

Env files are **not** subject to this. They layer from a config file's own directory
up to the **env root** — the outermost `watt.config.*` above it — so a monorepo's
root `.env` keeps applying when you run inside `web/api`, even though the *config*
search stopped at that application's `package.json` (see "Env files"). The two rules
use different delimiters on purpose: the search stops at your package because it
**executes** what it finds, while env files are data and are bounded by the Watt
project itself. The asymmetry is deliberate and is the reason the rule
can be this small: walking up for a **config file** means running code, which is why
it stops at your package; walking up for a **`.env`** means reading data, which is
bounded by the project rather than the package. A monorepo that keeps
`DATABASE_URL` in its root `.env` therefore keeps working when you run
`wattpm dev` inside `web/api`, without the loader having to infer that a project
"really" extends further up.

This is deliberately incurious about what sits above. Running `wattpm dev` inside a
subdirectory of some larger tree boots what that directory describes, and every
invocation prints the deciding file and what is about to boot before doing anything
else — so the outcome is visible, not silent. Where a deploy script or a monorepo
task genuinely means the whole runtime, `--config` or running where the runtime
configuration lives says so explicitly.

**`--config` names the configuration directly.** The flag's file is the deciding
file, no search runs, and cwd stops selecting anything — so `wattpm start --config
/app/watt.config.ts` from inside an application directory boots the full runtime,
which is what the migration guide's deploy note recommends. Env files still load by
walking up from that file's directory. `--config` / `--env` are the escape hatches
for anything the search deliberately will not reach.

### Loading mechanism: the eval workers

**Configuration is code, and it is trusted code.** A `watt.config.ts` runs with the
runtime's privileges, as do the capability packages it imports and the application
code the runtime starts — exactly as in v3, where an application's config file
selected a module that the worker then imported and executed. This is stated once,
here, because several mechanisms below would otherwise look like security
boundaries and are not:

- **evaluation workers isolate module caches, environments, crashes and hangs.
  They are not a sandbox.** A config file can read any file the process can, open
  sockets, and mutate globals within its own thread. Their isolation exists so that
  a shared helper cannot leak one application's environment into another's
  evaluation, and so a hanging config cannot take down the loader — not to contain
  hostile code;
- **the main process imports capability schema modules** resolved from the
  application's own dependencies (below). That is application-controlled JavaScript
  running with full privileges in the loader's process. Calling the subpath *light*
  is a statement about its import cost, never about safety;
- **resolved configuration contains whatever the environment contained.**
  `--debug-config` prints it, and `getRuntimeConfig`/`getApplicationDetails` return
  it, so both can surface secrets. They are operator tools on a trusted runtime and
  are not redacted;
- **hot-adding an application evaluates the configuration it discovers**, so
  `POST /applications` and the ITC `management:addApplications` handler are
  code-loading operations. The evaluation uses the **running runtime's own context** —
  its `command`, `mode` and `production`, not a fresh `exec` context — because the
  application is joining that runtime and must see what its siblings saw; and its
  resulting import list and env files **join the dev watcher** as one atomic update,
  with hot-remove releasing them by reference count, so a path two applications share
  survives the removal of one. An application granted `management: true` receives every
  operation, `addApplications` included.

The reason this is the right model rather than a concession: anything able to write
a `watt.config.ts` into the project can already run code through an install script,
a capability package, or the application entry point itself. A boundary here would
protect nothing that is not already open. Deployments that need stronger
separation put it where it works — separate runtimes, separate processes, separate
credentials — not between a project and its own configuration.

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

1. **The root worker** is constructed by the main process with an explicit
   `env` — the real environment layered with the deciding file's **own directory's**
   env files layered over the rest of its chain **up to the env root**, for the
   active `mode`, resolved by the ladder (see "Env files"). That is the same two
   layers every other worker gets, applied to the deciding file's directory: under a
   standalone boot the deciding file *is* the application's, so its own directory is
   the application's directory and `web/frontend/.env` is read, not skipped. Workers
   never inherit
   the main process's `process.env` and never read env files themselves. It imports
   the root config (`import(pathToFileURL(path))` — `.ts`/`.mts` via Node's built-in type
   stripping, the same mechanism the runtime already uses for `extensions`). It
   **unwraps** the default export — and unwrapping is *only* the function call: if
   the export is a function it is called with the context above and awaited, and a
   result that is itself a function is an error naming the file. Nothing is
   classified, auto-wrapped or read for its shape yet. **Everything after that
   happens on the canonical snapshot, in this order**, because the original object is
   reachable exactly once:

   1. **Canonicalize the unwrapped value** in a single walk (see "Serializability"),
      rejecting accessors, Proxies and functions — with one carve-out: a
      function-valued `application.config` / `applications[].config` is *allowed*, and
      its position is recorded, the slot left pending in the snapshot. The carve-out
      is a **structural path test**, not a semantic one, which is why it can run
      before classification: those two paths are the only places a function survives
      the walk, whatever the file turns out to be. After this step nothing else holds
      a reference to the original object.
   2. **Classify the snapshot** by the four rules (see "Root and per-app files share
      the same filename"), and **auto-wrap** a bare `ApplicationDefinition` into a
      root shape here — reading `module`, `application`, `applications` or `autoload`
      off the *raw* export to decide that would be the first read of the object's
      shape, and the whole point of the ordering is that there is no such read. A
      recorded slot in a file that classifies as an `ApplicationDefinition` is an
      **error**, not a deferred call: a per-app file has no `config` slots, so the
      only thing that path can hold there is a capability option that happens to be
      named `config`, and calling it would be the loader inventing a callback the
      author never declared. (The per-app deferred form is the factory callback —
      `next(ctx => …)` — which is rule 1's function export, not a slot.)
   3. **Validate the unexpanded root shape.** Orchestration keys only — ids, `path`,
      `url`, `enabled`, `autoload`, `workers` — since a pending `config` slot has
      nothing to validate yet and capability configuration is validated later,
      main-side, against each capability's own schema. This is a **shape** check and
      injects no defaults; the `useDefaults` pass runs main-side on the returned
      snapshot, which is what keeps step 4's projection carrying authored values
      rather than schema-supplied ones.
   4. **Expand `autoload`** into the application list, reading `autoload.path`,
      `exclude` and `mappings` from the snapshot; then **record every entry carrying a
      `url`** as `{ id, url, path, gitBranch }` — the projection the worker posts beside the
      config; then **resolve `enabled`**, dropping disabled entries. The recording
      sits between the two because that is the only moment both lists exist: after
      expansion, so autoloaded and backfilled entries are in it, and before the
      filter, which is what lets `resolve` fetch an application this boot excludes. Orchestration drives filesystem access — `autoload.path`
      decides which directories are read, `mappings` and `enabled` decide which
      applications are evaluated at all — so it is checked before it is acted on,
      which is what v3 did (`foundation/lib/configuration.js:587-606`, validate then
      transform). This is the **only** place autoload expansion runs; the runtime
      transform consumes the already-expanded list.
   5. **Call the deferred slots that survived**, with the same context the root export
      was called with (the context is uniform — see "Functional form" — so the loader
      **calls** and awaits, since awaiting a deferred definition without calling it
      would yield the function itself). Each result is canonicalized under the same
      rules with **no** carve-out — a deferred config may not itself return a
      function — and spliced into its slot.

   **Steps 3–5 are in that order for one reason: a disabled entry's `config` callback
   must never run.** An entry excluded from this boot may name a capability the
   production image does not ship, or call `requiredEnv()` for a variable that was
   decommissioned with it; invoking it to find out would fail a boot that excludes it.
   A pending slot is still *visible* to step 4 — an entry whose slot was recorded
   counts as having an inline `config`, which is what decides that it gets no per-app
   eval worker — so deferring the call costs the expansion nothing.

   The ordering is the point, not an implementation detail. Reading `module`,
   `applications`, `autoload` or a `config` slot off the *raw* export would re-open the
   time-of-check/time-of-use gap canonicalization exists to close: a getter can return
   one array to the expansion and another to the walk, so the topology that drove
   directory reads need not be the topology that was validated. Canonicalizing first
   makes "nothing downstream ever touches the original object" literally true — after
   step 1 there is nothing else holding a reference to it.

   **`enabled` is resolved in step 4, before fan-out and before the deferred pass.**
   It is orchestration, so its value is always lexically present in the root config or
   in `autoload.mappings`, and the root context already carries `production` — so
   disabled entries are dropped immediately after expansion, before any per-app
   worker is spawned, before the detector runs, and before capability validation.
   This preserves v3, where `transform()` spliced disabled applications out ahead
   of `prepareApplication` (`runtime/lib/config.js:398-402` pre-`19d8fb98b` then `:412`)
   and no
   worker ever existed for them: a decommissioned app whose capability is absent
   from the production image, or whose config file calls migrate's
   `requiredEnv()`, must not be able to fail a boot that excludes it. The one
   consumer that needs the list *before* this filter is `resolve`, which is owed the
   entries it is expected to fetch rather than the entries this boot would run. That
   is not a read it can perform for itself, because the filter runs here, in the
   worker, and the worker exits: it is served by the projection step 4 records on the
   way past and the protocol carries back (see "Remote apps") — the same evaluation,
   not a second one.

   **The guarantee is exact for per-app files and partial for root-inline entries**,
   and the difference is not fixable by ordering. `enabled` is read from the
   canonical snapshot in step 4, and step 5 calls only the slots that survived it, so
   a **deferred** inline `config` is never invoked for an entry this boot excludes —
   that much is ordering, and the ordering above is chosen for it. But an **eager** inline `config` has already run: it is an
   expression in the root file's object literal, evaluated while the export was being
   constructed, before the loader saw anything. Its capability `import` is earlier
   still, at module load. So `applications: [{ id: 'legacy', enabled: false, config:
   legacyCapability({ … }) }]` fails a boot that excludes it if
   `@platformatic/legacy-capability` is missing from the image — and no loader
   ordering can prevent that, because both happened before the loader was given the
   object. The deferred form is the escape: `config: ctx => legacyCapability({ … })`
   defers the call, though not the static import. Migrate emits the deferred form for
   any entry it converts with `enabled: false`, and the per-app style avoids the
   question entirely, which is a further reason it is the canonical shape.
2. **One worker per per-app file**, spawned in parallel once the root result is
   in, uniformly for every
   application entry that has a `path` and no inline `config` — explicitly-listed
   entries and autoloaded ones behave identically, as in v3. **Discovery skips a
   candidate that is the deciding file itself**, whatever the entry's shape: an entry
   whose directory is the deciding file's own directory falls through to the detector
   rather than re-reading the file that produced it. Without that,
   `defineConfig({ application: { workers: 2 } })` in a bare repository — whose entry
   has a defaulted `path` and no inline `config` — would discover its own root config
   and fail with "a root config cannot nest inside an application entry". (Entries *with* an
   inline `config` still get a filename-presence check in their directory: a
   `watt.config.*` file there triggers the configured-twice error — no evaluation
   involved, and the **deciding file itself is exempt**, so a Level 1 auto-wrap or
   the singular `application` shorthand never trips it (see "One dialect, three
   levels of ceremony"). This is a **root-boot** check: running from the application's own
   directory never evaluates the root, so the app's file simply decides, per the
   scoping rule, and the standalone warning names what is not applied. The error
   exists to stop a *root* boot from having two sources for one application, not to
   police which file wins when you stand in the application.) Because the root worker has now returned the configuration, the
   main process knows each application's `path` and `envfile`, so it resolves the
   **config-evaluation** environment by that view of the ladder — real environment,
   then that application's chain — its own directory up to its env root — layered
   over the deciding file's chain, or its `envfile` in place of its own chain — and constructs that
   app's worker with the result as an explicit `env`. `env` blocks are deliberately
   not part of it (see "Env files"); they are applied when the application's own
   workers are constructed at boot. The worker imports the file and
   unwraps the export. A per-app file
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
   not an optimization. It is *light* only in import cost — it executes in the main
   process with full privileges, like any capability code (see the trust model
   above) — and it carries the package-level metadata main-side
   preparation needs besides the schema: `skipTelemetryHooks` (which decides
   whether the worker gets the OpenTelemetry `--import` hook — `runtime.js:2692`,
   set by gateway, db, and service), `modulesToLoad`, and **`servesWithoutPort`**,
   the per-mode declaration the serving predicate reads (see "How applications are
   exposed"; absent means `'worker'`). All three move into the
   subpath's exports and the entry envelope, so **boot** never imports the full
   capability package into the main process. Non-boot paths do, and deliberately:
   `command: 'exec'` imports `transform` and `createCommands` from the capability's
   main entry (see "CLI commands over config"), which is what v3 already does
   (`runtime/index.js:346-349`). The subpath keeps the boot path light; it is not a
   claim about the whole process lifetime.

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
   detector provably reconstructs the wizard's choice — which is what makes the
   **single-app** zero-config case sound. Multi-app projects never rely on it:
   `create` and `migrate` both emit a file per application, with the capability
   written explicitly. Boot logs one line per detected app
   (`web/frontend → @platformatic/next (detected)`) so the inference is never
   invisible, and there is no generic-`basic` fallback for runtime applications.
3. In every eval worker, a **`module.registerHooks`** resolve hook (the synchronous
   API — the async `module.register` variant does not intercept `require()`, and a
   `watt.config.js` in a `"type": "commonjs"` package is CJS) records every file
   the evaluation transitively imported or required; the main process merges the
   per-worker lists for the watcher.

   **That list has to survive a failed evaluation, which is exactly when it matters.**
   Add an `import` of a helper to a config file, have the helper throw, and there is
   no valid result for `importedFiles` to ride back on; let the evaluation hit the
   `--config-timeout` and the worker is terminated before it could post anything. A
   watcher holding only the last good set is then not watching the helper, so fixing
   the helper triggers no reload and `wattpm dev` looks hung on a file the user is
   actively editing. So the hook **streams** each resolved path to the parent as it
   records it rather than accumulating a list to post at the end, structured error
   results carry the same paths, and the main process keeps the **union of the last
   good set and whatever the failed load reported** until an evaluation succeeds.
   Streaming is what covers termination, where nothing can be posted; the union is
   what covers a broken config that currently imports less than it did.
4. Each worker **canonicalizes in-worker, before `postMessage`**, building the
   plain-data snapshot described above: the config is about to cross Node's
   structured-clone boundary, where a nested
   function throws an opaque `DataCloneError` and a class instance is silently
   flattened to a plain object — both before any main-side check could see the
   original value, so a check after the boundary cannot keep its promises. It is
   the snapshot that is posted, never the evaluated object, which is what closes
   the gap between what was checked and what was transported.
   Violations post a structured, path-aware error (`InvalidConfigValueError`
   naming the JSON path); valid results post back
   `{ config, importedFiles, resolveCandidates }` and the worker exits. `config`
   holds the applications this boot runs: the `enabled` filter has already been
   applied, in step 4, and no second list of entries carrying capability
   configuration crosses the boundary. `resolveCandidates` is the third field and it
   exists because of what step 4 destroys — the entries that carried a `url`,
   captured **before** the filter, each projected to `{ id, url, path, gitBranch }`.
   `resolve`
   is owed those (see "Remote apps") and this worker is the only place they are ever
   visible; it exits immediately after posting, so a list not carried across the
   boundary is simply gone. Projecting rather than shipping the unfiltered entries is
   deliberate: a disabled entry's deferred `config` slot is never called, so an
   unfiltered list would put entries with an unfilled slot into the main process, one
   forgotten drop away from the runtime. A projection carrying no capability
   configuration cannot be booted by accident, whatever downstream code does with it.
   The protocol carries no
   environment: the main process resolved that worker's `env` before constructing
   it, and resolves every application worker's the same way at boot — one
   implementation serving both views of the ladder, which differ only by the rungs
   that exist solely at runtime (the `env` blocks and the injected `PLT_<ID>_URL`
   values). Provenance never
   travels either; it is a byproduct of resolution (which source won) rather than a
   set to be shipped and kept in sync, so there is no `envFileKeys` and no
   `injectedKeys` in `workerData`. Injected `PLT_<ID>_URL` values are simply a rung
   of the worker-boot ladder, above every env file, which is what keeps a stale
   `PLT_*_URL` line in an app's `.env` from overriding the mesh URL.
   After evaluation each worker diffs its live
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
(`useDefaults`, **`coerceTypes: false`**) → `kMetadata` attachment → the **runtime**
`transform()` (`runtime/lib/config.js`, which normalizes and prepares the entries it
is handed). **In v4 that transform no longer expands `autoload` and no longer filters
on `enabled`**: both moved to the root eval worker's step 4, which is the only place
either runs. v3 did both here (`runtime/lib/config.js:450-484` then `:486-490`), and
leaving that code reachable would let a second expansion re-merge entries and read
the filesystem after the authoritative snapshot already exists. The `autoload`
**declaration** survives expansion untouched, as data beside the expanded list —
`GET /metadata` reports it, and `applications:add --save` needs it to decide whether
a new application belongs in a mapping or as an explicit entry. It is carried, never
re-executed; everything downstream reads the expanded list.
The **capability** `transform` is a different function and is not
part of this pipeline: it runs worker-side at boot, where its context lives — see
"Config code runs exactly once per load" below. Canonicalization has already run in-worker — immediately after the unwrap, before
expansion (see step 1) — and the main process consumes that snapshot; it canonicalizes itself only for **object
config sources** (the programmatic API and zero-config synthesis, which never
cross a worker boundary) — in the same position the root worker uses, **before
autoload expansion or any other read of the object's shape**, and before metadata
attachment, because `kMetadata` is symbol-keyed and non-JSON by design. Those sources
need it just as much, and for the same reason: an embedder can hand `create()` an
object carrying getters or a Proxy, and a deferred `config` there is rejected
outright (see "Object config sources"), so the carve-out the root worker makes for
function slots does not apply. Coercion is disabled in v4: its
only justification was placeholder strings, and on the genuine unions that survive
the audit (`boolean | number`, `boolean | object`) AJV coercion is a documented
hazard in this very codebase (`runtime/lib/config.js:532` warns that `2` would be
coerced to `true`). The audit also guarantees that schema-injected defaults are
themselves serializable.

Why a throwaway worker instead of a plain `import()` in the main process: the ESM
module cache is not invalidatable, so same-process re-import would silently return
stale config on every dev reload — and the recorded import list is what lets the
watcher cover helper files (`./config/shared.ts`), not just the root file. It also
isolates `.env` mutation and config crashes/hangs from the main process. The
watcher consumes a **filtered** import list, plus everything else a reload depends
on that is not an import. Imports alone are not the input set: the topology is
derived from the filesystem, so the watcher also covers the **enumerable env-file
set** (every `.env*` file for the active mode in each directory contributing a rung,
from the config file's own directory through to the env root — env files are read,
not imported, and editing one changes both evaluation and worker env); each
**`autoload` directory's membership**, since creating or removing an application
directory changes the application list; the **recognized config-file candidates** in
every application directory, since adding or deleting `watt.config.ts` changes which
applications own a file — and, after the scoping rule, what `wattpm dev` does there;
each application's **`package.json`**, which supplies the id and the dependencies the
capability detector reads; the config file of **every application actually in the
topology**, including one whose `path` resolves outside the project; and the
**recognized candidate paths across the whole ancestor horizon**, which is further up
than the env root.

That last one is not an application's config and is never imported, which is exactly
why it was missing: it is watched because the ancestor scan *selects the env root*
(see "Scope"), so creating `../watt.config.ts` moves the env root outward and makes
`../.env` live, and deleting the outermost one moves it back. Neither path is in the
active env-file set beforehand — that set is the consequence, not the input — so
nothing else in this list would notice.

**The horizon is the scan's reach, not its current answer**, and the difference is the
whole point. The env root is the *outermost* `watt.config.*` found, so watching only
as far as it cannot see a configuration appearing **above** it — which is the example
this paragraph is about. If `/repo/app/watt.config.ts` is currently the outermost,
creating `/repo/watt.config.ts` moves the root outward, and a set bounded by the old
answer contains neither the new file nor the `.env` beside it. So the watched
candidate names run the full distance the scan would walk, up to the same stop the
scan uses (see "Scope", where the residual above a package boundary is stated).
Because the trigger is a file **appearing**,
those candidates are watched at paths that do not exist yet, which is the same
creation-and-deletion rule the rest of the set follows, applied one directory at a
time up the walk. When one fires, the env root, the env-file set and the watch set
are recomputed **together** before the reload evaluates anything: a reload that used
the new env root with the old file set would be a third state neither boot produces.

**The two explicitly-named env files are in the set as well**, and they are the ones
easiest to leave out of it, because neither is discovered by enumerating a directory:
an entry's **`envfile`**, which replaces that application's whole four-file set in
both views, and the invocation-wide **`--env <file>`**, which replaces the env-files
rung entirely. Editing either changes what the configuration evaluates to and what
the worker runs under, so leaving them unwatched makes `wattpm dev` serve a stale
answer to a file the user just saved. Every path in the set is watched for
**creation and deletion**, not only modification — appearing and disappearing is how
an env file, a config candidate and an autoload directory each change the answer.

**A config file that reads data without importing it is invisible to all of this**,
and no hook can fix that: `readFile('./ports.json')` is an ordinary call, indistinct
from any other I/O. The context carries **`ctx.addWatchFile(path)`** for it, streamed
back on the same channel as the recorded imports (see step 3), so a configuration
that reads its own data can say so in one line. A relative path resolves against
**`ctx.root`** — the config file's own directory, the only stable referent, since a
helper that calls it may live anywhere and `process.cwd()` is wherever the command
was typed — and the path is canonicalized before it reaches the watcher. Nothing
enforces the call: a config that reads a file and does not declare it needs a restart
to pick up a change, which is stated here rather than discovered.

**The one filter is `node_modules`, and it is not a project boundary.** Watt itself,
capability packages and their transitive dependencies are recorded and never watched,
so dependency churn cannot trigger reloads or exhaust watcher limits. Everything else
is watched **wherever it lives**, including outside the runtime root: an application
at `path: '../shared/api'` is a supported layout, its config file is in the set, and
an entry's `envfile`, the `--env` file and an `addWatchFile` path are all explicitly
named by a configuration and are trusted wherever they resolve — the same rule paths
follow everywhere else in this document (see "Scope"). A project-local filter would
drop exactly the external application config the previous paragraph promises to
watch, which is the kind of bound that reads as tidy and behaves as a bug.

The costs are real and accepted: one worker spawn per config file (parallel) + type
stripping per load
(order tens of milliseconds), paid at boot and on each dev reload — and CLI
dispatch must be careful not to evaluate config eagerly when only metadata is
needed. `--debug-config` prints the fully resolved configuration — including
whatever the environment supplied, so treat its output like the environment itself
— using the **same eval-worker pipeline as a real boot** — per-file isolation included, because in a
single shared process the first import would fix a shared helper's module-scope
env values for every later file, and the diagnostic would print cross-app
contaminated values that a real boot never uses. Breakpoint debugging gets an
explicit escape hatch, since a throwaway thread dies before an inspector can
attach: with `--inspect-brk`, evaluation runs **in-process** and is therefore
restricted to **one config file** — the deciding file by default, or one app's
file by path — precisely because one process has one module cache, in which only
a single file's env view can be correct. The other files still evaluate in their
workers (the printed output is the full resolved configuration either way) and
**cannot be contaminated by the in-process target regardless of ordering**: the
main process constructs each worker with an explicit `env`, and workers never
inherit `process.env` — which is what keeps the printed configuration equal to a
real boot's. The evaluation
deadline is disabled for the in-process target — a paused breakpoint session must
not be killed by the 30 s timer.

**Object config sources skip the *root* eval worker.** The programmatic API
(`create(root, configObject)`) and the zero-config in-memory synthesis pass an
object, not a file: for those, the root pipeline runs main-side with no import
step, and `loadEnv` builds the env map without mutating the main process's
`process.env`. The **`root` argument stands in for the deciding file's directory** —
there is no config file to take a `dirname` of
(v3 required it for the same reason, `foundation/lib/configuration.js:495,507-509`).

Where the walk *floors* differs between the two object sources, because they arrive
differently. For the **programmatic API** the caller declared its root, so that root
is authoritative and the walk floors there: an embedder saying `create('/app', …)`
does not mean "and also whatever `.env` sits above `/app`". **Zero-config synthesis**
is the opposite — nobody declared anything, the user ran `wattpm` in a directory —
so it resolves its env root the same way a config file would, by the filename-only
ancestor scan (see "Scope"), and floors at its own directory only when that finds
nothing. Without that, running in `web/api` of a monorepo would synthesize an
application that cannot see the root `.env` the Scope section promises it, which is
now a reachable case: an ancestor configuration no longer prevents synthesis, it only
warns.
**A function-valued `application.config` / `applications[].config` is an error
here**, naming the entry and saying to call it and pass the result. The callback form
exists to give a *config file* typed autocomplete and asynchronous option
construction; an embedder is already writing JavaScript and can call the function
itself, so nothing is lost. What rejecting it avoids is a second, weaker evaluation
contract: a callback run main-side would receive a resolved `ctx.env` while
`process.env` around it stayed the caller's — disagreeing inside a single callback,
which never happens in a worker — and would skip the mutation diff-and-warn, the
evaluation deadline and the module-cache isolation, all of which are properties of
running in a worker. The two paths that actually pass objects, zero-config synthesis
and the documented ICC pattern, both emit plain data.
Everything else downstream is unchanged: a programmatic root listing
`applications[].path` directories still gets per-app discovery, per-app eval
workers and the detector exactly as a file-sourced boot would — which is what keeps
the ICC and embedder paths equivalent to a normal one.

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

Per-app config files evaluate with **their application's layered environment** — the
app's own env files (or its `envfile`) layered over the rest of the chain up to the
env root, per
the config-evaluation
ladder in "Env files". `envfile` governs **both** views; the `env` blocks govern the
worker-runtime view only.

**Serializability is the v4.0 contract, and it is enforced by canonicalization,
not only by a check.** The evaluated export is walked once and a **canonical
plain-data snapshot** is constructed from it **before anything reads its shape**;
that single snapshot is what gets classified, expanded, validated, and
`postMessage`d. Nothing downstream ever touches the original object again — which is
a statement about ordering, and is why the root worker canonicalizes immediately
after unwrapping rather than after expansion (see "Loading mechanism", step 1).

Building it rather than merely inspecting it is what makes the contract true.
`structuredClone` is not `JSON.stringify`: it **preserves** own properties whose
value is `undefined`, so "omitted" has to be something the loader *does*. And a
walk that only inspects is a time-of-check/time-of-use gap — a getter or a Proxy
can return one shape to the check and another to the clone, so the validated
structure and the transported structure need not be the same object graph.
Accordingly:

- **accessor properties and Proxies are rejected** wherever they appear, naming the
  JSON path. Config is data; a property that computes on read cannot be
  transported, and permitting it would make the snapshot unreproducible;
- object properties whose value is `undefined` are **omitted from the snapshot**
  (JSON.stringify semantics) — so `cache: { url: process.env.REDIS_URL }` with the
  variable unset yields `cache: {}` and the schema's defaults/required rules speak,
  rather than an error or a silent `undefined` crossing the boundary;
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
  style (a file per application, plus a thin autoload root), so
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

Runtime resolution of capability *implementations* — workers loading the capability
from the app's deps, with the runtime-bundled fallback — **changes order to match**
(BC 26). v3 tried a bare `import(pkg)` first and reached the application directory
only as a fallback (`basic/lib/modules.js:24-36` pre-`b7d953770`); v4 asks the
application first and keeps the bundled copy as the fallback, so all three
resolutions — implementation
import, schema import, version stamp — name the same copy by construction rather
than by coincidence of layout.

Nothing that resolved in v3 stops resolving: an application with no local dependency
still reaches the bundled copy, and under pnpm's strict layout the two orders already
agree in effect, since `basic` depends on no capability and its bare import always
throws. The answer moves in one layout — a hoisted tree where an application carries
a nested copy of a capability the root also has — and there v4 gives the application
the copy it declared. The per-layout tests the version stamp already requires (npm
hoisted, pnpm strict, root-only) cover it.

### Env files

**Recognized files** (Vite parity), in both the root and each application
directory:

``` output
.env  .env.local  .env.<mode>  .env.<mode>.local
```

Within one directory, mode-specific beats generic and `.local` beats committed:
`.env.<mode>.local > .env.<mode> > .env.local > .env`. `mode` comes from the config
context (`--mode`); scaffolding adds `.env*.local` to `.gitignore`.

**Precedence is app-wins layering — more specific overrides less specific, real
environment always wins.** There are two views, and they differ by exactly the
things that only exist once the runtime is running:

``` output
config evaluation:  real environment  >  env files, own directory first,
                                         layered up to the env root
                                      >  NODE_ENV default

worker runtime:     real environment  >  entry env block  >  root env block
                                      >  injected PLT_<ID>_URL
                                      >  env files, own directory first,
                                         layered up to the env root
                                      >  NODE_ENV default
```

**An `env` block configures the running application; it does not configure the
reading of configuration.** Blocks are absent from the config-evaluation view
entirely — for every config file, at every position, with no exceptions.

The reason is that configuration is now code, and an `env` block is configuration.
At the root the two are genuinely circular: the root file's own block — and any
block that would feed an application configured *inside* that file — is knowable
only once the file has been executed, so it cannot inform the environment the file
executes in. v3 had no such circularity because its configuration was JSON and
`{PLT_X}` substitution was a text pass over an already-parsed object, so "before"
and "after" never arose.

A separate per-app file is *not* circular — the root runs first, so its blocks are
known by then. Making visibility depend on where a file sits is nevertheless the
alternative worth refusing: it gives one key different values in the eager and
deferred forms of the same entry, and it obliges the loader to ship key-by-key
provenance into workers so that a ladder can be applied on the far side of a
boundary that has already flattened it. A single rule holding at every position
costs one narrow fidelity break and buys a model with no positional exceptions: the
main process resolves the config-time environment **before any worker starts**, from
the real environment and files on disk, and that one resolution serves every config
file regardless of where it sits or which boot style found it.

What this costs is a v3 fidelity break, in one narrow case: a v3 placeholder whose
value came from an **`env` block** resolved at parse time under v3 and does not under
v4. It is `env` blocks only, not `envfile` — a per-app `envfile` governs *both* views
in v4 (see the ladder above), so its values still resolve during evaluation, and the
two positions where it could not be carried faithfully are refused by migrate rather
than converted. Migrate detects exactly that case and reports it rather than
emitting a `process.env.X ?? ''` that would silently evaluate to `''` (see
"Migrating from v3"). A migrated `{ "connectionString": "{DATABASE_URL}" }` whose
variable comes from the real environment or an env file — the ordinary case — still
becomes a plain `process.env.DATABASE_URL ?? ''` and still resolves, instead of
having its value baked into source.

The bottom rung is `NODE_ENV`, and it belongs to **both** views: when `production`
is `true` and nothing above it supplied a **non-empty** value, it defaults to
`'production'` — in eval workers as well as application workers, so a config file
branching on `NODE_ENV` sees under `build` and `start` what its application will see.
It is the one injection a build is allowed to make.

**Non-empty, not merely absent, because that is what v3 tested.** v3's rule is
`if (appConfig.isProduction && !process.env.NODE_ENV)`
(`worker/controller.js:125-126`, applied after all seeding), a truthiness test — so
`NODE_ENV=` in an env file became `production` there, and would stay empty under a
ladder that only asks whether some rung supplied the key. This is the **one** place
where the ladder treats an empty string as missing, and it is deliberately not
generalized: everywhere else `''` is a value somebody wrote, which is exactly why the
`requiredEnv` guard exists. Matching v3 wins here because the alternative is a
production build running with `NODE_ENV=''`, which every bundler in the ecosystem
reads as "not production" — a silent switch from optimized to development output,
found in production.

This preserves v3's observable behavior (an application's `.env` overrides
root-file defaults but never genuine environment variables), and it is resolved
**declaratively**: for each key, walk the ladder from the top and take the first
source that defines it. There are no sequential apply-and-overwrite passes, so the
ordering bugs they invite — an app env file clobbering a value an `env` block just
set — are unrepresentable. v3's `kEnvFileFallbackKeys` bookkeeping is unnecessary
under this model: provenance is simply which source won.

**Env *files* are determined by directories, never by boot style. One rule covers
every config file, wherever it sits:**

> A config file's **chain** is every directory's env files from its **own
> directory** up to and including the directory of the **outermost `watt.config.*`
> above it** — nearest winning — or its own directory alone when there is none.
>
> An application's environment is **its own chain, layered over the chain of the
> file that decided the boot.**

For an application inside the project the two chains coincide and the second clause
does nothing. It earns its place in two cases the first clause alone cannot express.

**An application outside the runtime's directory still inherits it.** `path: '../shared/api'`
is an ordinary layout — 39 in-tree configurations use parent-relative paths — and
the runtime's directory is not an ancestor of it, so its own chain reaches nothing of
the project's. v3 had no such gap: it seeded **every** worker from one `loadEnv` at
the runtime root (`runtime/lib/runtime.js:245` pre-`19d8fb98b` → `:2570` → `:2622`)
whatever the
application's location. The deciding file's chain is that same base, so
`shared/api/.env` layers over `proj/.env` exactly as v3 layered the app's own file
over the runtime's.

**Every chain terminates.** "Outermost `watt.config.*`" names nothing when there is
no config file at all — which is precisely the Level 0 case, and also the
programmatic `create(root, configObject)` and a hot-added absolute path. The
own-directory floor gives those a terminator, and the deciding file's chain is always
defined because a boot always has one (for object sources, the `root` argument).
Without both, the walk in v3's most common shape would have run to the filesystem
root, which v4 does not do.

**The Watt project's own configuration delimits the search, not `package.json`.**
The config search stops at your `package.json` because it *executes* what it finds,
and a config file above your package belongs to something else. Env files are data,
not code, so that reasoning does not transfer — and the thing that actually says how
far a Watt project extends is its outermost Watt configuration. Locating it is the
**same ancestor filename check** the standalone warning already performs (see
"Scope"): no evaluation, no new machinery.

That makes the rule **boot-style independent because of what it measures**, not by
assertion. `web/frontend/watt.config.ts` gets the same environment whether the
runtime started it or you ran `wattpm dev` in its directory, because the env root is
a property of the project's shape rather than of where the command was typed:

``` output
proj/watt.config.ts   proj/.env          ← env root: the outermost watt.config.*
proj/web/             proj/web/.env
proj/web/api/         proj/web/api/.env  ← an application, in the tree
shared/worker/        shared/worker/.env ← an application, path: '../shared/worker'

api     either boot style →  web/api/.env  >  web/.env  >  proj/.env
worker  root boot         →  shared/worker/.env  >  proj/.env
```

`api`'s own chain already reaches `proj/.env`, so the deciding file's chain adds
nothing. `worker`'s own chain is `shared/worker/.env` alone — its env root is itself,
there being no `watt.config.*` above `shared/` — and the deciding file's chain
supplies `proj/.env` under it.

**Intermediate directories layer** — `web/.env` participates because it is between
the two ends, nearest winning. This differs from v3, which read exactly one found
file plus the app's own, and the layering is the deliberate change: a `.env` does
what its placement suggests, and no file can shadow the ones above it. (The earlier
"intermediates are never consulted" rule only made sense while a project-root concept
existed to skip to.)

**A nested runtime inherits the chain above it, and there is no marker to opt out.**
`proj/tools/sandbox/watt.config.ts` reads `proj/.env`, and so does every fixture
runtime in a repository that later grows a root `.env`. A declared boundary was
considered and rejected as unimplementable at this layer: env files are resolved at
step 2 of the walk and the deciding file is executed at step 3, so a marker *inside*
the configuration cannot be read before the walk it governs has already finished —
and evaluating twice would mean the first evaluation ran under the environment the
marker was meant to change. Where a nested runtime genuinely needs a different
environment, `--env <file>` replaces the whole env-files rung for that invocation, and
its own `.env` still wins over anything above it. In a genuinely standalone
single-app repository the outermost `watt.config.*` **is**
the app's own, so the search terminates there anyway and only its own directory
contributes — correct, because nothing above it belongs to the project. The one
residual is a stray `watt.config.*` in an ancestor that is not really a parent of
this project — a `$HOME` config, say — which would make `$HOME` the env root; this is
the same best-effort caveat the search states for `$HOME`, not a second one.

Two things *do* depend on boot style, and both live on the **root entry**, which a
standalone boot does not read: the `env` **blocks**, and an entry's **`envfile`**.
An application whose entry declares `envfile: './deploy.env'` evaluates against that
file under a root boot and against its own directory's chain when started
standalone — the one case where the same file gets two environments, and the reason
the sentence above says *boot-style independent* of the directory rule rather than of
everything. That asymmetry is stated again below and
in the standalone warning, and it is **one of the three ways** a standalone build
differs from a root build. The second is the absent sibling `PLT_<ID>_URL`
variables (see "Build environments"). The third is **topology-key stripping**, which
varies by *position and boot style together*: a per-app eval worker has the declared
`PLT_<ID>_URL` names removed, while the root eval worker cannot have them removed —
its ids are not known yet — and warns after unwrapping instead. Under a **standalone**
boot an application's own file *is* the deciding file and therefore runs in the root
worker, so the same file is stripped under a root boot and unstripped standalone.

**Not stripping at all was the alternative, and it is worse.** Leaving the names in
place would make evaluation identical across boot styles, which is the property this
divergence costs — but it would do it by letting a per-app file read a stale
`PLT_API_URL` out of an env file and bake that value **into `resolvedConfig`**, where
runtime injection can no longer reach it: injection outranks env files in the
*environment*, and this value has left the environment and become capability
configuration. A boot-style difference is visible in a warning; a stale sibling URL
compiled into a cache endpoint or a build artefact is visible when something calls
the wrong host. So the divergence is kept and named rather than traded for a silent
one. It is also not fixable by knowing more: standalone has no siblings to inject,
so there is no correct value to strip *toward* — the question the root boot answers
does not exist there.

Stripping removes only names the runtime would **inject**. A key already present in
the runtime's own real environment is one injection skips (see "Inter-application
URLs"), so the worker genuinely uses the inherited value — a nested runtime passing
`PLT_API_URL` through is the case this document calls legitimate, and stripping it
during evaluation would make the two views disagree on a live key. The strip is
therefore scoped to keys the runtime is going to supply itself. File
**position** also
changes the env view: the same factory expression evaluates against the root
config's directory chain when it lives root-inline and the application's chain when
it lives in the per-app file — both directory-determined, with no pretense
otherwise. (Root-inline and per-app positions share the deciding file's chain as
their base; only the *own* chain differs, and for an application outside the
runtime's directory that own chain may have a different env root entirely.) That asymmetry is one more reason the per-app file is the canonical
home for capability configuration.

**Per-app config files evaluate with their app's environment — each in its own
worker.** Every per-app file gets a dedicated eval worker whose `process.env` is
that app's layered view (its own directory's files over the nearest files above),
with its own isolated
ESM cache — so the colocated `web/frontend/watt.config.ts` reads
`web/frontend/.env`'s `REDIS_URL`, exactly as a frontend developer expects, and a
shared helper computing values at module scope re-evaluates per worker under the
right environment (per-worker cache isolation is what makes cross-app
contamination impossible).

The per-application `env` config property configures the worker's runtime
environment **only** — never config evaluation, at any position (see the two views
above). `envfile` is an opt-out of the convention
and governs **both views**: when an entry declares it, none of the four
mode-aware app files are read for that application — exactly the named file
loads, in the app's eval worker *and* at worker boot alike, occupying the same
application's **own-directory** layer of the env-files rung — the directories above
it are unaffected and still contribute (v3's replace-the-default-path behavior,
extended to the set — and extended to evaluation, so the two views keep agreeing on
that layer). Mode
selection simply does not apply to that app's files; every other rung is
unaffected. The path resolves **app-relative** (v3 resolved it against
the runtime root — migrate rewrites paths so they keep pointing at the same
file), and a missing explicitly-named envfile is a **configuration-load error** — it is the
main process that resolves it, before any worker starts, so it surfaces under
`--debug-config` and `command: 'exec'` too, neither of which boots anything (v3
silently ignored it — defensible only for the implicit default `.env`). Declaring `envfile`
on an entry whose **configuration is evaluated somewhere the file cannot reach** is
an **error**. Two entry shapes are in that position. The first carries an **inline
`config`**: no file is read for it, so the
`envfile` would govern the worker-runtime view alone, and a key that silently covers
one view and not the other is the ambiguity this document spends its length removing.
That one is a deliberate simplification rather than an impossibility — v3 did exactly
that (`worker/main.js:236-237`), and root-inline entries already tolerate a comparable
asymmetry.

The second is the entry whose directory **is the deciding file's own directory** —
`defineConfig({ application: { workers: 2, envfile: 'deploy.env' } })` in a bare
repository, where discovery skips the candidate that produced the configuration and
falls through to the detector (see "Loading mechanism", step 2). That one is not a
simplification but an ordering impossibility: the root worker's environment is
resolved by the main process from the deciding file's own directory chain **before**
that file is evaluated, and the entry's `envfile` does not exist until after. Applying
it would mean reading the configuration in order to build the environment that
produces the configuration. Both are refused for their own reason, which is the point
of naming them separately — the first could be lifted by a later version, the second
cannot.

**A third shape has no eval worker either and is *not* refused**, because the reason
does not reach it: an entry with a `path`, no inline `config` and no per-app file at
all, whose capability comes from the detector (see "Loading mechanism"). Nothing is
evaluated for it — there is no configuration file to evaluate — so there is no
evaluation view for the `envfile` to be absent from, and the "governs both views"
promise is satisfied by there being one view. The file loads into the worker
environment at boot, where the capability's own `transform` and the application code
read it, which is everything this entry has. Adding a `watt.config.ts` to that
directory later gives the entry an eval worker and the same `envfile` starts
governing evaluation too — the correct reach in both states, reached without the
declaration changing. The missing-file check is unconditional and applies here as
everywhere: the main process resolves the path before any worker starts, so naming a
file that does not exist is a load error regardless of what evaluates. The cost is real and bounded — a v3 wrapped single-app project with an
`envfile` migrates to a root-inline entry, so it lands on the pre-flight
hand-conversion list — and it is listed there for that reason. One documented asymmetry: `envfile` and the `env` blocks live on the root
entry, so a **standalone** boot — which applies no root orchestration — evaluates
and runs under the conventional file set with no blocks applied; the standalone
warning's list of omitted root settings names both, and the build section states
the consequence for artifacts. The
`--env <file>` flag replaces the **entire env-files rung** for the invocation, in
both views and mode-exempt: no directory in any chain contributes, and the named file
is the only file source. That matches v3, where `customEnvFile` bypassed the search
outright (`foundation/lib/configuration.js:349-357`), and it is what makes the flag an
escape hatch rather than the weakest layer — defining it as "the root rung" would
leave it overridden by any application's own `.env`. `{PLT_X}`
interpolation,
`strictEnv`, root `envfile`, and the YAML brace-quoting pre-pass do not exist in
v4; they survive only inside `wattpm-utils migrate`'s legacy reader.

### Inter-application URLs

v3's behavior here was subtler than commonly understood: when a *worker* parsed its
app's config, any unset placeholder whose key **ends in `_URL`** resolved to the URL
of **the app being parsed**, whatever the rest of the key said — `fetchApplicationUrl`
gates on the suffix and then ignores the key, returning the current app's
`.plt.local` URL (`runtime/lib/worker/controller.js:32-38`); in the *root* config,
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
  precedence ladder — the **worker-runtime view** of the two in "Env files" — is
  explicit:

  ```
  real environment  >  entry env block  >  root env block  >  injected
                    >  env files, own directory first, layered up to the env root
                    >  NODE_ENV default
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
  URLs sit **above all env files**, including the app's own — a rung of the ladder
  the main process resolves, so stale `PLT_*_URL` lines in any `.env` are harmless
  **in the worker environment**. Injection is a runtime act and has no rung in the
  config-evaluation ladder, so the loader **strips the exact topology keys from
  every per-app eval worker's environment** — precisely the `PLT_<ID>_URL` names
  derived from the declared application ids, computed from the same normalization
  injection uses, and nothing else. A config file reading one during evaluation
  would otherwise bake a stale value that the worker never uses. The match is by
  exact key, not by prefix and suffix: an unrelated `PLT_STRIPE_URL` is an
  ordinary environment variable and survives, in evaluation and at runtime alike,
  as does anything migrate emitted for it. Config authors write the literal
  virtual hostname instead, as above.

  The **root** eval worker cannot be covered by the same mechanism: the ids that
  generate those names are declared by the very file being evaluated, and by
  `autoload` expansion that completes only after it returns, so the key set is
  unknown when its environment is fixed. It gets a **post-unwrap check** instead —
  once the ids are known, any `PLT_<ID>_URL` matching one of them that was present
  in the root worker's environment is reported, naming the key and the application
  it collides with, since a value visible there is necessarily inherited from the
  surrounding environment rather than injected by this runtime. It is a warning
  rather than an error because presence is not use: a nested runtime legitimately
  passes such variables through, and only a config file that actually reads one
  bakes a stale value. `--debug-config` marks those keys as inherited rather than
  printing them as though a real boot had supplied them.) The
  runtime skips injection when the key exists in its **own real environment**
  (container/k8s overrides work — the runtime's
  `process.env` *is* the oracle); the explicit `env` block
  beats injection and is the sanctioned way to hand workers a value — though,
  dotenv-style, the real environment outranks even it. Injection covers **every
  application, including the app's own `PLT_<SELF>_URL`** (v3's placeholder
  machinery effectively guaranteed a self URL, and generator-emitted code reads
  it). v3's injected `PLT_DEV`, `PLT_ENVIRONMENT` and `PLT_ROOT` are **removed** —
  apps branch on their own variables, or the decision moves into config where the
  typed context lives; migrate's source scan flags every occurrence.

  **`PLT_ROOT` carries two different values in v3, and removing it breaks both.** The
  loader assigns it per config parse — `env.PLT_ROOT = root` after `loadEnv`
  (`foundation/lib/configuration.js:512`) — so inside a configuration `{PLT_ROOT}`
  resolves to *that config file's own directory*, which is why migrate can seed it
  when resolving structural paths instead of reading it from the environment. But the
  runtime's own parse also puts it in `#env`, which is `structuredClone`d into every
  worker (`runtime/lib/runtime.js:2570` pre-`19d8fb98b`, `:2622`), so **application code reading
  `process.env.PLT_ROOT` gets the runtime root** — a different directory from the one
  the same name means in a per-app config, and a value
  `packages/runtime/test/start/custom-environment.test.js:21-30` pre-`5f611ed65`
  asserts application code receives. Removing it is therefore a **worker-environment breaking change**,
  not merely the retirement of an interpolation helper. It was already excluded from
  every generated `.env` (`generators/lib/base-generator.js:241`), so no scaffolded
  project declares it, but any application reading it does lose it. The v4 answer for
  application code is `import.meta.dirname`, which is **not** an equivalent: it is the
  reading module's directory, where `PLT_ROOT` was the runtime root. Migrate's source
  scan reports every read with its file and line for exactly that reason. `NODE_ENV` is the one variable the
  runtime still defaults, at the bottom of the ladder (see "Env files").
  Topology variables are
  deliberately not `.env`-configurable. Two application ids normalizing to the same
  variable name is a **boot-time config error** naming both. The label grammar above
  removes most of the ways that could happen — `api_v2` is not a legal id at all — so
  what remains is a case difference: `api-v2` and `API-v2` both normalize to
  `PLT_API_V2_URL`, and, DNS labels being case-insensitive, they are the same mesh
  hostname too. The check stays because it catches both collisions at once.

### Validation, types, and the schema audit

- **AJV stays authoritative**, but the v4 schemas are **audited, not just pruned**.
  Beyond removing `$schema`, root `module`, `runtime` (wrapped block), `web`,
  `services` and `verticalScaler`, every `anyOf`/`oneOf`
  union across foundation and the capability schemas (~120 sites) is classified:
  - *placeholder-only unions* (the 13 `overridableValue` call sites,
    `logger.level`'s
    `^\{.+\}$` pattern branch, the string forms of `workers` and `watch`,
    `managementApi`'s top-level string — the socket path is the *object* property
    `managementApi.socket`, and a bare string is merely truthy
    (`runtime/lib/management-api.js:425`); the branch exists only to admit
    `'{PLT_MANAGEMENT_API}'` — …) — **string branch deleted**;
  - *genuine unions* (`preload`'s string-or-array, `extensions`'
    string-or-object-or-array, `enabled`'s per-environment object) — kept;
  - judgment calls — decided and recorded in the schema.

  `enabled`'s object form is **keyed by `mode`**, not by a separate binary
  environment. `production`/`development` remain the default mode names under
  `start`/`build` and `dev`, so every existing config keeps its meaning, and
  `enabled: { staging: false }` now does what it looks like under
  `--mode staging` — where v3 silently ignored the key
  (`runtime/lib/config.js:371-387`). `enabled` is resolved in the root eval worker against
  `ctx.mode`, before fan-out (see "Loading mechanism").

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

```js config
// generated by pack / install / deployment tooling — no imports required
export default {
  $schema: 'https://schemas.platformatic.dev/wattpm/4.0.0.json',
  applications: [{ id: 'api', path: '.', config: { module: '@platformatic/node' } }]
}
```

- The stamped `$schema` **property** is mandatory for machine writers of
**plain-object** configurations. The loader
  reads it for version detection only (never module selection) and **strips it
  before AJV validation** — the v4 root schema does not admit it, and without the
  strip every machine-generated config would fail validation. A stale v3 URL
  refuses with the migrate hint. This is what keeps the next major's migration
  tractable **for that class of file**.
  **Files that import their dependencies need no marker; files that do not, do.**
  That is the whole of the rule, and it is why the requirement lands where it does.

  A `watt.config.ts` naming `defineConfig` from `wattpm` and `next` from
  `@platformatic/next` **is read by the major that is installed**: whichever `wattpm`
  is installed supplies `defineConfig`, so a v5 loader reading a v4-shaped file fails
  v5's own validation with an actionable error, exactly as v4 refuses a v3 JSON file.
  What the imports establish is the *installed* major, not the authored one, and the
  guarantee that makes that enough is a constraint on v5 rather than a property of the
  file: **a shape v4 accepted must not come to mean something else in v5.** It either
  still means what it meant, or v5 refuses it. A major that quietly reassigned meaning
  to a valid v4 configuration would defeat any marker the loader could not require,
  and v5 is the only party in a position to honor that. `migrate`, `wattpm import` and
  scaffolding all emit that shape, and `WattConfig` declares no `$schema` — writing
  one would be a type error.

  A plain object emitted as `'export default ' + JSON.stringify(config)` imports
  nothing. It is data in a `.js` wrapper, with no resolved package behind it and no
  capability call to carry a stamp, so it needs `$schema` for the same reason v3's
  JSON did.

  That requirement binds **writers**, and the loader cannot police it: an evaluated
  export looks the same whether the object came from imports or from a string, so
  there is no runtime test that distinguishes "machine-generated plain object missing
  its marker" from "config that legitimately needs none". A hand-written markerless
  plain object is therefore possible, and v5 would have to identify it by its content.
  This is stated rather than closed, and the reason is narrower than "the
  alternatives are inconvenient". **Only a literal in the file can name the major it
  was authored against.** A stamp applied by `defineConfig` or by a capability factory
  is applied by *installed* code — under a v5 install it is v5's `defineConfig`
  running, so a file authored for v4 would be stamped 5. That is the same fact the
  imports already carry, which packages are installed now, rewritten into the object
  as a claim about the past; a marker that is wrong in exactly the case it exists for
  is worse than none. Serializability is not the objection — a version string is plain
  data and would clone fine. What is left is requiring a literal in every file, which
  puts a stale-marker failure mode into files that identify themselves adequately
  already, to close a case every emitter in this repository already stamps. The shape
  exists because machines emit it, every emitter is in this repository, and that is
  where the rule is enforced (see the CI gate in the plan).

  **The `ApplicationDefinition.version` stamp is not this mechanism** and should not
  be read as it: it exists for the root/app skew check (see "Capability factories"),
  it is absent from hand-written `{ module }` objects by design, and a root whose
  applications are all remote or all autoload-detected carries no factory result at
  all. It identifies which copy of a capability produced an entry — not what shape
  the file is.
- Writers converted in v4: `next pack` (bundle config; gains a test asserting the
  bundle boots), the `wattpm install`/external flow (per-app files in cloned repos),
  **`ImportGenerator`** — which wrote a `watt.json` carrying either a `$schema` URL
  or a bare `{ module }` for an imported application whose capability ships no
  generator (`generators/lib/import-generator.js:126-150` pre-`dd89c334f`, reached from
  `create-wattpm/lib/index.js:465`), and was the one JSON writer easy to miss
  because it is not a generator itself; it emits the v4 per-app form now —
  `wattpm-utils migrate` output, and the documented pattern for ICC-style platforms
  (`'export default ' + JSON.stringify(config)`) — the last of which is the
  plain-object case the `$schema` rule governs. A machine writer emitting **`.js`
  into a `"type": "commonjs"` package must write `.mjs` or `.mts` instead**: `.js` is
  CJS there (see "One dialect"), and `export default` is a syntax error in it. This is
  the same rule scaffolding follows when it picks a suffix, and it is stated here
  because a generator choosing `watt.config.js` unconditionally is the natural
  mistake.

  **Converting the writers of the *plain-object* form is gated on the `4.0.0` version
  bump**, which is a sequencing constraint rather than a preference. Such a writer stamps
  the version it generated against; on a `3.x` tree that URL has a major of 3, and the
  loader refuses a stale v3 stamp with the migrate hint — correctly, since that is the
  whole point of reading it. So a converted `next pack` on a `3.x` tree emits a bundle
  that cannot load. The alternative, emitting the plain-object form with no stamp, gives
  up the one signal the next major's migration reads. Those writers can be *ready* before
  the bump; they cannot be *shipped* before it.

  **Scaffolding's root is the exception, and it takes exactly that cost.** The wizard
  writes the root before anything is installed and reads it back on a later run — adding
  an application to an existing project is that run — so a root importing `defineConfig`
  from `wattpm` cannot be read in the state that produced it, and a stamped one is
  refused on a `3.x` tree for the reason above. Unstamped plain object is the only form
  that both survives the gate and can be read pre-install, so that is what scaffolding
  emits until the bump, when the stamp becomes both writable and worth writing. It is
  listed here because the cost is real: a project scaffolded before 4.0.0 carries no
  version marker for the next major's migration to read.

  **`migrate` is not in that set**, and the difference is the point of the marker rule
  rather than an exemption: what it emits imports what it uses — a factory call, or
  `defineConfig` — so the file identifies itself and carries no stamp to go stale. The
  same holds for any writer that emits the importing form.
- **`getApplicationConfig()` is a different API with a different view, and it
  survives unchanged.** `runtime.getApplicationConfig(id)` is not part of the payload
  below: it asks a *running worker* for `capability.getConfig()` over ITC
  (`runtime/lib/runtime.js:2331-2335` through `runtime/lib/worker/itc.js:300-304`), so
  what comes back is the configuration **after the capability's `transform`** — what
  that worker is actually running, its `configPatch` applied and its
  `perWorkerIncrement` offset resolved. `resolvedConfig` in the payload below is the
  view *before* the transform. Both survive v4 and neither subsumes the other: one
  answers "what was configured", the other "what is this worker running". Three
  consequences. It still needs a started worker, and still cannot be answered from the
  main process, because the transform runs where the worker is — the runtime's own
  `SO_REUSEPORT` clamp uses this exact call to learn a worker's real `server` block
  (`runtime/lib/runtime.js:3754`), which is the same reason. It is already a copy —
  ITC structured-clones on the way back and the handler JSON round-trips to drop
  `undefined` keys — so the mutability question the payload below raises does not
  arise here. And its HTTP surface, `GET /applications/:id/config`
  (`runtime/lib/management-api.js:202-206`), is **not** the removed `GET /config`; it
  stays. Of its two in-tree callers one is `patch-config`, removed for unrelated
  reasons (BC 9).
- Reading configs without executing them: the plain-object form is trivially
  AST-parseable, and running systems expose the resolved config via the programmatic
  `runtime.getRuntimeConfig()`. The management API's HTTP `GET /config` endpoint is
  **removed** in v4 (its only known consumer, watt-admin, migrates off it —
  cross-repo coordination noted in the plan).
- **The programmatic payloads are a versioned public DTO, and they change shape.**
  Consumers observing `getRuntimeConfig().applications[].config` — or
  `getApplicationDetails()`, a flat object which now names that path by dialect,
  `config` for a v3 application and `configPath` for a v4 one
  (`runtime/lib/runtime.js:2278-2294`) — received a *file path* in v3; in
  v4 each entry carries
  **both** `configPath` (the per-app file path, or absent for inline definitions)
  and `resolvedConfig` (the validated raw capability payload), plus `module` and
  `definitionVersion` — the loader-metadata envelope split off the definition (see
  "Capability factories"). **Not `version`**: `getApplicationDetails().version`
  already means the version of the capability the *running worker* loaded, answered
  over ITC by `getApplicationInfo` (`runtime/lib/runtime.js:2282`). The two are
  different facts, and under the minor skew this document permits they hold different
  values — which is the exact condition the stamp exists to surface, so a shared name
  would hide it precisely when it matters. `details.version` keeps its meaning
  untouched. Payload compatibility and patch-
  document compatibility are **separate contracts**: patch documents stay
  byte-compatible (below), while the payload change is a declared breaking change
  coordinated with every consumer (watt-extra reads `applications[].type`, which is
  unchanged).

  **Both payloads are independently built and deeply frozen**, which they did not
  have to be in v3. What a consumer could observe there was scalars and a file path,
  so handing out interior state was harmless in practice; v4 nests `resolvedConfig` —
  an entire capability payload — inside every entry, and the getters used to hand
  back live state: `getRuntimeConfig()` stripped `kMetadata` with a shallow spread
  (`runtime/lib/runtime.js:1634-1640` pre-`9fed017ee`), so every value under it was shared, and
  `getApplicationDetails()` read `config` straight off `application[kConfig]`
  (`:2278`). A consumer mutating what it received would be editing the configuration
  that later restarts and scale-up workers read, silently, and would make worker
  generations disagree about what they are running — while `setApplicationConfigPatch()`
  exists precisely so that changing a running application's configuration is explicit,
  patch-shaped and visible. Both getters now construct a DTO from the snapshot and
  freeze it through (`:1691`), with tests that mutate every returned payload and assert
  runtime state is untouched.

  **`getRuntimeConfig(true)` leaves the public surface**, or the promise above has a
  hole with a typed overload pointing straight at it: `includeMeta: true` is declared
  in `runtime/index.d.ts:393` and returns live `#config`, symbol key and all. Its
  in-tree uses do not need a public API. Two are internal — `addApplications` reading
  `config[kMetadata].root` to validate against
  (`runtime/lib/management-handlers.js:136`, `runtime/lib/management-api.js:157`) —
  and stay inside the runtime, off the DTO contract. One is `GET /config?metadata=true`
  (`runtime/lib/management-api.js:104`), which goes with that endpoint. The published
  consumer was `@platformatic/control`'s `getRuntimeConfig(pid, true)`, which
  `applications:add`/`remove --save` called for `root` and `configPath`
  (`wattpm/lib/commands/applications.js:31,110-112` pre-`0f4d17a1b`); they read
  `GET /metadata` instead (`:33,112`), which is the shape those callers actually
  wanted. `getApplicationConfig()` needs none of this: it crosses ITC and
  JSON round-trips on the way back, so what it returns was never shared to begin
  with.

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
  DTO break (breaking change 14). Both are therefore **code-loading operations**:
  where v3's posted worker read a JSON file, v4 evaluates whatever
  `watt.config.*` it discovers at the posted path. That follows from the trust
  model above rather than contradicting it — but it is worth stating, because
  `management: true` grants an application every operation including
  `addApplications`, and the `operations` allowlist is how a deployment narrows
  that. The same eval pass applies to the **ITC**
  `management:addApplications` handler (`runtime/lib/management-handlers.js:30,136-146`),
  reachable from any application with `management: true` — it is a second live
  hot-add path with the same worker-self-loading assumption. What these commands
  need from the running runtime comes from `GET /metadata`, which already carries the
  project directory as `projectDir` (`runtime/lib/runtime.js:1647`) and is extended
  with `configPath` and **`autoload`** — `applications:remove --save` resolves the
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

  **A snippet fallback assumes there is a file, and two runtimes have none.**
  Zero-config synthesizes in memory and deliberately writes nothing (see "Levels of
  ceremony"), and a programmatic object source never had a file; the metadata contract
  represents both as `configPath: null`. The non-static-shape fallback does not reach
  either — there is no shape to fall back *from*. So `--save` **checks
  `configPath` before it mutates anything**, and the ordering is the point: a save
  that cannot happen must not be discovered after the application is already running,
  or `--save` reports an atomic success it did not perform.

  - **Synthesized (zero-config)**: `--save` materializes the synthesis — a complete
    root config containing the *detected* application as an explicit entry plus the
    requested change. That is the whole job: adding a second application turns a
    Level 0 project into a multi-app root, and the file has to state what was
    previously implied or the next boot loses the original application. It is the one
    case where `--save` creates a file, and it says so in its output, because a
    command that writes a configuration into a project that had none should not do it
    quietly.

    **Writing that file is itself a runtime mutation, so the order is not free.**
    Under `wattpm dev` the watcher watches absent config candidates for creation
    precisely so a new `watt.config.*` triggers a reload (see "Loading mechanism"), and
    this command creates the first one. Writing before the live change lets the reload
    apply it first, so the command's own `POST`/`DELETE` then hits a topology that
    already has — or has already lost — the application, and answers duplicate or
    not-found. So the sequence is **render, validate, mutate, publish**: the file
    content is rendered and validated against the loader in memory; the live mutation
    is applied and confirmed; then the file is published atomically, by write-and-
    rename, so the reload it triggers converges on a topology the runtime is already
    in. Validating before mutating is what keeps the last step from being the one that
    can fail on content.

    **Atomic is not exclusive, and publication needs both.** A rename replaces its
    target, so if another editor created a configuration during the live startup — which
    can take a while — an ordinary rename destroys it. And the target is one of four
    recognized names (`watt.config.ts`, `.mts`, `.js`, `.mjs`), so a rename that
    *succeeds* can still leave two candidates in the directory, which the loader
    rejects and which turns the reload this sequence was ordered around into an
    ambiguity error. So the commit **rechecks the whole candidate set immediately
    before writing** and publishes with a **no-clobber** create rather than a
    replacing rename. If any candidate appeared in the meantime it is left exactly as
    it is: the application is already live, and the output says so and prints the
    rendered configuration to merge by hand.

    Publication can also fail on I/O, and either way the outcome is **reported, never
    swallowed**: the application is running and the file is not written, so the output
    says exactly that. Reporting a partial outcome honestly is the requirement;
    rolling the live change back would trade a stated inconsistency for an unstated
    one, since the removal can fail too.

    **What the emitted entry contains is the whole difficulty**, because three rules
    meet on it. Level 0 synthesized `server.port` because a detected framework
    application starts nothing without one; a multi-app root does not rely on detector
    inference for an application it names; and a global `PORT` expression has to become
    `PLT_<ID>_PORT` the moment siblings exist. Emitting `{ id, path }` alone satisfies
    none of them — the synthesized server block is gone and the application is
    inactive under `dev`. Serializing the resolved synthetic object satisfies the
    first two and breaks deployment, freezing today's numeric `PORT` into the file.

    So the entry carries the **detected `module` and an authored expression**:
    `config: { module: '@platformatic/next', server: { port:
    Number(process.env.PLT_FRONTEND_PORT || 3042) } }`, with the id normalized the way
    every other id is. This is generated **code**, not `JSON.stringify(resolvedConfig)`
    — the stamped plain-object form means "no imported `defineConfig` or factory", not
    "no expressions", and an object literal in a `.ts` module holds an expression
    perfectly well. The command's output **says the variable changed**, because a
    deployment setting `PORT` was reaching this application a moment ago and will not
    be afterwards; scoping it is required by the multi-app rule, and doing it silently
    would be a port change nobody asked for.

    **The filename and the form follow the rules the rest of the document already
    sets.** The suffix comes from the same selector scaffolding uses — `watt.config.ts`,
    or `watt.config.mts` where the package is `"type": "commonjs"`, because
    `export default` in a CommonJS `.ts` is a syntax error (see "One dialect"). The
    content is the **stamped plain-object form** with its `$schema` marker, not an
    imported `defineConfig`: a zero-config project need not have `wattpm` resolvable
    from its root, and `--save` installs nothing. That is exactly the machine-writer
    case the marker rule exists for (see "Machine-generated configs").
  - **Programmatic object source**: `--save` **refuses**, before mutating, naming the
    embedder. There is no honest target — the configuration lives in the host
    program's memory, and any file this command wrote would be shadowed by the object
    the embedder passes on the next `create()`. The live-only form (`applications:add`
    without `--save`) is the supported operation there, and the refusal says so.
- **Capability CLI commands** (`db:migrations:apply`, `db:seed`, `db:types`,
  `gateway:*`, `next:*`) move to a **data contract**: `createCommands` becomes part
  of the v4 capability contract, and each command receives `{ root, config }` — the
  app's config from the eval pass, **with the capability `transform` applied
  main-side** — instead of a config file path. The transform is not optional here:
  db's rewrites the relative sqlite path to absolute and injects the
  `migrations.table` / `db.ignore` defaults `Migrator` requires
  (`db/lib/config.js:6-52`), so a command handed raw config would migrate the
  wrong database. This is what v3 already does — `loadConfiguration(configFile,
  schema, { transform })` in the CLI process (`db/lib/commands/migrations-apply.js:11`)
  — and the main process synthesizes the `kMetadata` the transform reads
  (`root`, `path: configPath`, `module`, `version`, `env`). Context that only
  exists in a worker is absent and documented as such: no `configPatch` is applied
  and `watch.enabled` falls back to `false` rather than the runtime's watch flag —
  a config that declares `watch` keeps its own value — which is exactly how
  `basic`'s transform already behaves outside a worker
  (`basic/lib/config.js:57,67-71` optional-chain `workerData`). Commands never self-load config (db's `loadConfiguration` call and
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

- **`wattpm create` / `create-wattpm`**: a **single-app** project with default
  answers gets **no Watt config file** (zero-config detection covers it — subject to
  the zero-config synthesis rule in "How applications are exposed"); omission is safe there
  because the wizard adds the chosen capability to the app's dependencies and the
  deterministic detector reconstructs exactly that choice (see "Loading mechanism").
  A **monorepo** gets the thin autoload root (genuinely load-bearing: the autoload
  path) **and a `watt.config.ts` for every application** (`.mts`/`.js` variants per
  the rules above), including applications configured entirely by defaults. The
  omit-defaults rule is a single-app rule, because in a multi-app project a
  defaults-only file is not redundant: **owning a file is the scope declaration**,
  and it is what makes the scaffolded per-app `"dev": "wattpm dev"` boot *that*
  application rather than walking up to the root and booting the whole runtime.
  Since the generator writes those scripts into every application directory
  unconditionally (`generators/lib/base-generator.js:534-543`), omitting the file
  would silently redefine the script the generator just wrote. The v3 wizard's
  `3042` prompt is gone from the root — ports are per-application now, and the
  generator hands application *i* `3042 + i`
  (`runtime/lib/generator.js:211-214`). The wizard's closing output prints where `watt.config.ts`
  goes and the one-line bare-factory form, so later customization is one
  copy-paste away.
- **`wattpm import`**: edits the root config with **magicast** (AST edit preserving
  formatting) when the shape is statically safe — literal `defineConfig` object,
  literal `applications` array; otherwise prints a paste-ready snippet and exits 0
  with a notice. magicast is a dependency of **both** `wattpm-utils` (for `import`) and
  `wattpm` (for `applications:remove --save`, imported lazily so the cost is paid only
  when the flag is used) — the two commands live in different packages
  (`wattpm-utils/lib/commands/external.js` and `wattpm/lib/commands/applications.js:68`).
  In a configless
  tree, `import` scaffolds a thin autoload root first (replacing the v3
  `?autogenerated=true` marker dance, whose producer and consumer are both gone).
- **Temporary-config fallback** (`fallbackToTemporaryConfigFile`): removed;
  zero-config synthesizes in memory.

### `wattpm-utils migrate`

A one-shot codemod in `wattpm-utils`, invoked as **`npx wattpm-utils@4 migrate`** —
**not routed through `wattpm`**. It is a **stable-v4.0 release gate**: v4 refuses
every legacy configuration, so the migrator is functionally part of the breaking
change — GA does not ship without a published, tested migrate (alphas and RCs may
precede it; early adopters hand-convert). Release *cadence* stays decoupled after
4.0: because `npx` resolves the package at *invocation* time, migrate fixes ship on
`wattpm-utils`' own schedule and reach every already-installed v4 runtime with no
runtime re-release.

**The major is pinned in every invocation this document prints**, because
invocation-time resolution selects a *version* and not a *line*. Bare `npx
wattpm-utils` resolves a locally installed copy first, and in the project most likely
to need migrating that copy is v3 — `wattpm-utils` at v3 has no `migrate` command at
all, so the instruction a v4 error prints would answer "unknown command" in exactly
the projects the error is for. In a project with no local copy it fetches the latest
published major, which is v4 today and will not stay v4. `npx wattpm-utils@4 migrate`
is the whole fix: still the newest v4 migrator at invocation time, which is the
property the decoupled cadence needs, and never a v3 binary or a v5 one. `--resume`
and every command the reports print carry the same pin, since a resumed run must be
the migrator that wrote the manifest.

It is **the only code in v4 that can read legacy configs**. Scope: v3 projects built
on in-tree capabilities. It finds its input the way v3 found it, escape hatch
included: the recognized v3 candidates from the directory it runs in, or the file
named by **`migrate --config <path>`**, which accepts any filename. v3's `-c` did the
same — `findConfigurationFileRecursive` runs its search loop only
`while (!configurationFile)` (`foundation/lib/configuration.js:196-225`) — so a
project whose scripts say `platformatic start -c config.production.yaml` has a real
v3 configuration that a candidates-only migrator would never see, and would report as
"nothing to migrate". (The loader's own `--config` accepts only the four v4 names;
migrate's accepts only legacy ones. Each command reads the dialect it is for.) Where v3 and v4 cannot agree, migrate either **refuses** or
**reports** — both sets enumerated in step 2 below, both derived from the lexical
view, and neither ever silent. Refusals are detected before anything is written and
come with the supported manual fixes. **Two of them involve `envfile`** and are worth
stating here because they are the ones a well-formed, ordinary v3 project can hit:

- **an application in the root config's own directory that declares `envfile`.**
  Such an app must be emitted root-inline (the per-app style would put two v4
  candidates in one directory), and `envfile` alongside an inline `config` is
  illegal because that entry has no per-app eval worker. Manual fixes: move the
  application into a subdirectory, or fold the named file into its own `.env` set.
- **a root `envfile`.** Converting it means either activating keys v3 never read
  or copying the named file's contents — often credentials — into a `.env` the
  convention leaves tracked. Manual fixes: fold the file into the root `.env` set
  deliberately, or pass it with `--env` at run time.

To guarantee the rest, the **complete v3
closure** is vendored under `lib/migrate/legacy/` when it is deleted from the live
packages — and the closure is larger than foundation alone:

- foundation's machinery: the parsers for all formats (JSON, JSON5, YAML, TOML),
  `replaceEnv` and the YAML brace pre-pass, all `$schema` URL generations, and a
  **v3 → v4 module rename table** (`@platformatic/composer` →
  `@platformatic/gateway`; the identity is extracted *before* the upgrade chains
  run, `foundation/lib/configuration.js:166-179` called at `:573`, ahead of `upgrade()`
  at `:583`, so composer-era apps
  keep the old module name and must be renamed explicitly);
- the four `semgrator` upgrade chains (from `runtime`, `service`, `db`, and
  `gateway` — including v1/v2→v3);
- **frozen v3 snapshots of the ~13 capability schemas** — required because the
  upgraded view's structural validation runs against the v3 schema, and the live
  v4 packages ship *audited, changed* schemas the frozen reader cannot borrow. The
  capability **transforms** are not vendored: nothing in v4 needs to reproduce a v3
  transform's output (see "Two views", below).

Everything moves with its existing tests, not rewritten. There is no dependency on
any v3-versioned package: the monorepo contains exactly one copy, living next to its
only consumer, frozen and CI'd for the life of v4. (Independently of migrate: the
gateway's *request-time* use of `replaceEnv` in `gateway/lib/capability.js` is
rewritten in the v4 gateway — that call cannot be relocated.)

Migrate works from **two views** of the legacy configuration, because the v3
production pipeline destroys exactly the information generation needs: env
replacement runs *before* upgrade, validation, and transform, so a set
`PLT_REDIS_URL` has already become its literal value (possibly a secret that
must never be baked into source), an unset one has already become `''` or its
fallback, and an embedded placeholder
(`http://127.0.0.1:{PLT_OTLP_PORT}/v1/metrics`) is an ordinary string whose
expression boundaries are gone; capability and runtime transforms then rewrite
authored values and drop environment-disabled applications. The views:

- the **lexical view** — the parsed file with placeholder tokens
  intact and no defaults injected; every authored application is present
  regardless of the migration-time environment. A token is **not** required to
  carry a `PLT_` prefix, and may use one or two braces: v3's grammar is
  `/(?:\{{1,2})([a-z0-9_]+)(?:\}{1,2})/i`
  (`foundation/lib/configuration.js:28`), so `{PORT}`, `{{DATABASE_URL}}` and
  `{plt_x}` are all placeholders. Migrate matches that grammar exactly — writing it
  narrower would silently leave un-converted tokens as literal text in the emitted
  configuration, where v3 had substituted them. *Which applications exist* is
  lexical; the six **structural path positions** are the documented exception and
  are resolved against that environment before emission (see step 1). Its
  **module list** — what the
  pre-flight check and the generation table key off — is
  `config.module ?? extractModuleFromSchemaUrl(config)` with
  `splitModuleFromVersion` applied, since a top-level `module` string is the
  canonical v3 spelling for capabilities without a published `$schema` URL
  (`foundation/lib/configuration.js:156-157`, `foundation/lib/module.js:129-140`);
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
  authored values it exists to preserve.

**There is no automated equivalence check, and that is a deliberate trade.** An
earlier design compared the emitted configuration against a third "resolved view"
— the config loaded as production v3 would be — but no comparand works: comparing
*pre-transform* leaves the two sides structurally incomparable, since v3 expands
`autoload` and applies `enabled` inside `transform`
(`runtime/lib/config.js:450-484`, `:486-490`) while v4 does both in
the root eval worker; and comparing *post-transform* pits v3's transform output
against v4's, which differ by design after the schema audit. Building either to a
useful fidelity is a large amount of machinery for a one-shot codemod — the
vendored replica of the runtime config machinery, the frozen capability
transforms, and a maintained exclusion list — so migrate does not carry it.

What guards correctness instead: **step 3 validates the emitted configuration
through the real v4 loader**, so structurally invalid output never survives;
every uncertain conversion emits a **requires-review** note naming the file and
the reason; **git is the undo mechanism**, with the dirty-tree rules and the
path-scoped rollback making that precise. What is *not* guarded, and the migration
guide says so plainly: nothing verifies that a converted value still resolves to
what v3 resolved. The audit's target-type table, the per-property boolean rules
and every `?? ''` fallback are **trusted, not checked** — review the diff.

Generation reads both views. Then:

1. Emit the v4 files: for a v3 **single-app** project, one root file — the bare
   factory export when the v3 config carried no runtime settings, `defineConfig`
   with the singular `application` shorthand when it did (Levels 1/1b); for a
   **multi-app** project, a `watt.config.ts` for **every** application plus a thin
   root `watt.config.ts`.

   **Every *explicit* entry gets an explicit `id`**, resolved the way v3 resolved it
   and written as a literal, so no migrated project depends on either version's
   default. A v3 id that is not a legal v4 label — v3 imposed no grammar, so `my_app`
   was accepted — is a **reported divergence**, not a silent rewrite: migrate emits
   the id it must (`my-app`) and the note records both spellings and the four things
   that move with them, because leaving the v3 spelling would emit a configuration
   that cannot load.

   **Two autoloaded directories that resolve to the same id are a boot error naming
   both.** v3's ids were directory names, unique by construction; v4 prefers the
   `package.json` `name`, which is not — two directories copied from one another
   carry the same name, and v3's shallow merge (`runtime/lib/config.js:476-481`)
   would silently absorb the second, so it would never boot and nothing would say so.
   That merge remains what it was in v3: a rule for an autoloaded entry meeting an
   *explicit* one, not for two autoloaded directories colliding.

   `autoload`-discovered applications need the same protection as explicit entries,
   but only where the id would actually move. v3 derived their id from the **directory name** alone
   (`runtime/lib/config.js:465`, `mapping.id ?? entry.name`); v4 prefers the
   `package.json` `name` (see "How applications are exposed"), so an application in
   `web/composer/` whose package is named `gateway-service` would be renamed — and
   with it the mesh hostname, the injected variable, the metrics label and any
   sibling's `dependencies` entry. Migrate therefore emits an `autoload.mappings`
   entry pinning `id` **wherever the legal v4 id differs from the id v3 used** — not
   wherever the raw values differ, which is the comparison that leaks. Both sides are
   normalized before they are compared: v3's id for a directory is
   `mappings[dir].id ?? dir`, v4's is the scope-stripped `package.json` name falling
   back to the directory, and each is then put through the label rule
   (`my_app` → `my-app`). Three cases fall out of the one comparison. A package named
   differently from its directory is pinned, because the id would move. `web/frontend`
   holding `@acme/frontend` is not, since both sides resolve to `frontend`. And a
   directory or mapping named `my_app` **is** pinned even though v3 and v4 derive the
   same raw value from it, because the legal v4 id is `my-app` and keeping the v3
   spelling would emit a configuration the label grammar rejects — precisely the case a
   raw comparison passes over in silence. A mapping that already carries an `id` is
   still v3's answer and is carried through, normalized, rather than re-derived. In the
   common case — a package with no `name`, or one named after its directory, sitting in
   a directory that is already a legal label — the thin autoload root stays thin.

   **One final-id table serves everything downstream.** Explicit entries and autoloaded
   directories resolve into the same `{ v3 id → v4 id }` table, computed once before
   anything is emitted; mapping emission, the collision refusal and every reference
   rewrite read that table rather than each recomputing a normalization and disagreeing
   at the margins. Two rules it applies that a per-site derivation gets inconsistently:
   DNS labels are **case-insensitive**, so `API` and `api` are one id and collide; and
   `PLT_<ID>_URL` normalization folds every non-alphanumeric run to `_`, so two ids that
   differ only in separator style collide in the injected variable namespace even where
   they are distinct hostnames (see "Inter-application URLs"). An id is
   the mesh hostname, the injected `PLT_<ID>_URL` name, the metrics label and the
   argument `wattpm inject` now requires — silently re-deriving it would move all
   four at once. For a wrapped single-app project the v3 value is the package name
   with its scope stripped, falling back to **`'main'`**
   (`runtime/lib/config.js:136-147`, still present at HEAD); v4's fallback is the directory
   name instead, so pinning is what keeps a nameless package addressable at
   `http://main.plt.local` after migration rather than at its directory name.

   One carve-out: an entry that is **orchestration only** — a `url` with no
   resolvable directory — gets no per-app file, because there is no directory to
   write one into. It is exempt from the closure gate too (v3 could not even
   determine its capability, marking it `type: 'unknown'`,
   `runtime/lib/config.js:277-279`), and appears on the migrate-the-other-repository
   list instead. Otherwise per-app files are emitted **unconditionally**, including
   when one would contain nothing but the capability call. Two reasons: owning a
   file is the scope declaration (see "Loading mechanism"), and migrate does not
   touch `package.json` scripts — so an application left without one keeps a
   `"dev": "wattpm dev"` that walks up and boots the whole runtime. Emitting always
   also means migrate never depends on the v4 detector reconstructing the v3
   `$schema` capability: it is written explicitly in every file, so `$schema`-only
   apps cannot lose their identity to framework inference (v3's `$schema` +
   runtime-bundled fallback made app-local capability dependencies optional, and
   `node/lib/generator.js:78-80` writes both `@platformatic/node` and
   `@platformatic/globals`, so no dependency test could have been reliable anyway).
   **The directories `resolve` cloned into are excluded from every step** — the
   lexical pass, the dirty check, emission, the source scan and the deletion set.
   `wattpm resolve` clones remote applications into `resolvedApplicationsBasePath`
   (`external.js:634`), so those directories hold *other repositories'* v3
   configurations, untracked.

   **The exclusion is that set of directories, not the configured base wholesale**,
   and the difference is load-bearing because the base is an ordinary string with no
   dedicated-directory rule (`foundation/lib/schema.js:1545-1548`). A project may set
   it to `applications` and keep local applications at `applications/api`, or to `.`
   so clones land at the root. Excluding the base itself would then hide a local
   application's legacy config from the lexical pass and skip the per-app file it must
   be given — silently, since the exclusion is a scope rule and not a refusal — and
   with `.` it would swallow the transaction root and migrate nothing at all. So what
   is excluded is the canonical directory of each `url`-bearing entry, computed from
   the effective destination the same way `resolve` computes it (see "Remote apps"),
   and nothing else. Migrate additionally **refuses** before writing when one of those
   directories contains a local application, a file it must read, or a path it plans
   to emit: that is a project whose remote checkouts and own sources share a
   directory, which no scope rule can separate and no run should guess at. The
   containment check answers a different question — whether a path escapes the
   transaction — and would not notice an exclusion eating the run from the inside. Without the exclusion a
   project with one resolved remote app cannot migrate at all: step 5 refuses to run
   on an untracked legacy config it can never restore, naming a file inside a clone,
   and `--force` then lets migrate write into the clone and delete its
   `platformatic.json` — which the next `wattpm resolve` re-fetches, undoing both.
   Every `url`-bearing entry goes on the migrate-the-other-repository list whether or
   not its directory happens to exist locally, which is what "Remote apps" already
   says — and so does every **local** application resolving outside the transaction
   root, for the same reason: it is another project's tree, and one run cannot
   transact two of them (see the pre-flight).

   The summary names the **scope change migrate introduces**: every application
   directory that gains a `watt.config.*` gets a `"dev": "wattpm dev"` that now boots
   *that application* rather than the runtime. That is the point of emitting the
   files (see "Scope"), but it changes what an existing per-app script does, so the
   report lists the affected directories rather than leaving it to be discovered.

   Missing app-local capability dependencies are still added in step 2. Emission
   also **drops keys the v4 schemas no longer admit** and that no upgrade chain
   removes — today that is `application.entrypointPort` (see BC 19) — each with a
   requires-review note; leaving one in would fail step 3 on migrate's own output. A
   **renamed** module is written under its new name — a
   `@platformatic/composer` app gets a `gateway(…)` file, and the
   superseded dependency is removed in step 2, the one sanctioned `package.json`
   edit beyond ranges and additions. A **`module`-identified** app — the canonical
   v3 spelling for a capability with no published `$schema` URL — gets the ordinary
   factory emission, since the module string names which factory to call. Migrate
   never emits a plain `{ module: '…' }` object: one naming an in-closure capability
   has a factory, and one naming anything else cannot reach generation, because the
   pre-flight check refuses every capability outside the vendored closure. The plain
   form remains part of the *format* for v4-contract capabilities that ship no
   factory (BC 15); it is simply not something a migration produces. An application whose directory coincides with the root — or with
   any directory already owning the root file — is emitted **root-inline**
   (`applications[].config: factory(…)`, resolvable by definition since its
   dependencies live at that root): the per-app style would put two v4
   candidates in one directory, which the loader rejects. Emission unwraps
   `runtime` blocks (treating the schema-accidental `runtime.services` like
   `runtime.applications`, with a warning), merges the `web`/`services`/`applications`
   aliases, and converts `{PLT_X}` placeholders into typed expressions that
   **preserve v3's unset-variable semantics** — v4 omits `undefined`-valued
   properties, so a bare `process.env.PLT_X` would silently change all three v3
   behaviors. Under effective non-strict mode a **string** position becomes
   `process.env.PLT_X ?? ''` (v3 replaced a missing variable with `''`); under
   effective `strictEnv: true` / `'warn'` every position instead gets a small
   generated `requiredEnv('PLT_X')` helper that throws (or warns) when the variable is
   unset — a project that refused to boot without `TOKEN` still refuses after
   migration. **Typed positions get that helper either way**, for the reason below.

   `?? ''` is therefore the emission for a string position in a non-strict project,
   and nothing else.

   It is not behaviour-preserving anywhere else. v3 validated after replacement with
   `coerceTypes: true`, and ajv does not coerce `''` — it rejects it — so
   `"port": "{PORT}"` or `"level": "{PLT_LEVEL}"` with the variable unset failed
   validation and the project did not boot. Those variables were *implicitly required
   by their position's type*. What migrate emits therefore depends on the target
   type, and all three emissions preserve what v3 did:

   | position | emitted | unset behaviour |
   | --- | --- | --- |
   | string | `process.env.X ?? ''` | `''`, as v3 |
   | boolean | the audit's per-property rule — `!== 'false'`, `=== 'true'` | a real boolean; `''` never reaches the schema |
   | number, enum | `Number(requiredEnv('X'))` / `requiredEnv('X')` | refuses to boot, as v3 |

   **A typed position gets the guard whether or not the project set `strictEnv`**,
   because the requirement is not the project's — it is the position's. `strictEnv`
   made *every* variable required; the schema made *these* ones required, and it did
   so under v3.

   The alternative is to emit `Number(process.env.X ?? '')` and warn, on the reasoning
   that a value the deployment always sets needs no helper. That reasoning confuses
   *needs no helper* with *is harmed by one*. `requiredEnv` returns the value when the
   variable is set, so the deployment that sets `PORT` is untouched; it throws only
   when the variable is missing, which is precisely the case where v3 refused to boot.
   There is no third case — the variable is set or it is not — so the guard costs
   nothing and buys back the one conversion that could otherwise turn a project that
   refused to start into one that starts on a port nobody chose.

   **An enum position gets a guard that returns the enum**, not a `string`. Migrate
   emits TypeScript that the user opens in an editor, and a `string`-returning helper
   assigned to a field typed as a literal union is an error there even though the
   loader would accept the value at runtime — a migration that leaves the project red
   in its editor has not finished. So enum positions get `requiredEnum(name, allowed)`,
   which narrows to `allowed[number]` and checks membership, and the check is worth
   more than the type: a value outside the set now fails **at the config file, naming
   the allowed members**, instead of at AJV two steps later with a schema path. That
   is three emitted helpers at most — `requiredEnv` for plain typed positions,
   `requiredEnum` for enums, `requiredValue` for an interpolation (see step 2) — each
   written into the file only when the project has a position needing it.

   The guard for a typed position **throws when the variable is unset or empty**, and
   throws even under `strictEnv: 'warn'`: v3's ajv rejected `''` in these positions
   with `coerceTypes` on, and warning would leave `Number('')` — that is, `0` — to
   reach the schema, which is exactly the silent listener the guard exists to
   prevent. That non-empty rule is the one place the guard is stricter than v3, and
   only for string positions under `strictEnv`, where v3 accepted a deliberately
   empty value; it is reported (see the divergence list in step 2). Two carve-outs: "effective strictEnv" per app file follows v3's
   precedence (`strictEnvOption ?? config.strictEnv ?? config.runtime?.strictEnv` —
   the *root* config's value wins when defined, and a per-app capability config
   carrying a `runtime` block supplies the third fallback,
   `foundation/lib/configuration.js:540` with
   `runtime/lib/worker/controller.js:96,166`), and `*_URL`
   placeholders in **separate application config files** never get `requiredEnv`
   even under strict mode — v3 resolved unset `*_URL` keys there through the
   current-app fallback, which warns and never throws — they get the literal or
   `?? ''` plus the review warning. The carve-out is scoped by *loader pass*, not
   by position: `onMissingEnv` is supplied only where a worker parses a separate
   app config (`worker/controller.js:165`), so both a **root** config's `*_URL`
   placeholders **and every placeholder in a wrapped single-app config** — which
   `runtime/index.js:154-157` loads with no `onMissingEnv`, capability half included
   — throw on v3 under effective `strictEnv` and get `requiredEnv` like any other
   key.
   Embedded placeholders become template literals with the same
   per-variable wrapping
   (`` `http://127.0.0.1:${process.env.PLT_OTLP_PORT ?? ''}/v1/metrics` ``);
   typed positions get the explicit coercion the audit's target-type table
   prescribes — and for booleans that table records **each property's exact v3
   rule**, because they differ by site and sometimes contradict each other across
   dialects. `enabled` is `!== 'false'`, so unset keeps the application. `watch`
   has **two opposite rules**: at runtime level
   `config.watch = config.watch === 'true'` (`runtime/lib/config.js:323`
   pre-`e2da15eda`), so unset is `false` and any non-`'true'` string is `false`;
   inside a capability's `watch` block it is `config.watch?.enabled !== false`
   (`basic/lib/capability.js:394`), so unset is **`true`** and the *string*
   `'false'` leaves watching **on**, since only the boolean disables it. A
   placeholder resolving to `'false'` therefore meant opposite things in the two
   positions, and the table is keyed by position for exactly this reason —
   or values are flagged
   for review when no
   faithful expression exists; app-id URL placeholders become the literal
   `http://<id>.plt.local` per "Inter-application URLs"; positions on a
   capability's `replaceEnvIgnore` list (vendored into the generation table —
   db's OpenAPI `ignoreRoutes`, where `/users/{id}` is placeholder-shaped but
   must stay a literal) are emitted **verbatim**. Placeholders that v3 resolved from
   `envfile` contents keep the ordinary `process.env.X ?? ''` emission: an
   `envfile` is a file on disk, it sits in the config-evaluation view like any other
   app env file, and the main process resolves it before the evaluating worker
   starts (see "Env files").

   Placeholders that v3 resolved from a config **`env` block** are the one case with
   no faithful emission. The v3 worker applied blocks to `process.env` *before*
   parsing the app's config; v4 keeps them out of config evaluation entirely, so the
   key is undefined when the emitted expression runs. Migrate emits the honest
   `process.env.X ?? ''` and raises a **requires-review** note naming the key, the
   block that supplied it and every position that referenced it — because that
   expression yields `''` where v3 yielded a value. Nothing is inlined: a codemod
   must not bake an `env`-block credential into tracked source, which is why this is
   reported rather than silently repaired. The note states the two supported fixes —
   move the value into an env file, or into the real environment — and records that
   the block keeps working unchanged for the *running* application either way.
   This is not a rare
   path — every wrapped single-app project migrates to a root-inline entry, and
   `runtime.env` is schema-legal there (`env` is absent from
   `runtimeUnwrappablePropertiesList`, so `wrapInRuntimeConfig` hoists it and the
   v3 worker applied it before re-reading the same file), so a single-app project
   that parked a variable in `runtime.env` and read it back as `{PLT_X}` is exactly
   the shape that gets the note. The root config's own
   keys keep the plain form: v3 never resolved those from `env` blocks either.
   Literal values in typed positions get the same treatment as placeholders: v3
   validated with `coerceTypes: true`, so `"port": "3001"` and `"workers": "4"`
   boot on v3 and are coerced at generation time per the target-type table rather
   than emitted as strings the v4 loader rejects. `strictEnv` itself has
   no v4 meaning and does not survive — its effect is baked into the emitted
   expressions, which users can hand-simplify to bare references afterwards: an
   informed edit, not a silent change. **Exposure is the one area where migrate
   must reason about a v3 concept v4 does not have.** v4 has no `entrypoint` and
   no root `server`, but which port was *live* on v3 depended on both, so migrate
   resolves the v3 entrypoint from the lexical view, purely to classify each
   application's port. It reproduces v3's rule
   (`runtime/lib/config.js:436-460` pre-`e2da15eda`; a named miss threw, `:465-466`)
   in three steps, and the qualifiers on the third are not incidental:

   1. an explicit **`entrypoint`** key wins;
   2. else, if exactly **one application survives** the `enabled` splice, it is the
      entrypoint — with no type test and no other condition;
   3. else, among surviving applications **that have an app-local config file**,
      count those whose **`$schema` module is exactly `@platformatic/gateway`**.
      Exactly one → entrypoint. Zero or several → none, and the project booted
      mesh-only.

   **Step 3 runs on the pre-rename identity.** The pre-flight check normalizes the
   module list through the rename table so a `@platformatic/composer` app is measured
   as `@platformatic/gateway` and passes the closure gate — but v3 tested the raw
   value (`if (application.type === '@platformatic/gateway')`), so a composer app was
   **never** a gateway candidate. Classifying on the normalized list changes the
   answer in both directions: one composer among three applications makes migrate
   resolve an entrypoint where v3 had none, opening a public listener on a project
   that had none; one composer *plus* one gateway makes migrate see two where v3 saw
   one, dropping the root `server` block and taking the public address with it. The
   rename table applies to the closure gate only.

   **Step 3 also skips entries with no app-local config file**, which v3 did
   explicitly (`if (!application.config) { continue }`). That is not an accident of
   implementation: `type` comes from the config file's `$schema` when one exists
   (`:253`) and from package resolution when it does not (`:259`), and only the
   former was eligible. So `[{ id: 'gw', path: './gw' }, …]` where `./gw` is a
   gateway with a `platformatic.json` on disk **is** a candidate, while the same
   entry pointing at a directory with no config file is not — and migrate can tell
   the two apart by looking, which is all v3 did.

   All of this is a lexical rule over data migrate already holds: each entry's
   module, which the pre-flight check computes anyway, and whether a config file
   exists at the entry's path. No part of the runtime transform is involved.

   **The count is taken after replaying v3's `enabled` splice, not over every
   authored application.** v3 removes disabled applications *before* auto-detection
   (`config.js:398-402` pre-`19d8fb98b`, then `:410-412`), so a two-application project
   with one
   `enabled: false` had exactly one survivor, and that survivor became the
   entrypoint and bound the root port. Counting the lexical set instead would
   conclude "does not resolve" and drop the root `server` block from a project that
   was publicly reachable — and since a v4 listener opens only where
   `server.port` is defined, a framework application treated that way would not
   start at all. Migrate therefore evaluates `isApplicationEnabled`
   (`config.js:371-387`) over the lexical values and resolves the entrypoint
   **twice, once for `production` and once for `development`** — the only two
   values v3 derives (`:391`).

   When both environments resolve to the same application, that is the entrypoint.
   When they **disagree** — an `enabled` object such as
   `{ "production": false, "development": true }` changing the survivor set — there
   is no single faithful output, because which application owns the public address
   is structural in v4 and cannot be made environment-dependent. Migrate stops with
   a **pre-flight refusal** naming both applications and the deciding key, and tells
   the user to set an explicit `entrypoint` and re-run. The same refusal covers an
   **undecidable** `enabled`: a string that was a `{PLT_X}` placeholder is unknown at
   migration time (v3 interpolated before testing `!== 'false'`), so when its value
   could change which application resolves, migrate refuses rather than guessing.
   An undecidable value that cannot change the outcome — an explicit `entrypoint` is
   present, or the application is not the deciding one — is not a refusal.

   When the entrypoint does **not** resolve in either environment — several
   surviving applications, no explicit
   `entrypoint`, and zero or more than one gateway — v3 booted mesh-only, since
   `transform` left `config.entrypoint` undefined and threw only for a *named*
   missing one. Migrate then drops the root `server` block and reports it, rather
   than guessing which application was public.
   Four rules follow, applied in this order:
   - **the v3 root `server` block moves into the v3 entrypoint's capability
     config** — **every key that capability's `server` schema admits**, which after
     the audit includes `portAssignment` (see "How applications are exposed"). Any
     key the target does not admit is dropped with a requires-review note naming it,
     the entrypoint and its capability.

     The move is defined against the *target's* schema rather than as a fixed key
     list because the capability blocks are not uniform. The v3 root block is
     `hostname, port, portAssignment, backlog, http2, https`; `nitro` deletes `http2`
     from its copy (`nitro/lib/schema.js:33-34`), so a v3 project with
     `server: { http2: true }` and a nitro entrypoint would fail step 3 on migrate's
     own output if the move were literal. A fixed list would also have to be revised
     every time a capability narrows its block — the failure mode this rule already
     hit twice, with `keepAliveTimeout` and `portAssignment`.

     This is the conversion the runtime's own upgrade chain
     cannot perform — it deletes root `server` and warns
     (`runtime/lib/upgrade.js:16-19`) precisely because the destination lives in
     another file — and it is what keeps the public address of a migrated project
     unchanged. Where v3 merged a root block with the entrypoint's own block, the
     merge order was **capability-family dependent**: the basic family let the
     app's own block win (`basic/lib/capability.js:89` pre-`e2da15eda`, a
     later-wins `deepmerge`), the service/db/gateway family let the root win
     (`service/lib/capability.js:223` pre-`e2da15eda`, which re-applied the
     worker's context last). Migrate reproduces the family's order and emits a
     requires-review note whenever the two blocks disagreed on a key;
   - **`useHttp: true` becomes a `server` block reproducing the defaults v3
     synthesized** — **but only for applications rule 1 did not touch.** v3's two
     branches are mutually exclusive: `if (runtimeConfig.server &&
     applicationConfig.entrypoint) { … } else if (applicationConfig.useHttp) { … }`
     (`runtime/lib/worker/main.js:258-268` pre-`e2da15eda`), so an entrypoint with a
     root `server` block ignored its own `useHttp` entirely. Applying rule 2
     unconditionally would overwrite the public port rule 1 just carried across with
     `port: 0`, and rule 3's carve-out would then protect that `0` from being
     stripped — a project answering on 3000 would migrate to answering on a random
     port, with nothing in the report saying the address moved. What lands
     in that block is family-dependent for two independent reasons. The
     **`keepAliveTimeout: 5000`** of the v3 block is emitted only for
     service/db/gateway; the basic family gets `{ port: 0, hostname: '127.0.0.1' }`
     alone. v3 handed the synthesized block to a `deepmerge` in the capability
     constructor rather than through a capability schema, so the key was **inert**
     for the basic family — those capabilities run the framework's own server and
     none of them reads `server.keepAliveTimeout` (`next` does honour a keep-alive
     timeout, but reads it from `KEEP_ALIVE_TIMEOUT` in the environment,
     `next/lib/capability.js:413-429`). In v4 the block is validated, and the
     basic-family `server` admits `hostname, port, backlog, http2, https` (plus
     `portAssignment`) with `additionalProperties: false`, while the full Fastify
     option set that defines `keepAliveTimeout` (`foundation/lib/schema.js:542`)
     belongs to service/db/gateway. So the same schema-driven rule as rule 1 applies:
     emitting it for the basic family would fail step 3 on migrate's own output, and
     adding it to those schemas instead would validate a key nothing reads. Dropping
     it preserves v3 behaviour exactly, because it had none. Whether a *declared*
     port survives alongside it is family-dependent for the same reason: the
     basic family kept the app's fixed port (requires-review note), while for
     service/db/gateway the `useHttp` defaults won and the declared port was
     already dead, so those apps get `port: 0` and a note recording the
     discarded value;
   - **an entrypoint that still has no `server` block gets `server: { port: 0 }`.**
     v3's `_listen` had no undefined-port guard, so an entrypoint with no `server`
     anywhere — no root block, no `useHttp`, no declared port — still bound an
     ephemeral port through `buildListenOptions`'s `{ port: serverConfig?.port || 0 }`
     (`basic/lib/utils.js:22`), and the runtime advertised it. v4 returns early on
     `typeof this.serverConfig?.port === 'undefined'`
     (`service/lib/capability.js:298-300`), so without this rule the application
     silently stops listening — and a framework application under `dev` does not start
     at all.
     The emitted `port: 0` reproduces what v3 bound; a requires-review note records
     that the address was never stable and is no longer runtime-advertised, since
     `getUrl()` is gone.
   - **a `server.port` that was inert on v3 is stripped.** An application that
     was neither the v3 entrypoint nor `useHttp` never listened
     (`runtime/lib/worker/controller.js:218` pre-`e2da15eda` gated listening on
     `useHttp` alone, and `listen()` no-opped for non-entrypoints at `:265-268`);
     in v4 any declared port is a real listener, and two of them on the same port
     is now a hard `AddressInUseError` rather than a dead value. The strip never
     applies to a `port: 0` **synthesized by rules 2 or 3**, which would otherwise
     cancel it and leave the application with no listener at all — the carve-out is
     about the port having been *authored* on v3, not about its value. The hazard is
     concrete: `wattpm import` pulls in projects scaffolded *standalone*, which do
     carry `"server": { "port": "{PORT}" }`
     (`service/lib/generator.js:414-422` pre-`e2da15eda`, guarded by
     `!isRuntimeContext`; the guard is gone in v4, where every scaffolded
     application owns a port).

   Per-app `envfile` paths are rewritten from v3's root-relative
   base to app-relative so they keep pointing at the same file; a **root
   `envfile` is not converted at all** — the pre-flight check stops the run and
   names it. v3's `customEnvFile` *replaced* the whole `.env` walk
   (`foundation/lib/configuration.js:349-357`), so any automatic conversion either
   activates keys v3 never read or moves the named file's contents — often
   credentials — into `.env`, which the convention at "Env files" leaves tracked
   (scaffolding ignores only `.env*.local`). Whether that is safe depends on facts
   migrate cannot see, so it is reported with the supported manual fixes rather
   than guessed. Every
   `env`-block key migrate carries over gets a warning that v4's dotenv-order
   precedence means the real environment now outranks it. `.env.sample` values are **suggestions, not runtime truth** — v3
   never loaded that file, so turning samples into executable `??` defaults would
   change behavior when the real variable is absent; migrate emits them as defaults
   only under an explicit `--use-sample-defaults` flag, and otherwise notes them as
   comments. `{PLT_ROOT}` gets its own rule: `{PLT_ROOT}/x` becomes
   `join(import.meta.dirname, 'x')` (adding the `node:path` import). That is exact in
   migrate's per-app output because v3 resolved `{PLT_ROOT}` against the directory of
   the config file being parsed, which for a per-app config *is* the app root — the
   same directory `import.meta.dirname` gives. It is **not** a general substitution:
   in a root-inline entry the expression must be rewritten, and in *application code*
   `process.env.PLT_ROOT` was the runtime root rather than the reading module's
   directory, which is why that case is reported by the source scan instead of
   converted.

   **Six positions are *structural* and must be concrete before anything is
   emitted**: an entry's `path`, an entry's `config`, `autoload.mappings[].config`,
   `autoload.path`, `envfile`, and `resolvedApplicationsBasePath`. Migrate needs real
   directories and real filenames at generation time — to decide where each per-app
   file goes, to open the legacy config each entry points at, to run the detector, to
   rebase `envfile` app-relative, and to evaluate the root-directory `envfile` refusal
   — and none of that is expressible over an unresolved token. So these six are
   **resolved, not converted**: migrate evaluates their placeholders and writes the
   resulting literal path.

   **The two config positions are the easiest to leave off a list like this**, because
   they name files rather than directories, and because v4 has no equivalent of
   either. v3 accepted a path in an entry's `config` and resolved it against that
   application's own `path` (`runtime/lib/config.js:270-271`), and accepted a filename
   in `autoload.mappings[].config`, joined to the discovered entry directory
   (`runtime/lib/config.js:469-472`) — so `config: '{APP_CONFIG}'` is a legal v3
   project, and one that names a file no rule of migrate's own could guess. Every
   later step is downstream of that value being real: the lexical pass reads that file
   to learn the application's module, step 1 classifies and emits from it, step 3
   validates the result against it, and **step 5 deletes it by name** — the custom
   filenames the deletion set is built from are exactly these. An unresolved token
   here does not degrade the run; it makes each of those steps operate on a file
   migrate cannot open, with the deletion the worst of them, since a legacy config
   left behind is the coexistence state step 5 exists to end. The last rung of the
   chain below — the `<autoload.path>/<id>` convention — is directory-shaped and does
   not apply to these two: a config filename still unresolved at the end of the chain
   refuses rather than falling back to name discovery, because discovery is exactly
   what an entry naming its own file declined. The resolution chain is, in order: **`PLT_ROOT`**, seeded to the directory of
   the config file being read — v3's loader assigned it *after* `loadEnv`
   (`foundation/lib/configuration.js:512`), so it was defined in every config parse
   and is not something migrate can read from the environment it runs in — the
   worker-environment copy is the *runtime* root, a different value (see BC 20); then
   the **migration-time environment**; then **the env file v3 itself would have read
   for that config file**; then the value in **`.env.sample`** if one exists; then the
   conventional **`<autoload.path>/<id>` directory** if it exists on disk.

   That third rung is per-file, not per-project, and it is the vendored `loadEnv` that
   decides it rather than a rule of migrate's own. v3 skips the search entirely when
   the config declared an `envfile` (`foundation/lib/configuration.js:349-357`);
   otherwise it walks up from **that config file's own directory** and stops at the
   **first** `.env` it finds (`:361-371`), falling back to `process.cwd()/.env` when
   the walk finds none (`:373-380`). Calling that "the root `.env`" — as an earlier
   draft did — is wrong twice over: it reads the wrong file whenever an intermediate
   directory has one, and it has no answer at all for a project whose only `.env`
   sits in neither place. Reusing the closure also gets the precedence right for
   free, since v3 layers the real environment *over* the file rather than under it
   (`:383-393`), which is the order the two rungs above already have. This is the one place migrate reads the ambient environment to decide
   *structure* rather than to preserve a value, and the report says which link in the
   chain supplied each one.

   Seeding `PLT_ROOT` is not optional: `path: '{PLT_ROOT}/services/api'` and
   `autoload: { path: '{PLT_ROOT}/web' }` are shapes v3 supported and its own
   generator emitted (`generators/lib/utils.js:94,106` pre-`e2da15eda`). Without the
   seed the first resolves empty and the second resolves to an absolute `/web`
   outside the project.

   That matters most for the shape **`wattpm import` writes**: with `--useEnv` it
   emits `{ id, path: '{PLT_APPLICATION_<ID>_PATH}', url }` and appends
   `PLT_APPLICATION_<ID>_PATH=` to `.env` — **empty** for a remote application that
   has not been resolved (`wattpm-utils/lib/commands/external.js:321-349`, the
   variable named by `applicationToEnvVariable`, `foundation/lib/cli.js:212-214`).
   Converting that naively yields `path: ''`, which resolves to the project root,
   where per-app discovery finds the root config and raises "configured twice".
   Instead: a **`url`-bearing entry whose path resolves empty keeps its `url` and
   loses the path entirely** — `{ id, url, gitBranch? }` — which is exactly the
   unresolved shape v4 backfills from `resolvedApplicationsBasePath` and which
   discovery already skips (see "`wattpm resolve`"). A **non-`url`** entry whose path
   resolves empty **after every link in the chain above** is a pre-flight stop naming
   the entry, the variable and what was tried — because an empty path there silently
   means the project root. The fallbacks matter because the empty case is the
   *normal* state of a project `wattpm import --useEnv` produced: it writes the value
   into `.env`, which the scaffolded template gitignores, so a clean clone — what CI
   and every new contributor has — never has the variable.
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
   still never changed); asks for consent once and **runs the install itself with
   lifecycle scripts suppressed** (`--ignore-scripts` or the package manager's
   equivalent), with the lockfile joining the migration transaction
   (`--install`/`--no-install` for non-interactive runs; `--no-install` stops
   after emitting files and manifests, prints the install command, and defers
   the rest to **`migrate --resume`** — which exempts exactly the persisted
   manifest's entries from the dirty-tree check, leaves emitted files the user has since
   modified untouched, reporting them, and continues at install/validation).

   **Nothing user-authored may execute between step 1 and step 5.** From the moment
   the first v4 file is written until the legacy files are deleted, the tree holds
   both dialects, which the loader refuses by design — so a `preinstall`,
   `postinstall` or `prepare` script that invokes `wattpm` (a build, a smoke test, a
   codegen step) would fail on a state migrate created and is about to resolve. That
   is why the install suppresses scripts rather than racing them. Once the tree is
   valid v4, **after step 5**, migrate runs a **deferred lifecycle pass** to execute
   what the suppressed install skipped — the native rebuilds and `prepare` steps —
   and reports it as a distinct step so a failure there is not mistaken for a
   migration failure.

   **That pass is not a second ordinary install**, and the difference is the whole
   reason it is named separately. An install run against a tree whose dependencies
   are already placed has nothing to place, and a package it did not place is a
   package whose lifecycle scripts it does not run — which is precisely why npm
   documents `npm rebuild` as the recovery from an install with `--ignore-scripts`
   rather than "install again". So the deferred pass is a **per-package-manager
   command**, pinned by a test per manager rather than assumed: the managers spell it
   differently, pnpm additionally gates dependency builds behind its own approval
   list, and yarn's spelling differs between its majors. The project's **own root
   lifecycle scripts** run alongside it, because they belong to the workspace rather
   than to any dependency and no dependency rebuild covers them — and they are the
   scripts most likely to invoke `wattpm`, which is what the suppression existed to
   protect in the first place. Deleting the legacy files earlier would empty
   the window instead, but at a worse cost: a validation failure would then leave a
   tree that boots on neither version, and validation failure is the one path that
   does not roll back.

   `--no-install` inherits the same rule: the command it prints carries
   `--ignore-scripts`, and `migrate --resume` runs the deferred pass after deletion.
   It leaves the tree in the **coexistence state** while it waits — v3
   and v4 configs side by side, which the loader refuses — and says so, with the same
   two ways out a validation failure prints: the path-scoped undo, or `--resume`. A
   **declined install consent** ends the run the same way and prints the same pair.
   `--no-install` **pre-records `package.json` and the lockfile** in the manifest,
   before pausing, as entries expected to change. Without that the pause is a trap:
   migrate's own step-2 edit puts `package.json` in the manifest, but the lockfile is
   written by the *user's* install afterwards, so it would be an unexplained
   modification and `--resume`'s dirty check would refuse the run it just told the
   user to prepare for. Pre-recording is honest bookkeeping rather than an
   exemption — those two files are part of the migration transaction either way, and
   rollback already restores both.

   **`--resume` runs the install itself**, so the transaction completes identically
   whether or not the user ran the printed command; an install against an
   already-installed tree places nothing, so doing it twice costs nothing and skipping
   it silently would leave validation to fail on missing dependencies. That is a
   statement about *installation* only, and it is the same property that makes the
   deferred lifecycle pass a different command rather than a repeat of this one.
   `--resume --no-install` opts out for users who manage installs themselves —
   offline, a private registry, a vendored `node_modules` — and validation then fails
   with a message naming the missing dependency rather than a schema error. An
   install failure aborts before anything is deleted. The **pre-flight check** stops
   the run with "hand-conversion required", naming what blocks it. This is the **one
   enumeration of every refusal** — Goal 6 defers to it, and a refusal introduced
   anywhere else in this document without appearing here is a bug in the document.
   Thirteen triggers. The first three bound what migrate may touch, what it may
   overwrite, and what it may produce; the rest are conversions it cannot perform
   faithfully. The count is stated once, here, and is the length of the list below —
   incrementing the number without adding the entry is the failure this sentence
   exists to make visible.

   **An application whose directory lies outside the migration transaction root**
   stops the run. The transaction root is the workspace containing the root config —
   the tree covered by one lockfile, one dirty-tree check and one install — and an
   application at `path: '../shared/api'` may sit in a different workspace, a
   different git repository, or neither. Migrate would have to write a per-app config
   there, edit its `package.json`, and install into it, while its own dirty check
   never protected that tree and its rollback could not reach it. That is the same
   situation a `url` entry is in, and it gets the same answer: named, listed as a
   project to migrate on its own, and re-run here afterwards. The format supports the
   layout; the codemod declines to mutate two independent trees in one transaction.

   ```
   ✗ cannot migrate: 'api' resolves to ../shared/api, outside this project.
     Migrate that project on its own, then re-run here.
   ```

   **The bound is every path migrate touches, not only application directories.** An
   entry's `config` is a structural position (see step 1) and v3 resolved it against
   the application's own path (`runtime/lib/config.js:270-271`), so an application
   *inside* the root may legally point at `../../shared/platformatic.json` — a file
   migrate would **read** to classify the application and **delete** in step 5, on a
   tree its dirty check never covered and its rollback cannot reach. That is worse
   than writing into another project, because a write at least leaves the original
   behind. So containment is tested over the whole set migrate touches: every
   application directory, every resolved `applications[].config` and
   `autoload.mappings[].config`, every `envfile`, and `resolvedApplicationsBasePath`.
   Each is canonicalized first and compared as a path rather than
   a string — the same distinction this document is careful about for `resolve`'s
   containment rule (see "Scope"), where a prefix match admits `/tmp/app-evil` as
   contained by `/tmp/app` and follows a symlinked ancestor straight out of the tree.
   Here it is a refusal rather than a skip: an external legacy config is not an entry
   migrate can quietly leave alone, because the application that names it still has
   to be converted.

   **Canonicalizing means the nearest existing ancestor, not the path itself**, because
   several of these legitimately do not exist yet. `resolvedApplicationsBasePath`
   defaults to `external` (`foundation/lib/schema.js:1545-1548`) and that directory is
   absent in every project that has never resolved a remote — which is most of them,
   and exactly the clean tree a migration runs on. Node's `realpath` throws on a
   missing path, so requiring it of the path itself would abort an ordinary migration
   with a filesystem error, or push migrate into creating a directory it promises not
   to touch (the resolution subtree is excluded from every step; see above). So the
   check walks up to the nearest ancestor that exists, canonicalizes **that**, and
   re-appends the remaining segments before comparing. Where the path does exist it is
   canonicalized directly, which is what catches a symlink pointing out of the tree —
   the case the canonicalization was introduced for. Both are preflight tests: an
   absent `external`, and a symlinked one.

   The second is the one every emission depends on: **a v4 target that
   already exists**. Migrate emits a root `watt.config.*` and one per application
   unconditionally, so before writing anything it checks every target path *and every
   recognized sibling candidate* in those directories — a `watt.config.js` where
   migrate would write `watt.config.ts` is not a free pass, it is two v4 candidates in
   one directory, which the loader rejects. A stale `.wattpm-migrate.json` from an
   abandoned run counts too. Any of them stops the run naming the file.

   Without this check the failure surfaces at step 3, which does not roll back, so the
   tree is left holding both the v3 configs and migrate's output on top of whatever
   was there. Worse, a **gitignored** `watt.config.ts` overwritten this way is
   unrecoverable for the same reason a deleted one is: git never had it, and the
   manifest is gone on completion. The one exception is `--resume`, where a target
   existing *and* recorded in the manifest as migrate's own creation is expected —
   verified by the content hash recorded at creation, so a file the user edited in
   between is reported and left alone rather than silently replaced, which is what
   `--resume` already promises for emitted files.

   **Two producers for one target** stops the run for the same reason, one step
   earlier. v3 let two entries with distinct ids share an application directory,
   because each named its own config file: `{ id: 'a', path: 'web/svc', config:
   'a.json' }` beside `{ id: 'b', path: 'web/svc', config: 'b.json' }` is a legal v3
   project. v4 has one configuration file per directory, so both entries emit
   `web/svc/watt.config.ts` — the second write replaces the first, or step 3 fails
   with every file already on disk. The existing check cannot see it: it asks whether
   a target *already exists*, and neither of these does until migrate creates it. So
   emission builds a **canonical target-to-producers map before writing anything**,
   and refuses any target claimed by more than one entry, naming both and the file
   they would share. Refusal rather than a merge, because two v3 applications in one
   directory are two applications: the faithful v4 spelling puts their capability
   configuration inline on two root entries, which is a different project shape than
   the one the user has and not a rewrite migrate should pick unasked.

   **A legacy configuration migrate is not converting** stops the run for the
   third bound's reason, one door further along. Migrate deletes only the files it
   read, and the loader's legacy table is wider than the candidate set migrate looks
   in — every suffix and extension combination, `.tml` included — so a stale
   `platformatic.service.json` beside the file being converted survives the run and
   leaves a directory holding both dialects, which the loader refuses. It is refused
   rather than deleted, because a file migrate never read is one it knows nothing
   about: it may be the variant the project runs with `-c`, in which case deleting it
   would destroy the only copy of a configuration nobody asked to migrate. The
   exclusion is every path the run converts and not the one file each check is looking
   at, since a root-inline application's configuration legitimately sits in the root's
   own directory.

   The remaining nine: **any capability outside the vendored closure**; a **root `envfile`**,
   which has no faithful conversion; any application declaring `envfile` **in the
   root config's own directory** (see "Scope"); an application whose **`envfile` names
   a file that does not exist**; an **`enabled` value that decides the
   entrypoint differently for `production` and `development` or cannot be decided at
   all** (see the exposure rules in step 1); a **structural path that resolves to
   nothing** after the fallbacks above; **two application ids that collide once
   renamed**; **one variable occupying two positions whose schema constraints do
   not intersect, or whose combination migrate cannot decide**; and a **directory
   `resolve` cloned into that also holds a local application, a file migrate must
   read, or a path it plans to emit** — a project whose remote checkouts and own
   sources share a directory, where the exclusion that protects the clone would
   otherwise swallow work the run has to do (see step 1). **Its message is built from
   the two paths involved, not from a fixed pair of suggestions**, because the
   destination has two possible producers and the overlap has several possible shapes.
   Where the destination was **backfilled**, `resolvedApplicationsBasePath` is what put
   it there and changing it is the fix. Where the entry **declares a `path`** —
   `{ id: 'remote', url, path: 'vendor/shared' }` — the base is irrelevant and changing
   it accomplishes nothing; the fix is that entry's `path`. And the thing being
   swallowed is named as what it is: a local application to move, an `envfile` or
   legacy config to relocate, or a planned output whose directory has to differ.
   Offering "move the local application" for a swallowed `envfile` under a declared
   path would send the user through the identical refusal twice, which is the failure
   mode a fixed suggestion has and a derived one does not. The test is a **non-empty
   intersection of every applicable constraint**, not equality of primitive types —
   matching types are not sufficient, and the shipped schemas prove it: `packageManager`
   (`["npm","pnpm","yarn"]`) and `logger.level` (`["fatal"…"silent"]`) are both
   `string` with **no** member in common, and `managementApi.logs.maxSize`
   (`minimum: 5`) and `workers.scaleUpELU` (`0…1`) are both `number` with an empty
   range intersection. A `{PLT_X}` used at either pair admits no value that validates
   at both, so step 3 could not validate its own output.

   **Positions are grouped by the environment that supplies them, not by variable
   name.** v3 read env files relative to each config file — `loadEnv` walks up from
   that file's own directory and stops at the first `.env`
   (`foundation/lib/configuration.js:361-371`) — so `web/a/.env` and `web/b/.env` can
   legitimately give one key two meanings, and v4's per-app eval workers keep exactly
   that separation. Intersecting every `{SETTING}` in the project would refuse a
   correct one for a collision that was never a collision: `SETTING` in `web/a` under
   an enum and `SETTING` in `web/b` under a numeric range are two variables that
   happen to be spelled alike. So migrate resolves, per position, **which file would
   have supplied that variable for that config file** — the vendored `loadEnv` answers
   this already, and it is the same walk the structural paths use — and intersects
   only within a supplier. A variable coming from the real environment, or from a file
   both positions reach, *is* intersected across all of them, because there the one
   value is real and every position genuinely sees it. Seeding follows the same
   grouping: a sentinel is only ever needed for a position no file supplies, and a
   supplier-scoped conflict is reported with the files, not just the paths.

   **The intersection is computed over a named, closed subset of JSON Schema, and a
   combination outside it refuses rather than being guessed at.** AJV validates a
   candidate; it does not intersect constraints or produce a witness, so this is
   migrate's own arithmetic and its reach has to be stated rather than assumed.
   Inside the subset: `type`, `enum` and `const`, the numeric bounds with
   `multipleOf` and integer-ness, `minLength` / `maxLength`, and `pattern` **only
   while at most one position constrains it** — one pattern is a filter a witness can
   be tested against, two are a question about regular-language intersection that a
   migrator has no business answering. Outside it, and refusing:
   `anyOf`, `oneOf`, `not`, `format`, and any keyword a later audit adds without
   extending this list, the message naming the variable, both positions and the
   keyword that stopped it. The refusal is deliberately wider than the impossibility —
   it fires when migrate cannot *prove* a shared value exists, not only when none
   does — because the alternative is a sentinel that step 3 rejects after every file
   has been written, which is the one failure that does not roll back.

   **The witness is preferably found, not invented.** Where the variable already has a
   value — in the migration-time environment, or in `.env.sample` — that value is
   tested against every position it occupies, which is cheaper than synthesis and
   answers the question the project actually has. Synthesis runs only when no value is
   supplied, and only over the part of the subset that can be enumerated: a member of
   the surviving `enum`/`const` set, or a number satisfying the bounds and
   `multipleOf`. A position carrying a `pattern` with no supplied value refuses rather
   than having a string invented for it. The subset is affordable to close because the
   audit deletes the placeholder-only unions first: what a `{PLT_X}` can still land in
   after that is a much smaller schema surface than v3's.

   **An embedded placeholder is one witness, not several.** `"{PREFIX}{LEVEL}"` in an
   enum position becomes a template literal, and two separately valid sentinels need
   not concatenate to a member of that enum — nor does a per-variable record
   (variable, JSON path, target type) hold enough to notice, since it has thrown away
   the fact that the two share a position. So the record keeps the **whole
   interpolation** wherever a position has one, and the test is a **joint** witness:
   the concatenated result must validate there. Where the position is a free-form
   string with nothing beyond `type`, any witness works and there is nothing to prove.
   Where it is constrained — an enum, a pattern, a length — and no joint witness can be
   produced from the values the project supplies, that is a pre-flight refusal naming
   the position and the expression, on the same ground as everything else here: better
   than a sentinel step 3 rejects once every file is written.

   **The guard applies to the interpolated result, not to each component.** Per-variable
   `requiredEnv` would reject an empty `{PREFIX}` that v3 was perfectly happy with —
   v3 interpolated `''` and the surrounding string still had to validate, so a
   component may legitimately be empty while the whole value is not. Migrate therefore
   emits the components with the plain `?? ''` fallback and wraps the interpolation
   once, with a `requiredValue(expression, names)` helper that throws naming **every**
   variable in it. Two helpers rather than one, and only in projects that have an
   embedded placeholder in a typed position — the single-position case keeps
   `requiredEnv` unchanged, and a diagnostic that names one of two variables when
   either could be the empty one is not worth the saving.

   That constraint test is computed from the lexical view like the
   rest, which is what lets it stop the run *before* any file is written rather than
   surfacing at validation. It
   executes **before step 1 writes anything**: it needs only read-only analysis —
   the lexical view's module list and `enabled` values, the resolved structural
   paths, a filename-existence check on the targets, and where each resolved path
   sits relative to the transaction root — with the module list
   normalized through the
   **rename table first** so a
   `@platformatic/composer` app is measured as `@platformatic/gateway` and passes.
   That normalization is **scoped to this gate**: the exposure rules in step 1
   classify on the raw module identity, because v3 did (see the entrypoint
   resolution above), and sharing one normalized list between the two would silently
   move a migrated project's public address.
   "Stops before modifying any file" must be literally true.

   **The missing `envfile` is a refusal because v3 tolerated it and v4 will not.**
   v3 read an application's env file inside a `try`/`catch` and carried on when it was
   not there — the comment says "Ignore if the file doesn't exist, similar to dotenv
   behavior" (`runtime/lib/worker/main.js:252-262`) — and that applied to a *declared*
   `envfile` exactly as it did to the conventional `.env`. v4 makes an explicitly named
   missing file a load error (see "Env files"), on the grounds that naming a file you
   do not have is a mistake worth hearing about. Both positions are defensible; the
   combination is not, because it means a working v3 project converts into a
   configuration that refuses to load. Detecting it needs one `existsSync` per declared
   `envfile` against the resolved path, so it belongs here rather than at step 3, where
   the failure would arrive after every file was written and does not roll back. The
   message gives the two fixes the user has to choose between — create the file the
   declaration meant, or drop the declaration — and, for the second, names the
   conventional `.env*` files v4 would then activate in that directory, since removing
   a declaration is not a no-op when the four-file convention takes over from it.

   **The rename collision earns its own note**, because it is the only refusal that
   fires on a project no v3 rule ever declared invalid. Migrate rewrites an id that is
   not a legal v4 label — `my_app` becomes `my-app` — and a project already holding a
   `my-app` then has two entries under one id: a configuration the emitted form cannot
   express, which step 3 would catch only after every file was written. The rename is
   mechanical, so the collision is too, and it is computable from the ids alone in the
   lexical pass, which is what puts it here rather than at validation. The message
   names both entries and asks for an explicit `id` on one of them — the fix in every
   case, and the one thing migrate must not choose on the user's behalf, since the id
   it picked would become a hostname somebody has to know.

   **The refusals have a companion set: the reported divergences.** These are
   conversions migrate performs even though the result behaves differently from v3,
   each carrying a *requires-review* note. They are enumerated here for the same
   reason the refusals are — a *conversion* that diverges without appearing in this
   list is a bug in the document:

   - a placeholder whose value came from an **`env` block**: v4 keeps blocks out of
     config evaluation, so the expression yields `''` where v3 yielded the block's
     value;
   - **every `env` block key migrate carries over**, whose precedence inverts: v3
     applied blocks over the environment, v4 applies dotenv order, so the real
     environment now outranks the block. Nothing about the key changes — same name,
     same value, same place — which is why it is easy to omit from a list like this
     one, and why every carried key gets the warning (BC 18);
   - a **string position under effective `strictEnv` whose variable is set to the
     empty string**: v3 replaced it with `''` and let the schema accept it, while
     `requiredEnv` treats empty as missing and throws. This is the only position
     where the guard is stricter than v3;
   - a **structural path recovered from a fallback** — `.env.sample`, or the
     `<autoload.path>/<id>` convention — rather than from a value the project
     actually supplied;
   - a **v3 id that is not a legal v4 DNS label** (`my_app` → `my-app`): v3 imposed
     no grammar, and keeping the v3 spelling would emit a configuration that cannot
     load, so the id moves and the note records both spellings. **References move with
     it where migrate owns them, and are reported where it does not.** Inside the
     configuration migrate rewrites every occurrence — sibling `dependencies` entries
     and any capability option naming an application, the gateway's
     `applications[].id` being the one that matters in practice — because a renamed id
     with a stale reference beside it emits a configuration that validates and then
     routes nowhere, which is worse than the id it replaced. Outside it an id is a
     mesh hostname (`http://my_app.plt.local`), a metrics label and the argument
     `wattpm inject` takes, so the step 4 source scan looks for the old spelling and
     reports each hit with file and line, on the same ground as the other identifiers
     it will not rewrite in user code. The injected `PLT_<ID>_URL` name is the one
     thing that does *not* move: normalization uppercases and folds every
     non-alphanumeric run to `_`, so `my_app` and `my-app` were always both
     `PLT_MY_APP_URL`;
   - an **`entrypointPort`** that is dropped, and any **root `server` key the target
     capability's `server` schema does not admit** — `keepAliveTimeout` for the basic
     family, `http2` for nitro (see rule 1).

   **The list is scoped to conversions, and the scope is the distinction it turns
   on.** v4 also changes behavior for projects that were never migrated at all —
   `build` resolving `enabled` against production (BC 17), `NODE_ENV` defaulting to
   `production` under `build` (BC 20), the env-file discovery rewrite that makes a
   pre-existing `.env.local` live (BC 5) — and those belong to the breaking-change
   list, because migrate neither chose them nor could decline them, and a
   per-project note would imply otherwise. What migrate owes for them is **evidence,
   not enumeration**: the run ends by naming the breaking changes its own scan found
   this tree standing in front of — an `.env.local` or mode file sitting in a
   directory the new layering now reads, an `enabled` object that `build` will resolve
   differently, a `process.env.NODE_ENV` read in a build script that the step 4 source
   scan already walks the sources for — each with the file and the BC number. A
   project with none of them reads a shorter report, which is the point: the BC list
   is exhaustive and therefore unreadable, and the run is the only thing that knows
   which of its entries apply here.

   Refusal is not the better answer for any of the divergences: each is a conversion an
   ordinary v3 project needs, and each has an outcome the project can live with once it
   is told. The line this document holds is therefore narrower than "always faithful"
   and keepable: **migrate never converts silently.** Two conversions that used to sit
   in this list — the number- and enum-position placeholders — left it by becoming
   faithful rather than by being excused, which is the better way for an entry to
   leave. The
   gate is deliberately about closure membership, not v4 readiness: without a
   frozen v3 schema, upgrade chain, and target-type table, migrate cannot upgrade
   that app's config or decide whether `"{ACME_PORT}"` is a number, boolean, or
   string position — which matches Goal 6's stated scope ("anything that boots on
   v3 **with in-tree capabilities**"). A documented contribution point — a
   capability shipping its own frozen `{ schema, upgrade, targetTypes }` bundle —
   is a possible post-4.0 addition.
3. **Validate the emitted files by explicit path**: migrate loads the generated
   configuration through the real v4 loader via a **private, migrator-only
   direct-path entry** that skips **the upward walk and the legacy-coexistence
   guard only** — the legacy files are still present at this point by design.
   Everything else runs: per-app discovery, `autoload` expansion, the per-app eval
   workers, the capability detector, capability validation, and the version-stamp
   check. (Skipping *discovery* would leave multi-app output — where migrate does
   most of its work — validated only at the root.) Entries whose directory is not
   present — a `url`-bearing application on a checkout that has never been
   resolved — validate as **unresolved** and are skipped, exactly as they are at
   load time. So are entries whose backfilled path falls inside
   `resolvedApplicationsBasePath`: the loader computes that path itself
   (`runtime/lib/runtime.js:2595`), so a `wattpm resolve`-d clone *does* exist on
   disk, and discovery would walk into another repository's v3 configuration — which
   migrate deliberately did not convert — and fail on output that is correct. That is
   the fourth deviation of the migrator-only entry; migrate must not require `wattpm resolve` to have been run first, and
   reports the unresolved list in its summary. This bypass is *not* the **loader's**
   public `--config` flag: that one performs the full unconditional legacy scan of
   the selected directory and every discovered app directory, so it can never be used
   to sidestep the no-coexistence guard. (Nor is it `migrate --config`, which selects
   migrate's *input* and reads legacy names only.)

   **Validation seeds the environment for every variable the emitted files reference
   that is not already set**, not only `requiredEnv`-wrapped ones. Migrate records
   each placeholder-derived position during the lexical pass — variable, JSON path,
   target type, **the supplier that would have fed it, and the whole interpolation
   where the position has one** — so it seeds each variable with a sentinel drawn from
   the
   **intersection of the constraints at every position that variable occupies**, not
   from any one of them: a member common to all enums, a number inside every range and
   satisfying every `multipleOf`/integer constraint, the secret's placeholder for a
   `requiredEnv` key whose helper would otherwise throw. The intersection is what the
   pre-flight already computed to decide the variable was usable at all, so the two
   steps agree by construction rather than by coincidence. This is the third documented deviation of the migrator-only
   entry, alongside the skipped walk and coexistence guard.

   Two constraints on the seeding, both of which change what it may touch. It seeds
   only variables the environment does **not** already supply: the real environment
   outranks env files in v4, so seeding unconditionally would validate the emitted
   files against migrate's fabrications instead of the values the project actually
   configures — inverting the guarantee that step 3 checks the output through the real
   loader. And a variable whose positions have **no common value** admits no single
   sentinel — the constraints are intersected, not the primitive types, since two
   `string` enums can be disjoint and two `number` ranges can fail to overlap — so
   that is a pre-flight refusal naming the
   variable and both paths, not a coin toss resolved at validation time.

   **The record is persisted in the manifest**, because `--resume` skips the lexical
   pass that produced it. Without that, the documented non-interactive flow —
   `--no-install`, then `migrate --resume` — reaches step 3 with no seeds, `''` fails
   the audited enum, and the failure prints "run `migrate --resume`" as a remedy,
   which fails identically forever.

   Without it step 3 fails on migrate's *own* correct output. The variables in
   question are deployment variables, absent from the laptop running the codemod —
   the document says so where it explains why every `env`-block key is warned about.
   A v3 project whose generator wrote `logger: { level: '{PLT_SERVER_LOGGER_LEVEL}' }`
   (the default — `service/lib/generator.js:418-420` pre-`e2da15eda`) emits
   `process.env.PLT_SERVER_LOGGER_LEVEL ?? ''`, and `''` is not a member of
   `logger.level`'s enum once the audit drops its placeholder pattern branch. Step 3
   would reject it, and a validation failure does not roll back — stranding the tree
   in the coexistence state with nothing actually wrong. The summary reports the
   seeded variables so the user knows which values were assumed rather than checked.
   A validation failure is
   the **one failure that does not roll back**: its whole value is the emitted
   output, so migrate keeps the files, reports what failed, and stops. It says
   plainly that the tree is now in the coexistence state — v3 and v4 configs side by
   side, which the loader refuses — and prints both ways out: the path-scoped undo
   from the manifest, or fix the reported problem and run `migrate --resume`.
   Nothing has been deleted, so neither direction loses anything.
4. Scan application sources — one walk, four things it is looking for: references
   to the legacy config files (v3 scaffolded test helpers do `JSON.parse(await
   readFile(…, 'watt.json'))`); `PLT_DEV` / `PLT_ENVIRONMENT` / `PLT_ROOT` reads (all
   three injected variables are removed in v4); the **old spelling of any id migrate
   renamed**, which is a mesh hostname and a metrics label out here; and
   `process.env.NODE_ENV` reads in build scripts, which BC 20 changes under `build`.
   Every hit is reported with the file/line of the reference, since the codemod cannot
   safely rewrite user code and the change will make that code fail or branch
   differently. The first two are divergences of migrate's own making; the last two
   are the evidence half of the breaking-change report below.
5. **Delete every legacy file migrate read** — not only the recognized
   `platformatic.json`/`watt.json` names but each custom filename a v3
   `applications[].config` or `autoload.mappings[].config` pointed at, recorded during
   the lexical pass from the resolved structural positions, since v3 accepted any name
   in either and leaving one behind preserves exactly the coexistence state this step
   exists to end.

   **The transaction commits here** — when the last legacy file is gone and before
   anything else runs. That is the point where the tree is a valid v4 project and
   every file migrate meant to write or delete is written or deleted; nothing after
   it can make the conversion less true. Naming it matters because the next thing
   that happens is user code, and without a commit point two rules would both claim
   it (see the rollback rule below): a failing `postinstall` would be a mid-run
   failure *and* a completed migration at the same time.

   **Then run the deferred lifecycle scripts** (step 2 suppressed them): the tree is
   now valid v4, so a `postinstall` or `prepare` that invokes `wattpm` sees a state it
   can load. This runs **after the commit**, is reported as its own step, and a
   failure in it rolls nothing back — the configuration is converted; what failed is
   the project's own build, and the summary says which of the two it was. Finally,
   print a summary. There is no rename, no
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
   a **manifest of every file it created, modified or will delete, storing the pre-edit
   *contents* of everything it modifies and everything it deletes, and a content hash
   of everything it creates** (which is what lets `--resume` tell its own output from
   a file the user has edited since, and the pre-flight tell it from an unrelated
   pre-existing target) — plus, under `--no-install`,
   the `package.json` and lockfile the deferred install will touch**, persisted as
   `.wattpm-migrate.json` for the life of the run (it is what `--resume` reads, it
   exempts *itself* from the dirty check, and it is deleted on completion). Because it
   holds verbatim legacy configuration — including any credentials those files carry —
   it is written **atomically, owner-only, without following symlinks**, and added to
   `.gitignore` if one exists; its lifetime is the run, and nothing reads it
   afterwards. It also
   records everything computed during the **lexical pass** that a later step needs,
   because `--resume` skips that pass: the **legacy-deletion set** — including custom
   filenames a v3 `applications[].config` pointed at, without which a resumed run
   could not complete step 5 — and the **placeholder-position record** step 3 seeds
   from. **That record is the analysis, not a summary of it**, because `--resume`
   skips the lexical pass that produced it and step 3 must reach the same verdict the
   pre-flight did. Four things go in per position, and each corresponds to a rule
   above that a thinner record would silently undo: the **supplier** — which env file,
   or the real environment — since constraints intersect within a supplier and not
   across the project, and a record keyed on variable name alone would re-merge two
   app-local `SETTING`s a resumed run had no business merging; the **whole
   interpolation** and its component variables, since an embedded placeholder is one
   joint witness and per-component seeds need not concatenate into a legal value; the
   **constraint set and the witness or sentinel actually chosen**, so a resumed run
   validates against the value the pre-flight accepted rather than re-deriving one;
   and whether that value was **supplied or synthesized**, since seeding must still
   skip variables the environment already provides. The manifest schema is versioned
   and round-tripped in tests, with two cases named because they are the ones a
   thinner record passes: two app-local values sharing a key under disjoint schemas,
   and a multi-variable interpolation in an enum position. On a failure
   **before the commit point** and **other than validation**
   it removes its own creations automatically, and on success the summary prints
   the exact path-scoped undo (`git restore <tracked…> && rm <created…>`) — never
   a bare `git restore .`, and never any form of `git clean`. Stored contents make **mid-run** rollback work without git: step 2 modifies
   `package.json` and the lockfile and step 5 deletes the legacy configurations, so
   on a tree with no version control there is nothing for `git restore` to restore,
   and migrate could otherwise delete what it created but not undo what it edited —
   leaving exactly the "v3 configs and an installed v4 runtime that refuses them"
   state this step exists to prevent.

   **After a successful run there is no undo outside version control, and the summary
   says so.** The manifest is deleted on completion, so the stored contents go with
   it. That is deliberate rather than an oversight: the manifest holds the verbatim
   contents of legacy configurations, which is precisely where credentials live, and
   leaving a plaintext copy on disk indefinitely to enable a rarely-used undo is the
   worse trade. **The printed undo ends with the package manager**, because restoring
   files does not restore `node_modules`: step 2 installed the v4 dependency tree, and
   a tree with v3 configurations restored under an installed v4 runtime boots on
   neither version. This is the same reason failure rollback re-runs the package
   manager (below), and it applies identically to a successful run undone by hand. So
   the summary prints the detected manager's command as the last step and does not
   describe the undo as complete without it. On a `--force` or no-VCS tree it is not
   complete even then, and the summary names what is unrecoverable:

   ```
   ✔ migrated 3 applications
     to undo: git restore <tracked…> && rm <created…> && pnpm install
   ! web/api/platformatic.json was untracked and has been deleted; --force means
     this cannot be undone. The command above covers the rest.
   ```

   This is what `--force` already signified. The dirty-tree check refuses an
   untracked or gitignored legacy file *specifically* so the user has to confront
   that it cannot be restored, and overriding it is the acknowledgement. A failure *after*
   step 2 also **re-runs the package manager against the restored lockfile**,
   reporting the exact command if that fails: restoring `package.json` and the
   lockfile does not undo what the install wrote to `node_modules`, and a tree left
   with v3 configs and an installed v4 runtime that refuses them boots on neither
   version. That restoring run executes lifecycle scripts normally — the legacy
   configuration is back in place by then, so a script invoking `wattpm` sees the v3
   tree it was written for.

(No `.env` *file* conflict warning is needed — app-wins layering preserves v3's
observable file precedence; the `env`-block precedence change has its own
per-key warning in step 1.)

Because migration emits the per-app style, dependency *placement* is never
changed — the only `package.json` edits are the consented dependency changes from
step 2: the v4 range bumps, missing app-local capability entries, the root
`wattpm` dependency, and removal of a capability superseded by a rename.

---

## Breaking changes (v4)

1. `runtime` wrapped block in capability configs: **removed** (`wrapInRuntimeConfig`,
   `wrappedRuntime`, both exclusion lists, and `_runtime-in-capabilities.md` deleted).
2. `web` and `services` aliases: **removed**; `applications` only.
3. **All non-code config formats removed** — JSON included. Any `.json` config file is
   refused with the migrate hint. `getParser`/`getStringifier` and the format
   machinery are deleted from the loader.
4. `{PLT_X}` interpolation, `strictEnv`, root `envfile`: **removed**. Migrate
   converts the first two; a root `envfile` has no faithful conversion and is one of
   the refusals its pre-flight check enumerates.
5. Env files: the recognized set grows to `.env`, `.env.local`, `.env.<mode>`,
   `.env.<mode>.local`, and layering reads **root and app files together** where
   v3's first-hit walk read exactly one file. This is a **behavior change**:
   pre-existing `.env.local`/`.env.production` files written for *other* tools
   (Next.js uses exactly these names) become live in worker environments. The
   `.env` **discovery changes in four ways**, and this is the item to read if you
   keep environment in files. v3 took the **first** `.env` found walking up from the
   config file's directory (`foundation/lib/configuration.js:362-371` — it `break`s),
   plus the application's own applied worker-side with no walk
   (`runtime/lib/worker/main.js:239`), plus a `process.cwd()` fallback when the walk
   found nothing (`foundation/lib/configuration.js:373-380`). v4 instead **layers every** `.env` from a config
   file's own directory up to the **env root** — the outermost `watt.config.*` above
   it — so (1) intermediate directories now participate, (2) no file shadows the ones
   above it, (3) the mode variants above multiply each directory's set, and (4) the
   cwd fallback is gone. Precedence direction stays v3-compatible (nearer overrides
   further; the real environment always wins), and a project with a single root
   `.env` sees no change at all.
   The `env` blocks are **no longer visible during config evaluation** at any
   position — v3 applied them to `process.env` before the worker parsed the app's
   config, so a v3 placeholder reading a block-supplied key resolved then and
   resolves to `''` now. Blocks continue to configure the running application
   unchanged. Migrate reports every such placeholder rather than emitting a silently
   empty expression (see "Migrating from v3"); a value that must be readable at
   config time belongs in an env file or the real environment.
6. `verticalScaler`: removed from the v4 schema. `metrics.healthChecksTimeouts` is
   **kept** — it is not a top-level key and is not dead: `#getHealthChecksTimeout`
   reads it (`runtime/lib/runtime.js:4859-4866`, falling back to `healthChecksTimeout`
   then 5000 ms) and extension health checks are configured through it. Its schema
   description still says "no longer used", which the audit corrects.
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
    for non-static shapes; for `configPath: null` it materializes a root file for a
    synthesized runtime and refuses for a programmatic one, checked before the live
    mutation, and publishes the file **after** the live change with a no-clobber create,
    rechecking every recognized candidate first, so the watcher reload it triggers
    converges rather than races and a concurrently authored config is never replaced).
    Tests cover add and remove against a synthesized runtime and an object-backed one,
    both watcher orderings, a failing live start and a failing publish, same-target and
    sibling-suffix races, a changed `PLT_<ID>_PORT` after materialization and reboot,
    and CommonJS and ESM materialization — including that a save which cannot happen is
    not reported as an atomic success.
12. Capability CLI commands (`db:*`, `gateway:*`, `next:*`): the `createCommands`
    contract changes from config-file-path to `{ root, config }` data; commands no
    longer self-load config, and the `utimesSync` restart trick is replaced by a
    management-API restart.
13. Management API `GET /config`: removed (watt-admin coordination required; the
    `wattpm` commands built on it are handled per items 10–12).
    `GET /api/v1/applications/:id/config` **stays.** It is the HTTP surface of
    `getApplicationConfig()` — a worker's post-`transform` view, which nothing in the
    new payload replaces and which the runtime itself calls (see "Machine-generated
    configs" and item 14). Its one departing caller, `patch-config`, goes for the
    unrelated reason in item 9.
14. Worker boot protocol: workers receive `resolvedConfig` (data) instead of a config
    file path; per-worker config parsing is deleted. Everything typed as
    "config file path" changes accordingly: the application entry's `config`
    property no longer accepts a path (it takes an inline definition),
    `autoload.mappings[].config` (a filename) is removed, and
    `getRuntimeConfig`/`getApplicationDetails` payloads carry `configPath` +
    `resolvedConfig` as a versioned DTO instead of a bare path — a declared type
    change for every management-API consumer, separate from patch-document
    compatibility (which is preserved). The DTO stamp is `definitionVersion`, not
    `version`, which `getApplicationDetails()` already uses for the capability version
    the running worker loaded. `getApplicationConfig()` is **not** in this
    change: it returns a worker's post-`transform` view over ITC and keeps its shape
    (see "Machine-generated configs").

    **`getRuntimeConfig(includeMeta: true)` is removed**, which is a separate breaking
    change from the payload above and is listed here because a legal call disappears:
    it is a declared public overload today (`runtime/index.d.ts:393`) returning live
    `#config` with its `kMetadata` symbol attached, which the frozen-copy contract
    cannot honour (see "Machine-generated configs"). Its replacement is a metadata
    accessor rather than a flag — `runtime.getRuntimeMetadata()` extended with
    `configPath` and `autoload` beside the `projectDir` it already returns, and
    `@platformatic/control` gaining the matching client method over `GET /metadata`:

    ```ts
    interface RuntimeMetadata {                 // additions to the existing shape
      projectDir: string
      configPath: string | null                 // null for object config sources
      autoload?: { path: string, exclude?: string[], mappings?: Record<string, unknown> }
    }
    ```

    That is what the callers actually consumed: `applications:add`/`remove --save`
    read `root` and `configPath` out of `kMetadata`
    (`wattpm/lib/commands/applications.js:33,112`), never the configuration the
    overload wrapped them in.
15. Capability packages must implement the v4 create contract (resolved config as
    data) and should export a factory (all in-tree capabilities get both); plain
    `{ module }` objects cover v4-contract capabilities without factories.
    Capabilities frozen on the v3 contract are unsupported.
16. Validation runs with `coerceTypes: false`: values that relied on AJV coercion
    (`"4"` as a number, `1` as a boolean) are rejected with precise errors.
17. `wattpm dev`/`build`/`start` become **location-sensitive**: run inside an
    application directory that **owns a config file**, they act on that application
    standalone — with a warning whenever a `watt.config.*` exists in an ancestor,
    naming what is not applied; v3 booted the whole runtime from anywhere. The search
    runs from the current directory up to the nearest ancestor holding a
    `package.json` and stops there, so it does **not** fall through to a config
    higher up the tree. A directory with no config file of its own still boots by
    zero-config synthesis where the detector recognizes it; when a `watt.config.*`
    exists in an ancestor, the boot warns that nothing that file says is applied
    here.
    Passing `--config` names the configuration and boots **whatever that file
    describes** — the full runtime for a root config, one application for an
    app-def — which is
    the sanctioned fix for a deploy script whose working directory is an
    application directory.
    Scope is otherwise purely positional — the runtime-wide behavior means running
    from the project root, and there is still no `--all`; `--config` is not a scope
    selector but naming the configuration necessarily makes cwd stop being one. A
    build uses the application's full resolved environment, as its workers do, with
    no rung excluded — injected `PLT_<ID>_URL` values included, since a bundler
    inlining `process.env.PLT_API_URL` would otherwise bake `undefined`; a
    **standalone**
    build sees no root orchestration, so it applies neither the root
    `env` block nor a root-entry `envfile`. Under `build`, `production` is `true`,
    so `enabled` resolves against the production mode where v3's build resolved
    against development.
18. Worker env precedence: config `env` blocks **no longer override the real
    environment** — v4 follows the dotenv convention (the real environment is
    always authoritative; blocks beat injection and files, nothing beats the
    real environment). v3 applied blocks last, as pins; migrate warns for every
    carried-over block key, and the runtime logs once when a block key is
    suppressed by the real environment.
19. **`entrypoint`, the root `server` block, the entry-level `server` block,
    `useHttp` and `application.entrypointPort` are all
    removed** — the runtime has no
    listener of its own, and each application exposes itself through its own
    capability configuration (see "How applications are exposed"). The v4 upgrade
    chain deletes `entrypoint`, the root `server` and every per-application
    `server` (`runtime/lib/versions/v4.0.0.js:16-27`), while preserving a
    standalone
    application config's capability-owned `server` (`:10-14`), and `upgrade()`
    warns when a root `server` is discarded (`runtime/lib/upgrade.js:16-19`).
    `entrypointPort` leaves the **capability** schema
    (`basic/lib/schema.js:61-63` pre-`3c92a2a64`), and **no upgrade chain removes it**: `v4.0.0.js`
    returns early for a non-runtime `$schema` (`runtime/lib/versions/v4.0.0.js:12-14`) — exactly the capability
    configs the key lives in — and the basic-family capabilities have no `versions/`
    directory at all. So **migrate strips it** while emitting a requires-review note
    naming each entry that carried one, because a project relying on it to advertise
    a proxied port now reports the port it actually binds. An **in-place** v3→v4
    upgrade that does not run migrate has nothing to strip it, and fails validation
    on `additionalProperties` — which is the intended loud failure, not a silent
    one.
    **`server.portAssignment` is not removed — it relocates.** `e2da15eda` deleted
    it with the root `server` block, but `perWorkerIncrement` is the only way to run
    `workers > 1` on a fixed port without `SO_REUSEPORT`, which macOS and Windows
    lack entirely. It returns as a **capability** `server` key, where the port now
    lives — restored on `v4` by `468c64604`. Migrate carries a v3 value across
    unchanged.
    **`useHttp` is the exception: the chain does not delete it**, and
    `applications.items` does not set `additionalProperties: false`, so it survives
    validation as a key nothing reads — an in-place upgrade leaves `useHttp: true`
    silently inert. Migrate is what turns it into the v4 spelling, and the
    requires-review note it emits is the only signal a user gets.
    Consequences: a **managed** listener opens iff the capability's `server.port`
    is defined, so an application with no `server` block opens no socket — whether it
    still serves the mesh is capability- and mode-specific (see the matrix in "How
    applications are exposed"). An application that would serve **nothing** is refused
    at load rather than booted into silence: that is a framework capability under
    `dev`, and `next`/`nitro`/`nuxt`/`tanstack` under `dev` or `start`, in each case
    with neither a port nor a command for that mode — **excluding the
    worker-classified rows**, `node` and Vite with SSR enabled, which are never
    refused at load (a custom command starts the
    application itself, and the runtime observes what it binds). The check is a
    `dev`/`start` startup rule; `build`, `exec`, migration validation and inspection
    impose no such requirement; `server: { port: 0 }` is the
    v4 spelling of `useHttp` and what the gateway's WebSocket diagnostics now
    point at; and entrypoint auto-detection — explicit key, single application,
    single gateway — is gone entirely, along with `InvalidEntrypointError`,
    `MissingEntrypointError`, `CannotRemoveEntrypointError` and the programmatic
    `allowMissingEntrypoint` escape. Migrate carries the v3 root `server` block
    into the v3 entrypoint's capability config and strips ports that were inert on
    v3, so no migrated project changes which address it answers on.
20. Injected variables: `PLT_DEV`, `PLT_ENVIRONMENT` and `PLT_ROOT` are
    **removed from worker environments** (the migrate source scan flags reads).
    `PLT_ROOT` is the one with two meanings: inside a configuration it was that
    config file's own directory, while application code read the *runtime root* from
    the worker environment — so its removal breaks reads in application code, and
    `import.meta.dirname` is a replacement only where the reading module sits at the
    directory the code meant; `PLT_<ID>_URL` injection
    now covers every application including the app's own self-URL. `NODE_ENV`
    remains, as the **lowest** rung of both ladders: it defaults to `production`
    when `production` is `true` and nothing else supplied it. Under `start` that
    matches v3 (`worker/controller.js:125-126`); under `build` it is **new** — v3's
    build passed no production flag (`wattpm/lib/commands/build.js:43` pre-`b1e03a5b9`), so
    builds ran with `NODE_ENV` unset and bundlers that branch on it will now
    produce different artifacts.
21. Per-application `envfile`: now governs **config evaluation and runtime
    alike**, resolves **app-relative** (v3 resolved against the runtime root —
    migrate rewrites paths), and naming a missing file is an error (v3
    silently ignored it). Declaring it on an entry that carries an inline
    `config` is an error — that entry has no per-app eval worker.
22. **Listener mechanics and reporting.** Multi-worker on a fixed port requires
    `SO_REUSEPORT`; where the platform lacks it the runtime warns and clamps the
    application to one worker after inspecting the first worker's listener
    (`runtime/lib/runtime.js:2628-2644`) — a start-time decision, not a
    configuration-format one. The
    **per-application `reuseTcpPorts` now reaches the `SO_REUSEPORT` decision**
    (`basic/lib/capability.js:105-110`, fed by `worker/controller.js:83`), where
    in v3 it only selected the restart strategy. Two applications binding the same
    port is a hard `AddressInUseError` naming both
    (`runtime/lib/errors.js:14-17`); `EADDRINUSE`/`EACCES`/`EADDRNOTAVAIL` are
    excluded from restart-on-error, so a port problem fails fast. Custom listeners
    are **observed, not rewritten** — `createServerListener()` no longer overrides
    port, host or server options, and `application.entrypointPort` is removed
    (see BC 19), so the URL the collision scan compares is always the bound one
    rather than a display value. And the runtime reports **a map** of URLs
    (`getUrls()`, `start()`'s return value, `getRuntimeMetadata().urls`,
    `getApplicationDetails().urls`) where v3 reported one; `getUrl()` and
    `getEntrypointDetails()` are gone, `wattpm ps` lost its URL column,
    `wattpm applications` lost its Entrypoint column, and `wattpm inject` requires
    an application name unless the runtime has exactly one. `basePath` stripping
    now applies to every application rather than only the one facing the network.
23. `@platformatic/composer` (the deprecated `@platformatic/gateway` alias
    package) is **removed**. Migrate renames the module and removes the
    superseded dependency — but the rename is applied **after** the v3 entrypoint is
    resolved, never before. v3's autodetection tested the raw module identity, so a
    `@platformatic/composer` application was never a gateway candidate; renaming
    first would change which application v3 resolved and silently relocate the
    project's public address (see "`wattpm-utils migrate`").
24. **`wattpm import` writes different output.** It emits the v4 per-app config
    form instead of a `watt.json` `$schema` stub (`external.js:194-205`, which v4's
    unconditional legacy check would refuse), and writes **literal relative paths**
    into the root config rather than the `{PLT_APPLICATION_<ID>_PATH}` placeholder
    plus `.env` line it wrote in v3 (`external.js:321-349`) — an env-var indirection
    is a non-literal expression, outside magicast's safe shape, for no benefit.
    Existing v3 placeholder entries keep working: migrate resolves them (see the
    structural path positions in step 1), and the runtime still backfills a
    `url`-bearing entry from `resolvedApplicationsBasePath`.
25. **One id rule everywhere: explicit `id`, else `package.json` `name` with the
    scope stripped, else the directory name.** v3 had two rules that never met,
    because it had no standalone boot: the wrapped single-app path used the package
    name with the scope stripped, falling back to `'main'`
    (`runtime/lib/config.js:136-147`, still present at HEAD), while `autoload` used
    the **directory name** alone (`:465`). v4 needs one rule, because the id is the
    mesh hostname, the injected `PLT_<ID>_URL` name, the metrics label, `wattpm
    inject`'s argument and how siblings name each other in `dependencies` — a default
    that varied by boot style would move all five at once for the same application.
    One *derivation*, that is: an explicit entry `id` is root-lexical and a standalone
    boot cannot see it, so the root warns when the two spellings differ (see "Scope").

    The consequence is real: **an autoloaded application whose package `name` differs
    from its directory name is renamed.** In this repository's own fixtures that is
    10 of the 13 application packages that declare a name — `web/composer/` is named
    `gateway-service`, `web/backend/` is named `service`. Applications with no `name`
    (7 of 20 here) are unaffected, as are those named after their directory.

    Migrate protects migrated projects: it pins the resolved v3 id on every explicit
    entry, and emits an `autoload.mappings` entry pinning `id` for exactly those
    directories where the two rules disagree. So this reaches **hand-written v4
    configs and newly created projects**, not migrated ones.

    **The comparison is against the legal v4 id, not the raw one**, or the rename path
    leaks. A directory named `my_app` whose package declares no name has the same id
    under both rules — v3's directory name and v4's directory-name fallback — so a
    comparison of raw values finds nothing to pin, emits no mapping, and leaves
    `my_app` in a configuration the label grammar rejects. Migrate therefore resolves
    every v3 autoload id first, normalizes it the way an explicit id is normalized,
    and emits a mapping whenever the **legal** v4 id differs from what v3 used —
    which covers the renamed-by-package case and the illegal-label case with one
    rule. Collision detection and reference rewriting then run over that complete
    normalized set, explicit and autoloaded together, since a directory rename can
    collide with an explicit entry just as easily as with another directory. An id that cannot be a
    DNS label — the grammar is `^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$`, so
    `my_app` and `api.v2` are rejected alongside `@acme/frontend` — is now a
    configuration error
    instead of an unresolvable `.plt.local` address.

26. **Capability resolution asks the application first.** v3's worker resolved a
    capability with a bare `import(pkg)` — lexical, from `@platformatic/basic`'s own
    position — and fell back to a `createRequire` scoped to the application directory
    (`basic/lib/modules.js:24-36` pre-`b7d953770`). v4 inverts the two, because
    the version stamp, the main-side schema import and the worker's implementation
    import must all name
    one copy, and only the application-first order makes that true independently of
    layout (see "Capability factories"). Under pnpm's strict layout nothing changes —
    the bare import already always threw — and an application with no local
    dependency still reaches the bundled copy. The one layout where the answer moves
    is a hoisted tree in which an application carries a nested copy of a capability
    the root also has: v3 loaded the root's, v4 loads the application's.

There is no deprecation window inside v4: old shapes fail fast with an actionable
error. The migration story is the codemod, not a compat layer.

---

## Implementation plan

Roughly ordered; steps 1–5 are the critical path.

**The one external prerequisite has landed.** This format specifies
`server.portAssignment` as a capability key (see "How applications are exposed"), and
`e2da15eda` had removed it — schema, implementation and the worker port-offset
bookkeeping alike. `468c64604` restored all three on `v4`, so a v3 configuration
using `perWorkerIncrement` now has a faithful target and migrate can ship green. It
was a prerequisite rather than a nicety: on macOS and Windows no other configuration
runs multiple workers on a fixed port at all.

1. **foundation — a fresh loader, not a refactor.** The v4 loader is written new for
   v4: the **main-side ladder resolver** (one implementation, walking a config file's
   own directory up to the env root, used
   for eval workers and for seeding application workers alike), eval workers
   constructed with an explicit `env` and a fresh ESM cache per load,
   import-graph collection via `module.registerHooks` wired into the dev watcher,
   filename resolution and the bounded walk, the `.json` →
   migrate-hint error, and the canonicalization-and-serializability pass
   (pre-`postMessage`) → validate → `kMetadata` → `transform` pipeline are a
   clean implementation with its own tests, including one asserting that the
   config-time and runtime views of an application's environment agree on their
   **env-file rungs** for an application configured by a per-app file — the two
   views differ by design on the `env` blocks and the injected `PLT_<ID>_URL`
   values, and a root-inline entry additionally evaluates against the root file's
   directory rather than the application's.
   The v3
   `configuration.js` (parsers, `replaceEnv`, YAML pre-pass, `strictEnv`, `$schema`
   URL machinery) is **deleted from foundation in the v4 branch, not incrementally
   carved down** — it is moved, with its tests, into `wattpm-utils` as `migrate`'s
   private legacy reader. `loadEnv`'s **first-hit** walk goes with it: v4 layers every
   directory from a config file's own up to its env root, plus the deciding file's
   chain beneath an application's own and resolves them main-side, so the walk survives only inside
   migrate's legacy reader. Only deliberately-kept pieces are
   carried over as code (AJV custom keywords, `transform` hooks), each by explicit
   decision rather than by surviving a refactor.
2. **Schema audit** (foundation + all capabilities): classify the union sites, delete
   placeholder-only branches, regenerate `schema.json` + types; produce the
   per-property target-type table for migrate. `scripts/audit-schemas.mjs` walks the
   shipped schemas and produces both, and the count is deliberately not quoted here —
   it is a property of the schemas, stale the next time one gains a property, and the
   tool is the answer rather than a number in prose. It separates the two kinds of
   work: a **placeholder-shaped** branch is a bare `{ type: 'string' }` beside a typed
   one, mechanically identifiable and dead the moment interpolation goes; a **genuine**
   union — `boolean | object`, where the boolean is a shorthand rather than a way to
   smuggle a string — has to be classified by hand. Every capability schema embeds the
   shared blocks, so it reports distinct sites as well as copies: fixing `server.port`
   fixes it in every package, and counting the copies makes the work look an order of
   magnitude larger than it is.

   **"Placeholder-shaped" is a candidate set and not the answer, and the counter-example
   is `health.maxHeapTotal`.** Its schema is
   `anyOf: [{ type: 'number', minimum: 0 }, { type: 'string' }]` — byte-for-byte the
   shape of a placeholder union — but the string branch is real: it accepts a
   human-readable size like `'1 GB'`. `maxYoungGeneration` and `maxHeapUsed` are the
   same. Deleting the branch mechanically was tried and it broke them, which is the
   evidence for why this step is hand work rather than a codemod. Note also that the
   deletion has to be applied as a **projection** over the schema objects rather than an
   edit to them: the same objects still validate v3 configurations, where the
   placeholder branch is load-bearing, and they do until v3 loading is deleted. The table carries each property's full
   **constraint set** — enum members, numeric bounds, `multipleOf`, integer-ness,
   string patterns and lengths — not just its primitive type, because migrate
   intersects those constraints across every position a variable occupies (see step
   2 of the migrate section) and a type alone cannot decide whether a shared value
   exists. Those keywords are exactly migrate's supported subset, so the table also
   **flags any property whose constraints fall outside it** (`anyOf`, `oneOf`, `not`,
   `format`): the pre-flight refusal reads that flag rather than rediscovering the
   limit per run, which keeps the audit and the migrator from drifting apart as
   schemas gain keywords. Two schema *changes* rather than
   classifications. **Add `portAssignment` to both server declarations** — `server`
   (`foundation/lib/schema.js:391`, the basic family) *and* `fastifyServer` (`:507`,
   service/db/gateway). They are separate object literals that happen to overlap:
   `fastifyServer` re-declares all five of `server`'s keys rather than composing with
   it, so a key added to one does not reach the other. Adding it only to `server`
   would leave gateway, service and db with no way to run `workers > 1` on a fixed
   port — the exact hole #5074 closed, and the commonest v3 entrypoint is a gateway.
   `468c64604` did add it to both (`foundation/lib/schema.js:400,515`); the audit
   item is to keep them from drifting apart again. Second: **remove `application.entrypointPort`**, which lives in
   `basic/lib/schema.js:61-63` pre-`3c92a2a64` and every capability's generated `schema.json`.
3. **basic**: `defineCapabilityFactory`; duck-typed `ApplicationDefinition`
   (`module` property, no symbols); **invert `importCapabilityPackage`'s order** to
   application-scoped first with the bundled fallback
   (`lib/modules.js:24-36` pre-`b7d953770`, BC 26) — the same resolver the main
   process uses for schemas and the version stamp, so the three cannot disagree; capability-block flattening with `application`
   kept nested; delete worker-side config *file* resolution (the capability
   `transform` + pre-transform `configPatch` application stay worker-side); remove
   `application.entrypointPort` from the schema (`lib/schema.js:61-63` pre-`3c92a2a64`) and its
   rewrite from `_getEntrypointUrl` (`basic/lib/capability.js:924-928` pre-`3c92a2a64`), keeping the
   `[::]`/`0.0.0.0` → `localhost` normalization, and drop the two tests that assert
   the override (`test/capability.test.js:96,114` pre-`3c92a2a64`).
4. **runtime**: delete `wrapInRuntimeConfig` and alias merging; entry `config`
   accepts inline definitions; **`autoload` expansion and `enabled` filtering leave
   the runtime transform** (`runtime/lib/config.js:450-484`, `:486-490`) for the root
   eval worker, with the `autoload` declaration carried through as data for
   `GET /metadata` and `--save`; phased evaluation (root worker first, per-app
   workers in parallel) with uniform per-app file
   discovery (autoload and explicit entries alike) and the search/classification
   rules — the search stops at the nearest `package.json`, `.env` discovery is the
   env-root layering (a config file's own chain, plus the deciding file's chain
   beneath an application's own); the deterministic zero-config capability detector (capability
   dependencies first, ambiguity error on two, JS-files → node terminal rule);
   no listen resolution to write at all — exposure is capability-owned and
   already lands with the entrypoint removal — beyond deciding the zero-config
   port question in "How applications are exposed"; `resolvedConfig` (validated raw) through `workerData` with
   worker-side `kMetadata` reconstruction; `PLT_<ID>_URL`
   injection (self included) with the ladder defined in "Inter-application URLs",
   resolved main-side by the shared ladder resolver, and the
   id-normalization collision error; the `'exec'` config context for capability
   commands, with the capability transform and synthesized `kMetadata` main-side;
   `POST /applications` **and the ITC `management:addApplications` handler**
   running the boot-time eval pass; remove
   `GET /config` — but **not** `GET /applications/:id/config`, which keeps its
   post-`transform` view (item 13) — extend `GET /metadata` with
   `configPath`/`autoload` (`projectDir` is already there);
   shallow explicit-wins entry merge (v3 semantics); in-memory zero-config synthesis; lazy
   capability-command dispatch (no config evaluation on plain `wattpm help`).
5. **wattpm**: export `defineConfig`, `WattConfig` and factory types generated from
   the audited schemas; `wattpm dev` watches the eval worker's collected import
   graph; `--debug-config` via the eval-worker pipeline, with the single-file
   in-process `--inspect-brk` mode; `build` evaluates
   with `production: true`.
6. **capabilities** (next, node, vite, astro, remix, nest, nitro, react-router,
   tanstack, nuxt, service, db, gateway): factory + option types (~20 lines each via
   the helper); **`servesWithoutPort` declared per capability** against the exposure
   matrix (callable where the configuration selects the class, as `vite` does), and
   **`getServingState()`** implemented wherever the row is worker-classified, with a
   no-port test per mode for every row — including both capability classes `nitro`
   ships, and Vite SSR with a Fastify factory, with `hasServer = false`, and with a
   background application; light schema subpath exports (`@platformatic/<x>/schema`) for
   eval-worker validation; `createCommands` moves to the `{ root, config }` data
   contract (db drops its self-loading and `utimesSync`; `db:print-schema`'s
   `create(root, configFile, …)` — `db/lib/commands/print-schema.js:18` — becomes
   `create(root, config)` fed the already-transformed data); the gateway's request-time
   `replaceEnv` call is rewritten; `next pack` emits the plain-object v4 form +
   bundle boot test.
7. **wattpm-utils**: `wattpm import` via magicast with snippet fallback;
   external/install flow emits v4 per-app files; `create` templates emit
   `watt.config.ts`; remove `patch-config`. **`resolve` gains `--for <command>`**
   (default `start`, plus `--for all`) alongside the `exec`-context
   flags (`--production` / `--mode <name>`), evaluating the target command's context
   with that command's own defaults; under `--for all` it evaluates each boot command,
   unions the candidates by id, and **refuses an id whose `url`, `gitBranch` or
   canonical effective destination differs between commands**, naming both values and
   both commands. In every mode it also maps **destination → producers** across the
   whole candidate set — before any existence filtering, since a destination that
   already holds one of the two clones is the case the refusal is for — and refuses one
   destination claimed by two repository/revision pairs, fetching a deliberately shared
   checkout once. It takes those candidates from the
   loader's `kMetadata` `resolveCandidates` list, recorded before the `enabled` filter, rather
   than by filtering the returned application list as it does today
   (`external.js:614-625`) — the pre-filter list does not survive the eval worker, so
   this is a protocol change before it is a command change. A remote entry excluded
   in the current mode is fetched all the same. **`wattpm-utils migrate` lives here,
   under `wattpm-utils`' own binary — no `wattpm` routing**: it hosts the vendored
   v3 closure (foundation machinery, the four upgrade chains — dual-run against
   token and resolved clones — frozen snapshots of the ~13 capability schemas and
   `replaceEnvIgnore` lists, with their tests) as private code
   behind the two-view reader (lexical / upgraded),
   runs the consented dependency install, keeps the `.wattpm-migrate.json`
   manifest for `--resume` and rollback,
   shares nothing with the v4 loader, and releases on its own cadence. **Stable
   v4.0 gates on it** — GA requires a published, tested migrate — while post-GA
   fixes stay decoupled: `npx` resolves at invocation time, so they reach every
   installed v4 runtime without a runtime re-release.
8. **create-wattpm + generators**: wizard output switches to `.ts` (`.mts`/`.js` per
   package type); a monorepo emits a config file for **every** application, while a
   single-app project emits one only for non-default answers (single-app defaults
   produce no config file); **`ImportGenerator` emits the v4 per-app form** rather than
   a `watt.json` stub (`generators/lib/import-generator.js:137-158`) — it is the path
   taken for capabilities without a generator, so leaving it would have let the wizard
   still write JSON for exactly the applications least likely to be tested. A
   capability with a factory is spelled by calling it, and one without keeps the plain
   object form, which is where an imported application most often lands;
   scaffolded test helpers import the config module instead
   of `JSON.parse`-ing `watt.json`; fixture conversion codemod for the ~868 in-tree
   JSON fixtures.
**Every code block in this document is checked in CI, or explicitly marked as
   prose.** Three rounds of review found invalid examples by hand, including the sole
   illustration of the callback form, so the scope is every block rather than the ones
   somebody thought to check. Four categories, assigned by an explicit marker on the
   fence rather than inferred:

   - **`config`** — a complete v4 configuration with a default export. Loaded through
     the real v4 loader and validated against the shipped capability schemas, **and
     typechecked with `tsc --noEmit`** against the shipped `.d.ts` files. Loader
     validation alone is not enough: it accepts a `string` where the generated types
     declare a literal union, so a block can pass every runtime check and still be
     wrong in the editor the format exists to serve. The same pass covers every
     configuration fixture `migrate` and the generators emit, for the same reason.
     Every such block must stand alone, imports included.
   - **`decl`** — interfaces, type aliases and the bodiless factory overloads, which
     are a `SyntaxError` after type stripping and export nothing. Typechecked with
     `tsc --noEmit` against the shipped `.d.ts` files; Appendix A's blocks are
     additionally key-diffed against `runtime/schema.json` and `next/schema.json`.
   - **`v3`** — legacy JSON input, validated against the **vendored v3** schema that
     migrate carries, so the before/after examples are checked on both sides.
   - **`output`** — terminal output, warnings, errors and directory trees, checked
     only for being fenced and marked.

   The marker is required: an unmarked block fails the check rather than being
   skipped, which is what stops the gate from quietly narrowing. The gate exists —
   `scripts/check-blocks.mjs`, beside the citation one — and every block carries a
   marker, so the `config` blocks are loaded through the real v4 loader and every
   block that holds types is typechecked. **Two of the four descriptions above are
   still ahead of it**: a `v3` block is parsed rather than validated against the
   vendored v3 schema, which migrate does not yet carry, and Appendix A's `decl`
   blocks are not key-diffed against `runtime/schema.json`. It also reports, rather
   than resolves, the option types those blocks name that the audited schema has not
   generated yet — declaring them into existence would let the gate read as though the
   document were fully checked. The inventory is deliberately not quoted here, because
   a hard-coded count is stale the next time a block is added, which is exactly how the
   previous count came to be wrong.

   **The source citations are already gated**, by `scripts/check-citations.mjs` and
   the workflow beside it. Every `file.js:line-range` reference in this document is
   anchored to a hash of the lines it was written against, so a change under a citation fails the
   check rather than passing quietly: verifying that a range is *in bounds* catches
   nothing, since code that moves leaves the range valid and the reference pointing
   at something else. Thirty-six citations here were wrong that way before the
   anchoring existed. Content that merely moved is repaired by `--fix`; content that
   changed is reported for a human, because a citation whose code no longer says what
   the sentence claims is a statement to re-read, not a line number to update.

   **Every way of not knowing fails as well** — a citation absent from the lockfile, a
   lockfile that is missing or empty, a historical commit that cannot be read. Each of
   those once printed a warning and exited zero, which meant deleting one file turned
   the gate off silently. A check that treats "I could not verify this" as "verified"
   is not a check, so blessing is what `--update` does and verification never does it
   on its own.
9. **cross-repo**: watt-admin migrates off `GET /config`. In-tree but published,
   so tracked here for visibility: **`@platformatic/control`** drops or re-points
   `getRuntimeConfig` (`control/lib/index.js:242`, the removed `GET /config`) while
   `getRuntimeApplicationConfig` (`:259`) is untouched — it calls
   `/api/v1/applications/:id/config`, which stays — and gains a metadata
   accessor carrying `root`/`configPath`/`autoload`, which is what
   `applications:add`/`remove --save` actually consume
   (`wattpm/lib/commands/applications.js:33,112`); the out-of-tree capabilities (`php`,
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

*Illustrative, not authoritative.* The shipped types are **generated from the
audited schemas** by the existing `gen-types` pipeline (see the implementation
plan), which is what keeps them correct; a sketch maintained by hand drifts, and
this one had. The CI check (see implementation plan step 8) diffs this block against
`packages/runtime/schema.json`, and the `@platformatic/next` sketch below against
`packages/next/schema.json`, so a divergence fails the build rather than surviving
review. Both are pinned because both have drifted before.

```ts decl
// wattpm
import type {
  ApplicationDefinition,
  ConfigContext,
  DeferredApplicationDefinition
} from '@platformatic/basic'
import type { SchedulerJob } from '@platformatic/runtime'

export interface WattConfig {
  // no `entrypoint` and no `server`: the runtime owns no listener, and every
  // exposure setting lives in the capability config (see "How applications are
  // exposed")
  basePath?: string
  application?: ApplicationEntry           // single-app shorthand; exclusive
                                           // with applications AND autoload
  applications?: ApplicationEntry[]
  autoload?: { path: string, exclude?: string[], mappings?: Record<string, ApplicationEntryOverrides> }
  // ApplicationEntryOverrides =
  //   Omit<ApplicationEntry, 'config'|'path'|'url'|'gitBranch'> & { id: string }
  // the orchestration subset: env, envfile, workers, health, enabled,
  // dependencies, telemetry, preload, … (v3's mappings[].config is removed;
  // url/gitBranch are excluded because an autoloaded entry always has a path,
  // and v3 requires `id` on a mapping)
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
  management?: boolean | { enabled?: boolean, operations?: string[] }
  scheduler?: SchedulerJob[]
  policies?: { deny: Record<string, string | string[]> }   // `deny` is required
  preload?: string | string[]
  extensions?: string | ExtensionEntry | (string | ExtensionEntry)[]
  env?: Record<string, string>            // workers' runtime env only; never
                                          // visible to config evaluation
                                          // (see "Env files")
  reuseTcpPorts?: boolean                 // default true — SO_REUSEPORT; one of the
                                          // two configurable inputs, the other being
                                          // the application entry
  nodeModulesSourceMaps?: string[]        // package names, not a flag
  resolvedApplicationsBasePath?: string   // used by `wattpm resolve`
  exitOnUnhandledErrors?: boolean | number // number = exit delay in ms
  sourceMaps?: boolean
  compileCache?: boolean | CompileCacheOptions
  inspectorOptions?: { host?: string, port?: number, breakFirstLine?: boolean,
                       watchDisabled?: boolean }
  // …complete list generated from the audited v4 runtime schema.
  // `application` is a v4 addition the CI diff must allow; everything else here
  // exists in packages/runtime/schema.json.
}

// Not a root type: `server` exists only inside a capability factory's options,
// as `AppServerOptions` below. The framework and node capabilities expose these
// six; service/db/gateway re-declare all of them and add the full Fastify set
// (`foundation/lib/schema.js` `server` :391 and `fastifyServer` :501 are separate
// literals, not composed — a key added to one must be added to the other).
export interface AppServerOptions {
  hostname?: string
  port?: number                            // undefined = no managed listener; whether
                                           // the app still serves the mesh is
                                           // capability- and mode-specific (see the
                                           // exposure matrix)
                                           // 0 = ephemeral, one port per worker
  portAssignment?: 'shared' | 'perWorkerIncrement'  // 'shared' needs
                                           // SO_REUSEPORT, 'perWorkerIncrement'
                                           // binds worker i at port + i
  backlog?: number
  http2?: boolean
  https?: HttpsOptions
}

// Local and remote entries are two shapes, and `id` is what separates them: a
// local entry can derive one from its package or directory, a remote entry has
// neither until it has been cloned — and its path is computed from the id before
// that happens (see "Remote apps"). The schema says the same thing.
export type ApplicationEntry = LocalApplicationEntry | RemoteApplicationEntry

export interface LocalApplicationEntry extends ApplicationEntryOptions {
  id?: string                             // else package.json name (scope stripped),
                                          // else directory name
  path?: string                           // defaults to the config file's directory
  url?: never
}

export interface RemoteApplicationEntry extends ApplicationEntryOptions {
  id: string                              // required: nothing exists yet to derive
                                          // it from, and the loader backfills
                                          // `<resolvedApplicationsBasePath>/<id>`
  url: string
  path?: string                           // normally absent — the loader computes it
  gitBranch?: string                      // as authored; absent lets a `#branch`
                                          // fragment in the URL decide
}

export interface ApplicationEntryOptions {
  config?: ApplicationDefinition          // factory result, plain { module } object,
    | DeferredApplicationDefinition       // or a callback form — legal only in a
                                          // config *file*, awaited by the root
                                          // worker before serialization; an error
                                          // in a programmatic object source
  enabled?: boolean | Record<string, boolean>   // keyed by `mode`; resolved in the
                                                // root worker, before fan-out
  workers?: number | ApplicationWorkersOptions
  health?: ApplicationHealthOptions
  env?: Record<string, string>            // worker runtime env only; never
                                          // visible to config evaluation
  envfile?: string                        // replaces the app's four-file env set
                                          // in BOTH views (evaluation + runtime);
                                          // app-relative; missing file = error;
                                          // error where the entry's config is
                                          // evaluated out of reach — inline `config`,
                                          // or an entry in the deciding file's own
                                          // directory. A detector-only entry (no
                                          // file to evaluate) is legal.
  reuseTcpPorts?: boolean                 // default true; reaches the
                                          // SO_REUSEPORT decision in v4
  restartOnError?: boolean | number
  // no `server` and no `useHttp`: exposure is capability configuration
  management?: boolean | { enabled?: boolean, operations?: string[] }
                                          // gates the ITC ManagementClient; the
                                          // operations allowlist is what permits
                                          // or denies addApplications
  arguments?: string[]
  execArgv?: string[]
  nodeModulesSourceMaps?: string[]        // package names, not a flag
  sourceMaps?: boolean
  compileCache?: boolean | CompileCacheOptions
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

export function defineConfig (config: WattConfig): WattConfig
export function defineConfig (fn: (ctx: ConfigContext) => WattConfig | Promise<WattConfig>): typeof fn
// ConfigContext and the definition types are declared in @platformatic/basic
// (below) and re-exported here, so a root config needs one import
```

```ts decl
// @platformatic/basic — the shared vocabulary every capability re-exports
export type ConfigContext = {
  command: 'dev' | 'build' | 'start' | 'exec'   // 'exec' = capability commands
                                                // and other non-boot evaluation
  mode: string
  production: boolean
  env: Readonly<Record<string, string | undefined>>  // snapshot, not live process.env;
                                                    // frozen at runtime, and so is ctx
  root: string
  addWatchFile (path: string): void   // declare a file the config reads but does not
                                      // import, so `wattpm dev` watches it; relative
                                      // paths resolve against `root`; a no-op
                                      // outside a watching command
}

export interface ApplicationDefinition {
  module: string                  // the duck-typing key: `module` present = per-app
  version?: string                // stamped by the factory, for the root/app skew
                                  // check only — not a file-format marker; absent
                                  // on hand-written { module } definitions (BC 15)
  [option: string]: unknown       // the capability's own validated options
}

// A callback form that has not run yet. Deliberately NOT an ApplicationDefinition:
// `.module` is absent until the loader awaits it, so reading it is a type error.
export type DeferredApplicationDefinition =
  (ctx: ConfigContext) => ApplicationDefinition | Promise<ApplicationDefinition>
```

```ts decl
// @platformatic/next — factory options are per-app capability config ONLY
import type {
  ApplicationDefinition,
  ConfigContext,
  DeferredApplicationDefinition
} from '@platformatic/basic'

export interface NextConfigOptions {
  trailingSlash?: boolean          // flattened from the v3 `next` block; audit
                                   // removal candidate (mirrors next.config.*)
  standalone?: boolean
  useExperimentalAdapter?: boolean
  https?: NextHttpsOptions         // flattened from `next`; note the adjacency
                                   // with `server.https` (recorded in the audit)
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
): DeferredApplicationDefinition               // awaited by the loader before
                                               // classification; `.module` is not
                                               // readable on it
// ConfigContext and the definition types re-exported from @platformatic/basic
```

## Appendix B — before/after: the wrapped single-app config

**v3 (capability dialect, wrapped runtime):**

```json v3
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

```ts config env=PLT_SERVER_LOGGER_LEVEL=info,PORT=3042
import { defineConfig } from 'wattpm'
import { next } from '@platformatic/next'

// emitted by migrate: these positions were implicitly required by their type in v3
function requiredEnv (name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`${name} is required but is not set`)
  }
  return value
}

function requiredEnum <const T extends readonly string[]> (name: string, allowed: T): T[number] {
  const value = requiredEnv(name)
  if (!allowed.includes(value)) {
    throw new Error(`${name} must be one of: ${allowed.join(', ')}`)
  }
  return value as T[number]
}

export default defineConfig({
  logger: {
    level: requiredEnum('PLT_SERVER_LOGGER_LEVEL',
      ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
  },
  managementApi: (process.env.PLT_MANAGEMENT_API ?? '') !== '',
  application: {
    id: 'main',
    workers: 2,
    config: next({
      server: {
        hostname: process.env.PLT_SERVER_HOSTNAME ?? '',
        port: Number(requiredEnv('PORT'))
      },
      cache: { adapter: 'redis', url: process.env.PLT_REDIS_URL ?? '' }
    })
  }
})
```

with the migration report:

``` output
i typed-position placeholders guarded (2)
  PORT → application.config.server.port (number)
  PLT_SERVER_LOGGER_LEVEL → logger.level (enum)
    Both were implicitly required by their position's type under v3, which refused
    to boot when they were unset. requiredEnv() keeps that, and names the variable
    when it happens. Set them, or write a literal.
```

The two guarded positions are reported, not flagged for review: a converted project
behaves as it did, so there is nothing for the author to decide. The generated
`requiredEnv` helper is emitted into the file alongside them.

The `id` is pinned even though this project has one application: v3 derived it from
`package.json` `name` with the scope stripped, falling back to `'main'`
(`runtime/lib/config.js:136-147`), and it is the mesh hostname, the injected
`PLT_<ID>_URL` name, the metrics label and `wattpm inject`'s argument. Writing it
literally is what keeps those four fixed across the migration — the rule step 1
states for every explicit entry.

`managementApi` must be carried over rather than dropped — omitting it picks up its
schema `default: true` and turns the API **on**, where v3 with the variable unset had
it **off**. It cannot keep the `?? ''` form, though: the audit deletes
`managementApi`'s top-level string branch (see "Validation, types, and the schema
audit"), so `''` would be a validation failure rather than "off". The emitted
expression reproduces v3's gate exactly — v3 tested the *replaced string* for
truthiness (`runtime/lib/runtime.js:397`), so `''` is off and **any** non-empty
string is on, including `'false'`. `(… ?? '') !== ''` is that test, written in a
boolean position.

The `server` block crossed the boundary: it was a *runtime* setting in v3, hoisted
out of the wrapped block by `wrapInRuntimeConfig`; in v4 it is capability
configuration and moves inside the factory, which is exactly where migrate puts a
v3 root `server` (see "`wattpm-utils migrate`"). Note also `workers: 2` with a
fixed port: that combination now depends on `SO_REUSEPORT` with no fallback.

And when this project later joins a monorepo, the `next({ … })` expression moves
into `web/frontend/watt.config.ts` as its default export — no dependency moves, no
dialect change, and one edit: `process.env.PORT` becomes
`process.env.PLT_FRONTEND_PORT`, because a global `PORT` read by every application
in the project is one port every application binds (see the Summary). That edit is
the whole of the difference, and stating it is cheaper than a boot failure an
operator produces by setting the variable their platform always sets.
