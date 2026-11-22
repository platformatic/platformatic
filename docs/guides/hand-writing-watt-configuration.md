---
title: Writing Watt Configuration by Hand
---

# Writing Watt Configuration by Hand

`createWattConfig` and the `create<Name>Config` capability helpers are optional. They are identity functions — they return their argument untouched — and exist only to give a TypeScript editor completion and inline errors while you type. Anything you can write with them you can write as a plain object with no import at all, and the loader validates the result against the capability's schema when it boots either way.

This guide is the counterpart to [Generating Watt Configuration](./generating-watt-configuration.md), which is about tooling that *writes* configuration files. Here a person is writing one by hand. For the full list of options each block accepts, see the [configuration reference](../reference/runtime/configuration.md) and the [file formats](../file-formats.md) page.

## A configuration is a default export

A configuration file exports its configuration as the default export. That is the whole contract — the helpers only wrap that export in a typed function call. A single application needs nothing but the plain object:

```ts config
export default {
  module: '@platformatic/node',
  server: { port: Number(process.env.PORT) || 3042 }
}
```

That is exactly what `createNodeConfig({ … })` produces. An object with a `module` key is an **application definition**: the loader treats it as the runtime's only application and reaches it on the port above. Because the file is a program, it reads its environment directly rather than through `{PLACEHOLDER}` interpolation.

## A runtime with several applications

An object **without** a `module` key is a **runtime root**. List the applications by path, and configure anything shared across them at the top level:

```ts config
export default {
  logger: { level: 'info' },
  applications: [
    { id: 'api', path: './api' },
    { id: 'web', path: './web', server: { port: Number(process.env.PORT) || 3042 } }
  ]
}
```

Each entry points at a directory that has its own `watt.config.*`, or carries an inline `config` with the same shape an application file would export. To discover applications from a directory instead of listing them, use `autoload`:

```ts config
export default {
  logger: { level: 'info' },
  autoload: { path: 'web' }
}
```

To keep a single application in one file but still set orchestration on it — workers, health, dependencies, whether it is enabled — use the singular `application` shorthand, where `config` holds the capability settings and the siblings are orchestration:

```ts config
export default {
  application: {
    config: { module: '@platformatic/node', server: { port: Number(process.env.PORT) || 3042 } },
    workers: 2
  }
}
```

## The helpers add types, not behaviour

Nothing about validation depends on the helpers. Every configuration — plain object or wrapped — is checked against the capability's JSON schema when the runtime loads it, and a shape the schema rejects fails the boot with the same error either way. The helpers only move some of that feedback into your editor as you type.

If you want that editor feedback without importing a helper, annotate the export with the type the capability already ships:

```ts source
import type { NodeConfigOptions } from '@platformatic/node'

export default {
  module: '@platformatic/node',
  server: { port: Number(process.env.PORT) || 3042 }
} satisfies NodeConfigOptions
```

`NodeConfigOptions` is a type-only import — the capability ships it whether or not you ever call `createNodeConfig` — so this reads exactly like the plain object above, with the editor checking it for you.

## Point tools at a schema with `$schema`

A plain-object configuration may carry a `$schema` property whose value is the URL of the schema it was written against:

```ts config
export default {
  $schema: 'https://schemas.platformatic.dev/@platformatic/node/4.0.0.json',
  module: '@platformatic/node',
  server: { port: Number(process.env.PORT) || 3042 }
}
```

The loader reads `$schema` **for version detection only** — `module` is what selects the capability — and strips it before validation, so it never has to appear in the schema itself. A URL the loader does not recognize (a hand-written JSON Schema you point your editor at, say) is left untouched. It is mandatory for machine writers, which have no import to identify themselves with, and optional for a hand-written file. See [Generating Watt Configuration](./generating-watt-configuration.md) for that side of it.

## Where to find the schemas

Every capability and the runtime ship their JSON Schema as `schema.json` at the root of the published package. So the schema for a configuration is next to the code that reads it:

```bash
# the schema the runtime root is validated against
node_modules/@platformatic/runtime/schema.json

# the schema a @platformatic/node application is validated against
node_modules/@platformatic/node/schema.json
```

Each schema's canonical id — and the value a `$schema` stamp uses — is a URL of the form:

```
https://schemas.platformatic.dev/<package>/<version>.json
```

where `<version>` is the version of the installed package. The runtime root is published under both `wattpm` and `@platformatic/runtime`; the capabilities under their package name:

| Configuration | Package | Schema id |
| --- | --- | --- |
| Runtime root | `@platformatic/runtime` (`wattpm`) | `…/@platformatic/runtime/<version>.json` |
| Generic Node.js app | `@platformatic/node` | `…/@platformatic/node/<version>.json` |
| HTTP service | `@platformatic/service` | `…/@platformatic/service/<version>.json` |
| Database app | `@platformatic/db` | `…/@platformatic/db/<version>.json` |
| API gateway | `@platformatic/gateway` | `…/@platformatic/gateway/<version>.json` |
| Vite / Astro / Next.js / Nuxt / Remix / React Router / TanStack / NestJS / Nitro | `@platformatic/<framework>` | `…/@platformatic/<framework>/<version>.json` |

To read a schema programmatically — to build your own validator or generate documentation — import it from the package's light `/schema` subpath, which carries the schema without pulling in the capability's implementation:

```ts source
import { schema, schemaComponents } from '@platformatic/node/schema'

// `schema` is the full JSON Schema; `schemaComponents` are the reusable
// fragments (server, logger, health, watch, …) shared across capabilities.
console.log(schema.$id)
```

The shared fragments themselves live in `@platformatic/foundation/schema` and `@platformatic/basic/schema`, which is where each capability's schema composes its `server`, `logger`, `health` and `watch` blocks from — so they are identical across every application type.
