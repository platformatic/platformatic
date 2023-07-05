# Platformatic Runtime

Platformatic Runtime is an environment for running multiple Platformatic
microservices as a single monolithic deployment unit.

:::info
Platformatic Runtime is currently in [public beta](#public-beta).
:::

## Features

- Command-line interface: [`platformatic runtime`](/reference/cli.md#runtime)
- Start Platformatic Runtime [programmatically](/reference/runtime/programmatic.md) in tests or other applications
- Support for monorepo-based applications.
- Interservice communication using private message passing.

## Public beta

Platformatic Runtime is in public beta. You can use it in production, but it's quite
likely that you'll encounter significant bugs.

If you run into a bug or have a suggestion for improvement, please
[raise an issue on GitHub](https://github.com/platformatic/platformatic/issues/new).

## Standalone usage

If you're only interested in the features available in Platformatic Runtime, you can replace `platformatic` with `@platformatic/runtime` in the `dependencies` of your `package.json`, so that you'll import fewer deps.

## Example configuration file

The following configuration file can be used to start a new Platformatic
Runtime project. For more details on the configuration file, see the
[configuration documentation](/reference/runtime/configuration.md).

```json
{
  "$schema": "https://platformatic.dev/schemas/v0.26.0/runtime",
  "autoload": {
    "path": "./packages",
    "exclude": ["docs"]
  },
  "entrypoint": "entrypointApp"
}
```

## TypeScript Compilation

Platformatic Runtime streamlines the compilation of all services built on TypeScript with the command
`plt runtime compile`. The TypeScript compiler (`tsc`) is required to be installed separately.
