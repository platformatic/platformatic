# Integrate existing and remote applications

Write configuration and package changes directly. This replaces generator-driven
wrapping and import commands; downloading applications remains a separate operation.

## Existing local application

1. Detect the capability using [frameworks](frameworks.md).
2. Inspect existing configuration and dependencies; do not add competing config files.
3. Add a compatible capability dependency and minimal `watt.config.*` when necessary.
   Recognized single applications can also use inferred configuration.
4. Join a runtime through `{ id, path }` in `applications`, or its existing autoload.
   Moving/copying source needs authorization; preserve package boundaries.
5. Deliberately configure listener, routes, environment, build, and shutdown.

## Runtime wrapper

Prefer referencing the existing app by path. A single inline application can use:

```js config
import { createWattConfig } from 'wattpm'
import { createNodeConfig } from '@platformatic/node'

export default createWattConfig({
  application: {
    config: createNodeConfig({
      main: './index.js',
      server: { port: Number(process.env.PORT || 3042) }
    }),
    workers: 2
  }
})
```

Keep capability settings in `config`, orchestration alongside it. Avoid duplicate
listeners and obsolete root `server`/`entrypoint` settings.

## Remote applications

Declare Git/npm applications in the root configuration:

```js config
import { createWattConfig } from 'wattpm'

export default createWattConfig({
  applications: [
    {
      id: 'api',
      url: 'https://github.com/example/api.git',
      gitBranch: 'production',
      path: './external/api'
    },
    { id: 'worker', url: 'npm:my-worker@1.0.0' }
  ]
})
```

Use user-provided URLs/revisions, not placeholders. An omitted path uses the resolved
applications base directory. Keep credentials out of URLs, source, and shell history.
Keep checkout paths inside the project and avoid existing paths/collisions. Remote
applications must already use compatible Watt 4 configuration and dependencies.

With authorization:

```sh
npx wattpm-utils resolve --for start
```

`--for dev`, `build`, or `all` selects evaluation contexts. Dynamic configurations can
produce different topologies; do not evaluate all contexts blindly. `resolve` downloads
applications and installs dependencies; `--skip-dependencies` avoids installation but
does not authorize fetching. Review lifecycle scripts and any `npx` download separately.
Do not rewrite configuration or `.env` merely to record a fetched path.

## Existing Watt 3 projects

Read [migration-v4.md](migration-v4.md). Renaming JSON to a module is not migration.
Preserve environment semantics, topology, auth, database settings, and cleanup behavior.
The authorized `wattpm-utils migrate` codemod remains available; it is not a scaffolder.
