---
title: Application Lifecycle
label: Application Lifecycle
---

# Application Lifecycle

This page explains what happens between `wattpm start` and your application serving a request, what
happens on the way back down, and what the runtime does when something goes wrong in between.

Understanding this is what turns a startup log from noise into a diagnosis. The five-line failure you
get when an application will not boot is much easier to read once you know which phase it came from.

## Two lifecycles, not one

Watt has a runtime lifecycle and, nested inside it, a lifecycle per application worker. They use
similar names, which is a common source of confusion.

The **runtime** moves through `init` → `starting` → `started` → `stopping` → `stopped`, with
`closing`/`closed` for teardown and `errored` for a failure it could not recover from.

Each **worker** moves through `init` → `starting` → `started` → `stopped`, with `start:error` when its
capability throws during startup.

A worker reaching `started` does not mean the runtime has; the runtime reaches `started` only once
every application it was asked to start has. Conversely, the runtime can be `started` while an
individual worker is cycling through restarts.

## Phase 1 — Runtime initialisation

Before any application code runs, the runtime sets up everything that exists once for the whole
process:

1. The management API starts, if configured.
2. The logger is created. This happens early and deliberately, so that everything after it —
   extensions, health servers, application startup — logs through the same destination.
3. Extensions are loaded. This is before any worker is created, so that custom ITC handlers an
   extension registers are available to every worker, and so that readiness and liveness checks are
   registered before the probe server starts listening.
4. Prometheus and health-probe servers start.
5. Applications are registered and their worker threads are created — created, not started.
6. The undici dispatcher is installed and the [scheduler](../guides/scheduler.md) starts.

The runtime is now `init`. Nothing is serving yet.

## Phase 2 — Dependency resolution and ordered startup

Watt does not start applications in configuration order, and it does not start them all at once. It
computes an order.

**Dependencies are collected.** The runtime asks each application, over ITC, for its dependencies.
Most applications report none. A gateway is the interesting case: it reports every local application
it is configured to compose, which it derives from its own `gateway.applications` list. That means a
gateway's dependencies are correct without you declaring anything.

You can also declare dependencies explicitly with the `dependencies` property on an application, for
the case where application A calls application B over the mesh during its own startup.

**The graph is sorted.** The runtime topologically sorts the applications. A cycle is a hard error —
`ApplicationsDependenciesCycleError` — not a warning, because there is no order that satisfies it.

**The sort is grouped into levels.** This is the part worth knowing. Rather than starting
applications one at a time in sorted order, the runtime groups them so that every application in a
level has all of its dependencies in earlier levels. Levels start sequentially; applications within a
level start in parallel.

So a system with a gateway over three independent APIs starts the three APIs concurrently, waits for
that whole level, then starts the gateway. Startup time is the depth of your dependency graph, not
the number of applications in it.

**Each capability then waits for its own dependencies.** Belt and braces: during its `init`, a
capability calls `waitForDependenciesStart`, so it does not merely start after its dependencies were
*launched* — it waits until they report `started`.

Once the last level is up, the runtime is `started` and the entrypoint is listening.

## Phase 3 — Serving

At this point the interesting behaviour is per request rather than per lifecycle, and it is covered
in [The Multithread Model](./multithread-model.md): mesh routing over `MessagePort`, round-robin
across an application's workers, and shared-nothing state.

One lifecycle-adjacent thing does keep running: health checks, described below.

## Phase 4 — Shutdown

Shutdown is not startup in reverse, and the difference matters.

The **entrypoint is stopped first**, deliberately and on its own. It is the only application with a
public socket, so stopping it first means no new external requests enter the system while everything
else is still up and able to finish in-flight work.

Then extension stop hooks run, so control-plane extensions can settle work and hand off state before
the applications they were managing go away.

Then the remaining applications stop. Each capability calls `waitForDependentsStop` before shutting
down, so an application does not disappear while something that depends on it is still finishing.

Finally the mesh interceptor and the broadcast channel close, and the runtime is `stopped`.

## When a worker crashes

A worker that exits unexpectedly is restarted. Two configuration values govern this, and their
defaults differ between development and production in a way that is easy to misread.

`restartOnError` defaults to `true`. What `true` resolves to depends on the mode:

- **Development**: `true` becomes a **5000 ms** delay between attempts.
- **Production**: the delay is forced to be effectively immediate.

Setting it to `false` or `0` disables restarts entirely.

Restarts are bounded: **5 bootstrap attempts**. After that the runtime gives up on the worker. This
is the mechanism behind a log sequence that anyone who has broken a startup path will recognise:

```
Failed to start worker 0 of the application "next": The worker 0 of the application "next"
  exited prematurely with error code 1
Attempt 1 of 5 to start the worker 0 of the application "next" again will be performed in 5000ms ...
```

Five of those, five seconds apart, is a worker whose capability throws during startup — not a
transient fault. When you see it, the useful question is what the capability's own startup is doing,
because the runtime has already told you everything it knows.

:::note
The runtime reports the worker's **exit code**, which is often less informative than what the
application printed on its way out. If the underlying error is not visible in the Watt logs, run the
framework's own dev command directly in the application directory — the error usually appears
immediately there.
:::

Each restarted worker gets a **new worker index** rather than reusing the old one, which is why the
log above shows worker 0, then worker 1, then worker 2 for what is conceptually the same worker
restarting. This is intentional — it keeps identifiers unique — but it does mean "worker 4" in a
crash loop is not the fifth worker of a five-worker application.

## When a worker is unhealthy but alive

Crashing is the easy failure. The harder one is a worker that is still running but no longer useful:
event loop pinned, heap exhausted, health checks not returning. Watt polls each worker and replaces
it when it stays bad.

The defaults:

| Setting | Default | Meaning |
| --- | --- | --- |
| `enabled` | `true` | Health checking is on |
| `interval` | `30000` ms | How often a worker is checked |
| `gracePeriod` | `30000` ms | Delay before the first check, so slow startups are not punished |
| `maxUnhealthyChecks` | `10` | Consecutive bad checks before replacement |
| `maxELU` | `0.99` | Event loop utilisation ceiling |
| `maxHeapUsed` | `0.99` | Fraction of the heap limit in use |
| `maxHeapTotal` | 4 GB | Absolute heap ceiling |
| `maxYoungGeneration` | 128 MB | Young generation ceiling |

Two properties of this design are worth drawing out.

**The counter is consecutive, not cumulative.** A single healthy check resets it to zero. A worker
that spikes over `maxELU` for one interval and recovers is left alone; only sustained badness
triggers replacement. With the defaults, that means roughly five minutes of continuous unhealthiness
before a worker is replaced.

**A failed health collection counts as unhealthy.** If the runtime cannot get an answer from a
worker, that is not skipped — it is a bad check. This is what catches a genuinely stuck worker, which
by definition cannot report that it is stuck.

Replacement is not restart: the runtime starts a fresh worker and retires the old one, so capacity is
not lost while the replacement boots.

## Reading the lifecycle in practice

Three questions locate almost any startup problem in this model:

1. **Did the runtime reach `init`?** If not, the problem is configuration, logging, or an extension —
   no application code has run yet.
2. **Which level did startup stop at?** An application stuck waiting is usually waiting on a
   dependency that never reached `started`. Look at the dependency, not the application reporting the
   problem.
3. **Is it crashing or unhealthy?** A crash gives you `exited prematurely` and a bounded restart
   sequence. Unhealthiness gives you `is unhealthy ... Replacing it`. They have different causes and
   different fixes.

## Related reading

- [Watt Architecture](./watt-architecture.md) — why the runtime supervises rather than just spawns
- [The Multithread Model](./multithread-model.md) — what a worker is and what it shares
- [Runtime configuration](../reference/runtime/configuration.md) — `health`, `restartOnError`, `workers`
- [Troubleshooting](../reference/troubleshooting.md) — symptom-first debugging
- [Dynamic Workers](../guides/dynamic-workers.md) — scaling workers on event loop utilisation
