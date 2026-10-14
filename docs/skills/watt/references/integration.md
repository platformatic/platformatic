---
title: Integrate Existing and Remote Applications
---

# Integrate existing and remote applications

This workflow replaces `watt import` and generator-driven wrapping. Write configuration
and package changes directly; fetching applications remains an operational task.

## Existing local application

1. Identify its framework and capability using [framework integration](frameworks.md).
2. Inspect existing configuration and dependencies. Do not add a second configuration
   file or overwrite an existing one.
3. Add the capability dependency and a minimal `watt.config.*` if explicit configuration
   is needed. Watt also supports inferred single-application projects without a config.
4. If joining a runtime, add `{ id, path }` to its `applications` list or move/copy only
   with authorization into its existing autoload directory. Preserve package boundaries.
5. Set the public listener, routes, environment, and shutdown deliberately. Keep the original
   framework build commands available when Watt needs them.

## Wrap an application with runtime orchestration

Prefer a root configuration referencing the existing application by path. A single
inline application can use the runtime's `application` shorthand:

```js config
import { createWattConfig } from 'wattpm'

export default createWattConfig({
  application: {
    config: {
      module: '@platformatic/node',
      node: { main: './index.js' },
      server: { port: Number(process.env.PORT || 3042) }
    },
    workers: 2
  }
})
```

Move capability options into `config`; keep orchestration settings beside it. Do not
nest a legacy `runtime` block inside the capability or duplicate an HTTP listener.

## Remote applications

Declare Git or npm applications explicitly in the runtime configuration:

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

Use real user-provided URLs and revisions, not these placeholders. An omitted `path`
uses the configured resolved-applications base directory. Do not store Git passwords
in URLs, source, or shell history. Use the environment-supported credentials instead.
Keep checkout paths inside the project and avoid collisions or existing directories.
The remote project must already be a valid Watt application with compatible dependencies.

With authorization, fetch declared applications using:

```sh
npx wattpm-utils resolve --for start
```

`--for dev`, `--for build`, or `--for all` selects which configuration context to
evaluate. Dynamic configuration may produce different topology per command; do not
evaluate all contexts blindly. `resolve` fetches applications and installs dependencies;
use `--skip-dependencies` when installation is not authorized. Review lifecycle scripts.
Do not mutate configuration merely to record a fetched path.

## Migration from Watt 3

Do not rename `watt.json` to `watt.config.js`: JSON and modules are different contracts.
Read the [agent migration reference](migration-v4.md) and its linked migration guide,
inspect all capability versions, and preserve environment
semantics, topology, authorization, and database settings. The explicit
`wattpm-utils migrate` codemod remains available when appropriate; it is not a scaffolder.
Review its output before installing upgraded packages or starting the application.
