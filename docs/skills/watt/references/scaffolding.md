---
title: Scaffold Watt Applications
---

# Scaffold Watt applications

## A new single application

Choose a project name and directory; do not create a Git repository automatically.
Create a package manifest with `"type": "module"`, Node.js `>=24.20.0`, and scripts:

```json
{
  "scripts": {
    "dev": "wattpm dev",
    "build": "wattpm build",
    "start": "wattpm start",
    "test": "node --test"
  }
}
```

Install `wattpm` and the chosen `@platformatic/*` capability at compatible Watt 4
versions. For generic Node.js, also install the application's framework if needed.
Do not add TypeScript compilation unless the application needs it: configuration
types can be stripped by Node.js, while frontend frameworks still require their builds.

For a small Fastify application, create `index.js`:

```js source
import Fastify from 'fastify'

export function create () {
  const app = Fastify()
  app.get('/hello', async () => ({ hello: 'world' }))
  return app
}
```

Create `watt.config.js`:

```js config
import { createNodeConfig } from '@platformatic/node'

export default createNodeConfig({
  main: './index.js',
  server: {
    hostname: process.env.HOST || '127.0.0.1',
    port: Number(process.env.PORT || 3042)
  }
})
```

Add `.env.example` with `HOST=127.0.0.1` and `PORT=3042`; do not overwrite `.env`.
Ignore `node_modules/`, `.env`, build output, logs, and profiling artifacts. Add a
README with installation, development, production, and endpoint instructions.
For tests, call `create()`, use Fastify `inject()`, and close the app in `t.after()`.

## Multiple applications

Use the project's existing layout, or `applications/<id>/` for a new workspace.
Each application has its own package manifest, dependencies, code, and configuration.
Put `wattpm` at the root and capability dependencies in their owning applications.
For npm or Yarn, declare root `workspaces`; Yarn workspaces need `"private": true`.
For pnpm, create or extend `pnpm-workspace.yaml`:

```yaml
packages:
  - 'applications/*'
```

Create the root `watt.config.js`:

```js config
import { createWattConfig } from 'wattpm'

export default createWattConfig({
  logger: { level: process.env.LOG_LEVEL || 'info' },
  applications: [
    { id: 'api', path: './applications/api' },
    { id: 'gateway', path: './applications/gateway' }
  ]
})
```

The gateway application's own `server` exposes the public HTTP listener. Internal applications communicate
through `http://<id>.plt.local` without opening a public port for every application.
Inspect the capability schema before configuring `server`, especially for frameworks.
Alternatively use `autoload: { path: './applications' }` to discover applications.
Do not combine explicit entries and autoload accidentally or introduce duplicate IDs.

## Add an application

1. Inspect the root configuration and workspace definition.
2. Choose a unique, descriptive application ID and an unused directory.
3. Write the application files using the matching framework or service reference.
4. Add its workspace package and a runtime `applications` entry, or rely on existing
   autoload. Do not replace the root file with a new static object.
5. Select the publicly listening application deliberately; adding an internal service
   must not change the existing public application or its port. The runtime has no
   `entrypoint` property.
6. Install authorized dependencies and verify that existing applications still work.

## TypeScript

Use `.ts` configuration and native Node.js type stripping for erasable syntax.
Use the framework's existing TypeScript toolchain for its source. For a new project,
prefer ESM and NodeNext settings, `noEmit` for type checks when Node runs the source,
and `@types/node` plus `typescript` as development dependencies. Avoid enums,
parameter properties, and path aliases without a runtime strategy.
