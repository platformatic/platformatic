---
title: Overview
label: Platformatic Runtime
---

import Issues from '../../getting-started/issues.md';

# Platformatic Runtime

Platformatic Runtime provides a unified environment for running multiple Platformatic microservices as a single monolithic deployment unit, for streamlined development.

## Features

- **Programmatic start**: Start Platformatic Runtime [programmatically](../runtime/programmatic.md) in tests or other applications for enhanced integration.
- **Monorepo support**: Efficiently manage applications within a monorepo setup.
- **Inter-application communication**: Enable [inter-application communication](#inter-application-communication) using private message passing to streamline application interactions.

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

## Platformatic Runtime context

Every Platformatic Runtime application can be run as a standalone application
or as a Platformatic Runtime application. Runtime application enables certain compile and runtime optimizations, enhancing performance and resource management. You can see the [inter-application communication](#inter-application-communication) for more features.

## Inter-application communication

Platformatic Runtime allows multiple microservice applications to run
within a single process. Only the entrypoint binds to an operating system
port and can be reached from outside the runtime.

Within the runtime, all inter-application communication happens by injecting HTTP
requests into the running servers, without binding them to ports. This injection
is handled by [`fastify-undici-dispatcher`](https://www.npmjs.com/package/fastify-undici-dispatcher) and [`undici-thread-interceptor`](https://www.npmjs.com/package/undici-thread-interceptor).

Each microservice is assigned an internal domain name based on its unique ID.
For example, a microservice with the ID `awesome` is given the internal domain
of `http://awesome.plt.local`. The dispatcher packages module map that
domain to the Fastify server running the `awesome` microservice. Any Node.js
APIs based on Undici, such as `fetch()`, will then automatically route requests
addressed to `awesome.plt.local` to the corresponding Fastify server.

### Internal Mesh Network Architecture

The communication system is built on a sophisticated mesh network that creates seamless connectivity between all microservices in the runtime:

#### Domain-Based Routing System

The mesh network uses domain-based routing to intelligently direct requests:

- **Domain Configuration**: All internal services use the `.plt.local` domain suffix
- **Hostname Matching**: The interceptor examines each request's hostname and routes requests ending with `.plt.local` to the appropriate worker thread
- **Case-Insensitive Resolution**: Domain matching is case-insensitive for reliability
- **Fallback Behavior**: Requests not matching the internal domain are passed through to external network handlers

#### Request Flow and Processing

When a service makes a request to another service (e.g., `http://auth.plt.local/verify`), the complete flow involves:

1. **Request Interception**: The undici-thread-interceptor captures the outgoing HTTP request
2. **Domain Validation**: The system checks if the hostname ends with `.plt.local`
3. **Service Resolution**: The hostname `auth` is mapped to the corresponding worker thread(s)
4. **Load Balancing**: If multiple workers exist for the service, round-robin selection chooses the target
5. **MessageChannel Communication**: The request is serialized and sent via Node.js MessageChannel
6. **Worker Processing**: The target worker thread processes the request through its Fastify server
7. **Response Streaming**: The response is streamed back through the MessageChannel to the requesting service

#### Performance Characteristics

The mesh network is optimized for high-performance inter-service communication:

- **Efficient Streaming**: Large request and response bodies use MessagePort transfers to avoid concatenation overhead
- **Concurrent Processing**: Multiple worker threads can process requests simultaneously across different CPU cores
- **Efficient Load Balancing**: Round-robin worker selection operates in O(1) time complexity
- **Asynchronous Communication**: All inter-thread communication is non-blocking, preserving application responsiveness

#### Dynamic Mesh Management

The mesh network automatically adapts to runtime changes:

- **Automatic Worker Registration**: New worker threads are automatically registered with the mesh interceptor
- **Dynamic Route Updates**: Services can be added or removed during runtime without affecting other services
- **Health-Aware Routing**: Unhealthy workers are automatically excluded from the routing pool
- **Graceful Failover**: When workers are restarted or replaced, the mesh maintains service availability

This architecture enables microservices to communicate using standard HTTP APIs while benefiting from the performance and isolation advantages of a multi-threaded execution environment.

For detailed technical documentation about the mesh network implementation, threading architecture, and performance characteristics, see the [Multithread Architecture](../runtime/multithread-architecture.md#internal-mesh-network-architecture) documentation.

## Threading and networking model

By default, each application is executed in a separate and dedicated [Node.js Worker Thread](https://nodejs.org/dist/latest/docs/api/worker_threads.html) within the same process.
This means that `worker.isMainThread` will return `false` and there are some limitations like the inability to use `process.chdir`.

The application application runtime configuration is accessible via the `workerData` and `globalThis.platformatic` objects, which allows to bypass such limitations.

If an application requires to be executed in a separate process, Platformatic Runtime will take care of setting `globalThis.platformatic` and the interapplication communication automatically.

# TrustProxy

For each application in the runtime **except the entrypoint**, Platformatic will set the Fastify's `trustProxy` option to true. This will change the ip/hostname in the request object to match the one coming from the entrypoint, rather than the internal `xyz.plt.local` name.This is useful for applications behind a proxy, ensuring the original client's IP address is preserved. Visit [fastify docs](https://www.fastify.io/docs/latest/Reference/Server/#trustproxy) for more details.

<Issues />
