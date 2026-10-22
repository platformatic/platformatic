# Performance and profiling

Measure a representative production build before changing worker counts or caches.
Record Node/Watt/framework versions, CPU quota, memory limit, worker count, throughput,
latency percentiles, error rate, and workload. Compare one change at a time.

## CPU profiling

Use Watt-native profiling on an authorized running instance:

```sh
wattpm ps
wattpm applications my-app
wattpm pprof start my-app api
# Exercise the representative workload.
wattpm pprof stop my-app api
```

The stop command saves a pprof `.pb` profile. Use the returned filename rather than
guessing it. If there is only one runtime/application, the CLI can infer IDs; otherwise
specify both. Read `wattpm help pprof` for the installed release's options.

With an installed `@platformatic/flame` tool:

```sh
flame generate profile.pb
flame generate --md-format=detailed profile.pb
```

Use `flame run` for standalone Node scripts, not as a replacement for Watt's worker-aware
profiling. Inspect application frames, allocation pressure, synchronous work, slow
dependencies, and cache misses before attributing cost to the runtime.

## Memory

```sh
wattpm heap-snapshot my-app api
```

Heap snapshots can pause a worker and need substantial memory. Choose the target and
collection window deliberately. Treat snapshots and profiles as potentially sensitive
artifacts and keep them out of source control. Compare retained objects across repeated
workloads rather than diagnosing a leak from one RSS value.

## Workers and replicas

A standalone capability uses `runtime.workers`. In a multi-app root, set `workers`
on each application entry or use a root default. Do not use a map keyed by app ID.

```json
{
  "applications": [
    { "id": "frontend", "path": "./web/frontend", "workers": 2 },
    { "id": "api", "path": "./web/api", "workers": 1 }
  ]
}
```

Budget per-worker heaps, database pools, cache clients, and framework memory. More
workers do not guarantee better latency under a fixed CPU quota. Observe CPU throttling,
event-loop delay, and downstream saturation as well as aggregate CPU utilization.

## Caching and deployment

For Next.js, inspect the installed capability's Valkey/Redis and Cache Components
support. Verify invalidation across workers and replicas. Keep cache namespaces and
deployment identity consistent; avoid reusing incompatible entries between releases.

Preserve framework build output and required assets. Load-test through the public
gateway, including redirects, compression, authentication, and realistic cache hit rates.
Report measured results and limitations rather than universal performance percentages.

See [Next.js](frameworks/nextjs.md), [observability](observability.md), and
[Kubernetes](deployment/kubernetes.md).
