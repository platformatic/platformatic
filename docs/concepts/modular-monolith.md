---
title: The Modular Monolith
label: The Modular Monolith
---

# The Modular Monolith

"Modular monolith" is the phrase Watt's documentation leads with, and it is doing real work rather
than acting as a slogan. This page explains what the term means, why it describes Watt accurately,
and — more usefully — when you should stop using one.

If you want to build one rather than reason about one, go to
[Build a modular monolith](../guides/build-modular-monolith.md), which walks through a complete
multi-application example.

## The term

A **monolith** is one deployment unit. A **modular** system has enforced internal boundaries. Most
architectures give you one or the other:

- A conventional monolith is one deployment unit with advisory boundaries. Modules are separated by
  directory layout and code review. Nothing stops one part importing another's internals, and over a
  few years, something always does.
- Microservices give you enforced boundaries — you physically cannot import across a network — at the
  cost of one deployment unit per boundary, and all the machinery that implies.

A modular monolith is the combination that is usually assumed to be unavailable: one deployment unit,
enforced boundaries. The boundaries are real, not conventional, but you still ship one thing.

## Why Watt is one, mechanically

The claim rests on the worker thread model. Each application runs in its own V8 isolate, so the
boundary between applications is enforced by the runtime rather than by discipline:

- There is no import path from one application to another's code. Separate module registries.
- There is no shared object graph. Separate heaps.
- The only way to reach another application is its HTTP interface over the mesh, at
  `http://<id>.plt.local`.

That last point is the important one. The boundary is not merely enforced — it is enforced *in the
shape of a network interface*. An application interacts with its neighbour exactly as it would if
that neighbour were a service in another datacentre: a URL, a request, a response, a status code.

Meanwhile the deployment story stays monolithic. One `npm install`, one build, one process, one
container, one thing to deploy and roll back.

## The property that makes it worth doing

Most architectural decisions are hard to reverse. This one is not, and that is the actual argument
for it.

Because applications already talk over HTTP, extracting one to its own deployment does not require
rewriting how it is called. The call site is a URL either way. Moving an application out means giving
it its own runtime and pointing callers at a real hostname instead of a `.plt.local` one. The
application's own code — routes, handlers, business logic — does not change at all.

This inverts the usual sequencing problem. The conventional advice is "start with a monolith, extract
services when you need to", which is good advice with a bad failure mode: by the time you need to
extract, the boundaries have eroded and the extraction is a rewrite. Watt's boundaries cannot erode,
because the runtime enforces them from day one. The extraction stays cheap indefinitely.

You are deferring a decision rather than making one. You get to find out where your real service
boundaries are by operating the system, instead of guessing during design.

## What you are actually trading

Being concrete about the cost is more useful than repeating the benefit.

**You get, compared to a conventional monolith:**

- Enforced boundaries and per-application dependency trees — two applications can use incompatible
  versions of the same library
- Per-application scaling — give the expensive one four workers and the rest one
- Event loop isolation — one application's CPU-bound work does not stall the others
- A migration path that stays open

**You get, compared to microservices:**

- One deployment unit, one build, one rollback
- No service discovery, no port allocation, no internal TLS, no network hop
- Merged logs and connected traces without assembling a pipeline first
- Far cheaper internal calls — a `MessagePort` message rather than a TCP round trip

**You give up, compared to microservices:**

- **Independent deployment.** Everything ships together. This is the big one.
- **Process-level fault isolation.** Threads share a process. A native segfault or a process-wide OOM
  takes down every application, as discussed in [The Multithread Model](./multithread-model.md).
- **Per-application resource limits.** No per-application CPU quota or memory cgroup.
- **Language diversity.** Worker threads are a Node.js mechanism.
- **Independent technology upgrades.** One Node.js version for everyone.

## When to stop

A modular monolith is a good default, not a permanent answer. Extract an application to its own
deployment when one of these becomes true — and note that none of them are about code size:

- **Release cadence diverges.** Two parts of the system need to ship on genuinely independent
  schedules, because different teams own them or because their risk profiles differ.
- **Resource profiles diverge sharply.** One application wants 16 GB and a GPU; the rest want 512 MB.
  A shared process cannot express that.
- **A fault domain must be isolated.** An unstable native dependency, or untrusted third-party code,
  that you cannot allow to take the process down.
- **Compliance draws a boundary.** Payment or health data that must live in a separately audited
  deployment.
- **Scaling limits are reached.** You need more capacity than one process on one machine can provide,
  and running several identical Watt instances behind a load balancer is no longer the right shape.

Notice what is not on this list: number of applications, number of engineers, lines of code, or the
system feeling "big". Those are the usual triggers for reaching for microservices, and none of them
are reasons on their own — they are reasons to want enforced boundaries, which you already have.

## Extracting, when the time comes

The move is mechanical, which is the whole point:

1. Give the application its own Watt runtime and deploy it.
2. Change callers from `http://products.plt.local` to the real hostname. If you routed through
   configuration or an environment variable rather than hardcoding the internal URL, this is a
   config change.
3. Replace what the mesh was giving you for free: TLS, retries, timeouts, authentication between the
   two sides, and a way for traces to keep connecting across the new network boundary.

Step 3 is where the cost you deferred finally arrives. That is the correct time to pay it — when a
specific application has a specific reason to be separate, rather than for every boundary up front on
the assumption that some of them will one day need it.

## Related reading

- [Build a modular monolith](../guides/build-modular-monolith.md) — a complete worked example
- [Watt Architecture](./watt-architecture.md) — the design reasoning underneath
- [The Multithread Model](./multithread-model.md) — what the boundary is made of
- [Watt Architecture Patterns](../guides/watt-architecture-patterns.md) — pyramid and funnel topologies
- [Comparison with Alternatives](../overview/comparison-with-alternatives.md) — Watt versus other approaches
