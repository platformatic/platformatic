# Performance and profiling in Watt 4

Measure production-like traffic before changing workers, CPU limits, caching, or builds.
Linux `SO_REUSEPORT` can distribute connections across managed workers without a
master-process load-balancing path. Its availability and behavior are OS/listener-specific;
do not promise the same behavior on macOS/Windows or custom servers.

Historical benchmark results such as “93% faster” describe particular workloads, not
a guarantee for every app or a universal ranking of Node, Bun, and Deno. Retain benchmark
links as context and compare the user's own p50/p95/p99, throughput, CPU, and memory.

## Workers and resources

Workers belong to runtime application entries:

```js
import { createWattConfig } from 'wattpm'

export default createWattConfig({
  applications: [
    {
      id: 'storefront',
      path: './applications/storefront',
      workers: Number(process.env.PLT_NEXT_WORKERS || 1)
    }
  ]
})
```

For a single capability needing runtime options, use the singular `application` wrapper
shown in [Next.js](frameworks/nextjs.md). Do not use legacy root directory-keyed worker maps.
Check supported static/dynamic worker options and fixed-port sharing/`portAssignment`.
Development may intentionally use only one worker.

A starting experiment can allocate one CPU core per CPU-bound worker:

| Workers | Example CPU budget |
| --- | --- |
| 1 | 1000m |
| 2 | 2000m |
| 4 | 4000m |

This is **not a required formula**. Include runtime overhead, other applications,
DB pools, cache clients, and per-worker heap. Check throttling and event-loop utilization.
For four CPU-bound workers, a test pod might request 4000m/1Gi and allow 2Gi, but tune
from actual traffic instead of copying limits blindly. Coordinate pod replicas and workers.

## Next.js build and caching

Standalone output is useful for selected deployments, not mandatory. When using it,
set both Next `output: 'standalone'` and capability `next.standalone: true`; keep Watt
runtime/capability dependencies and startup. A container that starts only `server.js`
bypasses Watt orchestration. See [Docker](deployment/docker.md).

The Next capability supports Valkey/Redis cache configuration:

```js
import { createNextConfig } from '@platformatic/next'

export default createNextConfig({
  server: { port: Number(process.env.PORT || 3000) },
  cache: {
    adapter: 'valkey',
    url: process.env.PLT_VALKEY_HOST,
    prefix: 'storefront'
  }
})
```

Require a real URL when enabled. Check adapter/version, namespace, TTL, and cache mode
(ISR vs Cache Components). Time-based ISR (`export const revalidate = 10`) and tag
revalidation depend on installed Next.js APIs. Verify invalidation across workers and
replicas; do not assume local cache propagation. Use an authenticated endpoint as in
[CMS integration](cms-integration.md).

## Deployment monitoring

Use the actual public listener, implemented readiness/liveness routes, and a separately
configured private metrics listener. Metrics are not automatically served on 9090.
Inspect real metric names, worker labels, and caching metrics rather than assuming them.
See [Kubernetes](deployment/kubernetes.md) and [observability](observability.md).

## CPU profiling with pprof

With permission, build/start in production mode, then identify IDs in another terminal:

```sh
wattpm build
wattpm start
```

```sh
wattpm ps
wattpm applications my-app
wattpm pprof start my-app api
# Exercise the slow workload for a short, agreed window.
wattpm pprof stop my-app api
```

Inspect installed CLI syntax and use actual IDs. Profiling can target a selected app
or all applications when supported; stop the same profiling session after collection.
`stop` saves `.pb` files such as `pprof-{application}-{timestamp}.pb` in the working directory.
Use exact returned paths; do not invent a filename or a worker identifier.

## Flamegraphs and analysis

Install `@platformatic/flame` only with authorization (preserve local tooling choices;
global installation is not automatic). Given a captured file:

```sh
flame generate profile.pb
flame generate -o api-cpu-profile.html profile.pb
flame generate --md-format=detailed profile.pb
```

Check installed help for supported flags. Inspect wide frames/hot paths, distinguish
application vs framework overhead, and compare before/after profiles under the same load.
Correlate with logs without disclosing secrets. Generated profiles/HTML/Markdown must
remain out of source control unless explicitly intended as sanitized artifacts.

## Memory diagnostics

```sh
wattpm heap-snapshot my-app api
```

Heap snapshots can pause applications, be expensive, and expose credentials/personal data.
Request permission and capture after reproducing retention. Load the returned `.heapsnapshot`
in DevTools Memory; use actual returned paths. CPU `.pb` profiles and heap snapshots
answer different questions and are not interchangeable.

## Standalone scripts outside Watt

Use Flame's own profiling only for standalone processes, not as a replacement for Watt
worker profiling:

```sh
flame run server.js
flame run --manual server.js
flame toggle
# Exercise the target workload, then toggle again.
flame toggle
flame run --sourcemap-dirs=dist:build server.js
```

Inspect help for the installed version's CPU/heap output and manual-session selection.
Source maps must correspond to the build being profiled. Keep collected files private.

| Symptom | Diagnostic |
| --- | --- |
| Slow CPU-bound endpoint | Watt pprof + flamegraph |
| Growing memory | Heap snapshot/appropriate heap profile after reproduction |
| Existing `.pb` file | Flame generate |
| Standalone Node process | Flame run |
| Unknown bottleneck | Measure load/latency, CPU profile, then memory if retention grows |

## Checklist

- Agree on profiling window/traffic and stop sessions/processes created for the check.
- Build before production start; retain source maps and complete framework output.
- Size workers/CPU/memory from measurements, checking platform port-sharing support.
- Verify shared cache and invalidation, implemented probes, and protected metrics.
- Report actual checks/results and unverified deployment assumptions.

## Resources

- [Next.js Kubernetes deployment](https://docs.platformatic.dev/docs/guides/deployment/nextjs-in-k8s)
- [Historical Next.js benchmark](https://blog.platformatic.dev/93-faster-nextjs-in-your-kubernetes)
- [Worker provisioning discussion](https://blog.platformatic.dev/addressing-overprovisioning-performance-issues-in-nodejs-via-multiple-workers)
- [Flamegraph tooling](https://blog.platformatic.dev/introducing-next-gen-flamegraphs-for-nodejs)
- [Heap profiling](https://blog.platformatic.dev/announcing-heap-profiling-support-in-platformaticflame-and-watt-runtime)
