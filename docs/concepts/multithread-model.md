---
title: The Multithread Model
label: The Multithread Model
---

# The Multithread Model

Watt runs applications in worker threads. This page explains what that actually buys you, what it
does not, and the mental model you need to reason about behaviour that surprises people coming from
either a single-process Node.js background or a container-per-service background.

For the component-level detail — mesh topology, ITC message formats, file layout — see
[Multithread Architecture](../reference/runtime/multithread-architecture.md). For configuration, see
[`workers` in the runtime configuration](../reference/runtime/configuration.md).

## Why threads and not processes

Node.js gives you three ways to run code concurrently, and Watt's choice of the third is deliberate.

**A single event loop** is the cheapest and the most fragile. Everything shares one heap, one module
registry, and one event loop. A CPU-bound handler in one part of the codebase stalls every other
part. Two libraries that both want to patch `globalThis.fetch` fight. You cannot depend on two major
versions of the same package.

**Child processes** (or `cluster`) give real isolation: separate heaps, separate event loops,
separate module registries, and a crash that takes down one process leaves the others running. The
cost is that every interaction becomes IPC or a network call, memory usage multiplies by the number
of processes, and startup means paying full Node.js bootstrap per process.

**Worker threads** sit in between, and the position is more useful than it first appears. Each worker
gets its own V8 isolate: its own heap, its own module registry, its own globals, its own event loop.
That is the same *logical* isolation a child process gives you. What it does not give you is *fault*
isolation — threads share a process, so a process-level failure is shared too.

Watt takes this trade because the isolation that matters day-to-day is the logical kind, and the
thing you get in exchange is a fast, in-process communication channel that a child process cannot
offer.

## What isolation you actually get

It is worth being precise, because "isolated" is doing a lot of work in most descriptions.

| Property | Isolated per worker? |
| --- | --- |
| Heap / object graph | Yes — separate V8 isolate |
| Module registry (`require`/`import` cache) | Yes |
| Globals, prototype patches, `AsyncLocalStorage` | Yes |
| Event loop | Yes |
| Dependency versions | Yes — each application resolves from its own directory |
| Environment variables | Effectively yes — each worker gets its own `process.env` snapshot |
| Uncaught exception handling | Per worker, with a runtime-level policy on top |
| OS process, PID, cwd | **No** — shared |
| Process-wide memory limit | **No** — shared |
| Native addon state | **No** — a native crash kills the process |
| File descriptors, signals | **No** — shared |

The first block is why two applications can use incompatible versions of the same library, why one
application's Next.js instrumentation does not leak into another, and why a blocked event loop in one
application does not stall the others. The second block is why a segfault in a native module, or an
OOM against the process heap limit, takes down the whole runtime.

## Shared nothing, message everything

Because heaps are separate, nothing is shared by reference. There is no shared cache object, no
singleton visible across applications, no way to pass a closure. Everything crossing a worker
boundary is copied or transferred.

Watt gives you two channels for this, and they serve different purposes.

**HTTP over the mesh** is the primary one. An application calls
`fetch('http://other-app.plt.local/path')` and Watt routes it over a `MessagePort` instead of a
socket. Use this for anything that is conceptually a request to another application — it keeps the
call site identical to a real network call, which is what makes an application extractable later.

**Messaging** (`@platformatic/globals`) is the lower-level channel, for the cases HTTP does not fit:
broadcast notifications, cache invalidation, coordination between workers of the same application.

The rule of thumb: if you would have written it as an HTTP endpoint between two services, use the
mesh. If you would have written it as an event bus, use messaging.

The practical consequence of shared-nothing is that in-memory caches are per worker. Three workers
means three copies of that `Map` you are memoising into, each independently warmed. Watt's own HTTP
cache is designed around this — the store is shared and coordinated through the runtime precisely
because a naive per-worker cache would be three caches with three miss rates. This is explained in
[Cache with Watt](../guides/cache-with-platformatic-watt.md).

## Multiple workers per application

An application can run more than one worker:

```json
{
  "applications": [
    { "id": "api", "path": "./web/api", "workers": 4 }
  ]
}
```

Each worker is a full independent instance of the application. Requests to `api.plt.local` are
distributed across them round-robin — with a randomised starting offset per application, so that
several callers starting at once do not all pile onto worker 0.

This is horizontal scaling *inside* the process, and it is the answer to CPU-bound work in Node.js.
An application doing image resizing or PDF generation can be given four workers while the rest of the
system stays at one, and the expensive work occupies four event loops that are not the event loops
serving your API.

Three consequences follow directly from shared-nothing, and each surprises someone eventually:

- **State does not survive across workers.** Anything a request handler stores in module scope is
  visible only to the worker that handled it. Sessions, rate-limit counters, and caches need a shared
  backing store, exactly as they would across containers.
- **Startup cost multiplies.** Four workers means four module graphs loaded and four heaps. Memory
  scales close to linearly with worker count.
- **Only the entrypoint listens.** Non-entrypoint applications open no socket regardless of worker
  count, unless they explicitly opt in with `useHttp`; the mesh addresses them by id.

Workers can also be scaled automatically based on event loop utilisation, via `workers.dynamic`. See
[Dynamic Workers](../guides/dynamic-workers.md).

## Failure and the process boundary

Watt supervises workers, and the supervision is the reason a shared process is tolerable.

A worker that exits unexpectedly is restarted — with a delay, a bounded number of bootstrap attempts,
and a fresh worker index. A worker that stays alive but stops behaving (event loop utilisation pinned
at 100%, heap over the configured ceiling, health checks not returning) is replaced after a
configurable number of consecutive unhealthy checks. The mechanics, thresholds, and defaults are in
[Application Lifecycle](./application-lifecycle.md).

What supervision cannot rescue is a failure at the process level. If a native addon segfaults, if the
process hits its V8 heap limit, or if something calls `process.exit()`, every worker dies with it,
because they are all threads in that process. This is the single most important operational
difference between Watt and a container-per-service deployment, and it is the reason
[Watt Architecture](./watt-architecture.md) is explicit that Watt trades operational isolation for
code isolation rather than claiming to give you both.

If a particular application genuinely needs process-level fault isolation — an unstable native
dependency, an untrusted plugin — the answer is to run it as its own Watt runtime and let the two
talk over real HTTP. Because the mesh and the network look the same to application code, that change
is a configuration and URL change rather than a rewrite.

## Related reading

- [Watt Architecture](./watt-architecture.md) — why the runtime is designed this way
- [Application Lifecycle](./application-lifecycle.md) — startup ordering, health checks, restarts
- [Multithread Architecture](../reference/runtime/multithread-architecture.md) — component-level reference
- [Dynamic Workers](../guides/dynamic-workers.md) — automatic scaling on event loop utilisation
- [Watt Architecture Patterns](../guides/watt-architecture-patterns.md) — where to spend your workers
