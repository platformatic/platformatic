---
title: Overview
label: Platformatic Runtime
---

import Issues from '../../getting-started/issues.md';

# Platformatic Runtime

Platformatic Runtime provides a unified environment for running multiple Platformatic microservices as a single monolithic deployment unit, for streamlined development.

## Features

- **Command-line interface**: [`platformatic runtime`](../cli.md#runtime) provides a powerful and flexible CLI for managing your runtime environment.
- **Programmatic start**: Start Platformatic Runtime [programmatically](../runtime/programmatic.md) in tests or other applications for enhanced integration.
- **Monorepo support**: Efficiently manage applications within a monorepo setup.
- **Interservice communication**: Enable [interservice communication](#interservice-communication) using private message passing to streamline service interactions.

## Standalone usage

If you're only interested in the features available in Platformatic Runtime, you can replace `platformatic` with `@platformatic/runtime` in the `dependencies` of your `package.json`. This reduces the number of dependencies you need to import for your application.

## Example configuration file

The following configuration file can be used to start a new Platformatic Runtime project. For more details on the configuration file, see the [configuration documentation](../runtime/configuration.md).

```json
{
  "$schema": "https://schemas.platformatic.dev/@platformatic/runtime/2.0.0.json",
  "autoload": {
    "path": "./packages",
    "exclude": ["docs"]
  },
  "entrypoint": "entrypointApp"
}
```

## TypeScript Compilation

Platformatic Runtime streamlines the compilation of all services built on TypeScript with the command `plt runtime compile`. This command integrates seamlessly with Platformatic features, ensuring faster builds and consistent environments. it's important to note that the TypeScript compiler (`tsc`) must be installed separately.

## Platformatic Runtime context

Every Platformatic Runtime application can be run as a standalone application
or as a Platformatic Runtime service. Runtime service enables certain compile and runtime optimizations, enhancing performance and resource management. You can see the [interservice communication](#interservice-communication) for more features.

## Interservice communication

Platformatic Runtime allows multiple microservice applications to run
within a single process. Only the entrypoint binds to an operating system
port and can be reached from outside the runtime.

Within the runtime, all interservice communication happens by injecting HTTP
requests into the running servers, without binding them to ports. This injection
is handled by [`fastify-undici-dispatcher`](https://www.npmjs.com/package/fastify-undici-dispatcher) and [`undici-thread-interceptor`](https://www.npmjs.com/package/undici-thread-interceptor).

Each microservice is assigned an internal domain name based on its unique ID.
For example, a microservice with the ID `awesome` is given the internal domain
of `http://awesome.plt.local`. The dispatcher packages module map that
domain to the Fastify server running the `awesome` microservice. Any Node.js
APIs based on Undici, such as `fetch()`, will then automatically route requests
addressed to `awesome.plt.local` to the corresponding Fastify server.

## Threading and networking model

By default, each service is executed in a separate and dedicated [Node.js Worker Thread](https://nodejs.org/dist/latest/docs/api/worker_threads.html) within the same process.
This means that `worker.isMainThread` will return `false` and there are some limitations like the inability to use `process.chdir`.

The service application runtime configuration is accessible via the `workerData` and `globalThis.platformatic` objects, which allows to bypass such limitations.

If an application requires to be executed in a separate process, Platformatic Runtime will take care of setting `globalThis.platformatic` and the interservice communication automatically.

# TrustProxy

For each service in the runtime **except the entrypoint**, Platformatic will set the Fastify's `trustProxy` option to true. This will change the ip/hostname in the request object to match the one coming from the entrypoint, rather than the internal `xyz.plt.local` name.This is useful for services behind a proxy, ensuring the original client's IP address is preserved. Visit [fastify docs](https://www.fastify.io/docs/latest/Reference/Server/#trustproxy) for more details.

<Issues />
