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
- [Interservice communication](#interservice-communication) using private message passing.

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

## Platformatic Runtime context

Every Platformatic Runtime application can be run as a standalone application
or as a Platformatic Runtime service. In a second case, you can use Platformatic
Runtime features to archive some compile and runtime optimizations. For example,
see [Interservice communication](#interservice-communication). Looking through the
Platformatic documentation, you can find some features that are available only
if you run your application as a Platformatic Runtime service.

## Interservice communication

The Platformatic Runtime allows multiple microservice applications to run
within a single process. Only the entrypoint binds to an operating system
port and can be reached from outside of the runtime.

Within the runtime, all interservice communication happens by injecting HTTP
requests into the running servers, without binding them to ports. This injection
is handled by
[`fastify-undici-dispatcher`](https://www.npmjs.com/package/fastify-undici-dispatcher).

Each microservice is assigned an internal domain name based on its unique ID.
For example, a microservice with the ID `awesome` is given the internal domain
of `http://awesome.plt.local`. The `fastify-undici-dispatcher` module maps that
domain to the Fastify server running the `awesome` microservice. Any Node.js
APIs based on Undici, such as `fetch()`, will then automatically route requests
addressed to `awesome.plt.local` to the corresponding Fastify server.
