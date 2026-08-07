---
title: Watt Architecture
label: Watt Architecture
---

# Watt Architecture

This page explains *why* Watt is shaped the way it is. It is not a setup guide and it is not an API
listing — it is the reasoning behind the design, so that the configuration options and CLI commands
you meet elsewhere feel like consequences rather than arbitrary choices.

If you want to configure something, go to [Runtime configuration](../reference/runtime/configuration.md).
If you want a component-by-component map, go to [Architecture Overview](../overview/architecture-overview.md).
If you want to pick a topology for your own system, go to
[Watt Architecture Patterns](../guides/watt-architecture-patterns.md).

## The problem Watt is solving

Splitting a Node.js backend into separate services buys you real things: independent deployment,
independent scaling, clear ownership boundaries, and failure isolation. It also charges for them.
Every service becomes a process to supervise, a container to build, a port to allocate, a network hop
to trace, a TLS handshake to configure, and an entry in whatever service-discovery mechanism you
adopted. The boundary you drew for code-organisation reasons has to be paid for in operational
machinery.

Keeping everything in one process avoids that bill, but re-introduces the coupling: one dependency
tree, one build, one event loop, and a codebase where module boundaries are advisory because nothing
enforces them.

Watt's premise is that these two options are not the only ones available, because the two things
being traded — *code isolation* and *deployment separation* — are separable. You can enforce hard
boundaries between applications without giving each one its own deployment unit.

## The core decision: a thread per application

Watt runs each application in its own [worker thread](./multithread-model.md), inside a single Node.js
process, supervised by a runtime.

A worker thread gets its own V8 isolate. That means its own heap, its own module registry, its own
globals, and its own event loop. Two applications in the same Watt process cannot see each other's
memory, cannot monkey-patch each other's modules, and cannot block each other's event loop. They can
depend on different, incompatible versions of the same library. One can be a Next.js frontend and
another a Fastify API, each with the build tooling it expects.

That is most of the isolation people actually want from microservices, obtained without a second
process, a second container, or a network.

What you give up is deployment independence. Every application in a Watt runtime starts, stops, and
ships together. Watt does not pretend otherwise — that trade is the whole point, and
[Modular Monolith](./modular-monolith.md) discusses when it is the right one and when it is not.

## The mesh: why `.plt.local` is not a network call

Applications inside Watt address each other by an internal hostname derived from the application id:

```js
const res = await fetch('http://products.plt.local/items')
```

This looks like HTTP, and from the application's point of view it *is* HTTP — same `fetch`, same
request and response semantics, same status codes. But no TCP socket is opened and no DNS lookup is
performed. Watt installs an undici dispatcher in every worker that claims the `.plt.local` domain and
routes matching requests over a `MessagePort` directly to the destination thread.

The mechanism is [`undici-thread-interceptor`](https://github.com/platformatic/undici-thread-interceptor),
wired in [`packages/runtime/lib/worker/interceptors.js`](https://github.com/platformatic/platformatic/blob/main/packages/runtime/lib/worker/interceptors.js).
The comment in that file explains why the domain is declared explicitly: without it, every internal
call would flood the DNS resolver with lookups for names that will never resolve.

This choice is what makes the rest of the architecture pay off:

- **Nothing to configure.** There are no ports to assign, no service registry to keep in sync, no
  addresses to inject as environment variables. The application id *is* the address.
- **The code is portable in both directions.** An application that calls `fetch` against a URL does
  not know or care whether the target is a thread in the same process or a service on another
  continent. Extracting an application to its own deployment later is a URL change, not a rewrite.
- **The transport cost drops out.** No serialization to the wire format, no TCP, no TLS, no
  connection pool. Just a message between threads.

The last point is worth stating carefully: internal calls are cheaper than network calls, but they
are not free. Request and response bodies still cross a thread boundary. A chatty design is still a
chatty design; Watt makes the hop cheap, not free.

## The runtime: supervision, not just process management

The runtime is the main thread. It owns everything that should exist exactly once for the whole
application, and it is the reason Watt is a platform rather than a thread-pool helper.

**Ordering.** Applications are started in dependency order. The runtime asks each application for its
dependencies, topologically sorts them, then groups them into levels so that everything within a
level can start in parallel while still guaranteeing its dependencies came up first. See
[Application Lifecycle](./application-lifecycle.md) for how this is derived and what happens when
there is a cycle.

**Supervision.** The runtime health-checks every worker, restarts crashed ones with backoff, and
replaces workers that stay unhealthy. This is the layer that would otherwise be your orchestrator's
job.

**Shared concerns.** Logging, metrics, OpenTelemetry tracing, and the HTTP cache are configured once
on the runtime and apply to every application. Logs from all applications are merged into one
stream, already tagged with the application id and worker index. Traces propagate across the internal
mesh, so a request that touches four applications produces one connected trace rather than four
disconnected ones.

**One public surface.** Exactly one application is the entrypoint. Everything else is reachable only
from inside the mesh. This is a genuine security property, not just a routing convention: a
non-entrypoint application does not open a listening socket, so it cannot be reached from outside the
process even by mistake. (An application can opt back in with `useHttp` when it genuinely needs a
real port — but that is a decision you make, not a default you inherit.)

## Capabilities: the framework adapter layer

Watt does not require your application to be written against a Watt API. Instead, a *capability*
adapts an existing framework to the runtime — `@platformatic/next` for Next.js,
`@platformatic/vite` for Vite, `@platformatic/node` for a plain `node:http` server, and so on.

A capability's job is to implement a small lifecycle contract (`init`, `start`, `stop`, `build`) and
translate between the runtime's expectations and the framework's own conventions. Where a framework
insists on owning its own dev server or its own build pipeline, the capability lets it, and bridges
the result back.

This is what allows an unmodified Next.js application to become a Watt application by adding a
config file. The full list is in the [capabilities guide](../guides/capabilities.md).

## What this architecture is not good at

Being explicit about the limits is more useful than another list of benefits.

- **Independent deployment.** One runtime deploys as one unit. If two parts of your system must ship
  on genuinely independent schedules — different teams, different release cadences, different
  compliance boundaries — they want to be different deployments, and Watt will not change that.
- **Language diversity.** Worker threads are a Node.js mechanism. A capability can supervise a child
  process in another language, but that is a different and less integrated arrangement than a thread.
- **Fault isolation at the process level.** Threads share a process. A segfault in a native addon, an
  OOM against the process-wide heap limit, or an `uncaughtException` policy that exits will take down
  every application in the runtime, not just one. Watt mitigates this — see the health and restart
  behaviour in [Application Lifecycle](./application-lifecycle.md) — but it cannot make a shared
  process behave like separate ones.
- **Independent resource limits.** You can give an application more workers, but you cannot give it
  its own CPU quota or memory cgroup the way a container gives you.

The honest summary: Watt gives you microservice-grade *code* isolation with monolith-grade
operations. When you need microservice-grade *operational* isolation, run several Watt runtimes — the
mesh-vs-network transparency described above means the applications themselves barely change.

## Related reading

- [The Multithread Model](./multithread-model.md) — why threads, and what isolation they actually give
- [Application Lifecycle](./application-lifecycle.md) — startup ordering, health, and restarts
- [Modular Monolith](./modular-monolith.md) — the positioning, and when to stop using it
- [Watt Architecture Patterns](../guides/watt-architecture-patterns.md) — pyramid and funnel topologies
- [Runtime reference](../reference/runtime/overview.md) — the configuration surface
