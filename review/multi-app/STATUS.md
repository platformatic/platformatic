# Request routing implementation status

Release recommendation: **hold**. This is an opt-in implementation for review; production per-app SLOs, error budgets, resource limits and a canary destination have not been established. Performance results must not be treated as a promise of improvement over other gateways.

## Implemented contract

An internal application's `requestRouting.algorithm: "least-outstanding"` selects among that application's ready mesh workers for each HTTP request. Requests on a persistent HTTP/1 connection and concurrent HTTP/2 streams select independently. Round robin remains the default.

The runtime creates fresh shared state for each backend generation. Bounded reservation slots and unique 64-bit leases provide admission across multiple callers without a global lock. Selection reads an approximate outstanding snapshot; reservation slots enforce the hard bound. Drain blocks new reservations permanently for that generation, including late readiness updates. Backend exit retires its state; replacement workers receive different state.

Completion means backend response production ended, closed or failed. Timeout, client disconnect or gateway exit alone does not release accepted backend work. The transport holds accepted work until backend completion or actual backend exit. Unaccepted claims from a dead caller are reconciled by the backend actor. Long-lived streams occupy capacity. Work outside participating HTTP dispatchers, including background CPU jobs, is not represented.

The maintained mesh source originates from MIT-licensed `undici-thread-interceptor` 1.5.0. Its license is included in the published runtime. This avoids relying on an unpublished dependency API or consumers applying a package-manager patch. It adds three direct JavaScript dependencies already used by the upstream transport; it introduces no SQLite or native memory-map dependency.

The public policy rejects entrypoints, `useHttp`, TCP/subprocess targets and the application's WebSocket flag. TCP connection distribution and request selection have different lifecycle information. The experimental ELU/heap preference exists only as a benchmark comparator; it is not accepted by the configuration schema.

Admission exhaustion returns HTTP 503 with `PLT_REQUEST_CAPACITY_EXCEEDED`. The gateway does not automatically replay that rejection. Existing retries for other responses are preserved. Worker details and generation-labelled metrics expose outstanding reservations, selections, releases, rejections and invalid reservation messages. Abrupt termination may interrupt cumulative bookkeeping; the current outstanding gauge is the load signal.

## Validation

Raw validation logs are included in `evidence/`:

- Current source, rebased onto `8f6b4e5ee` with Fastify 5.12.5: 42 targeted tests pass on Linux Node 22, 24 and 26. All 42 also pass as UID 65534 with dropped capabilities, default seccomp, no-new-privileges, read-only root, four CPUs and 2 GiB memory. Package lint passes; the unchanged type surface passed 50 TypeScript tests and 145 assertions after the rebase.
- Current source: 24 default interceptor, messaging, restart/crash cases and two channel-policy cases pass. Twenty gateway cases pass, including mesh/TCP WebSockets, telemetry and empty responses.
- The initial complete runtime main run had 458 of 472 cases pass and exposed a scaler shutdown hang; it was not a passing suite. Missing SQLite bindings affected existing fixture tests. After installing those test bindings and fixing shutdown, the six affected files had 96/97 passes and both scaler files exited normally. The remaining failure was the upstream host-memory fixture calling the default cgroup-aware API. Explicitly requesting host scope makes all 21 utils cases pass. The failed and corrective runs are preserved separately.
- A new regression fails before the shutdown guard and passes afterwards. Shutdown can discard a booting scale-up worker; its exit acknowledgement must not retry bootstrap after the stop snapshot. Only the runtime crash handler is removed during discard, preserving transport, ITC and retirement listeners. Another integration test scales a routed pool up and down with accepted requests in flight while another app keeps serving.
- Seven reservation tests passed on macOS. Frozen dependency installation, package contents and license checks passed. Windows validation requires repository CI.

Feature tests exercise persistent HTTP/1, multiplexed HTTP/2, upload/response streams, backpressure, cache hits, trace context, channel policies, bounded overload, an unavailable app, synchronous CPU cancellation, gateway/backend crashes, worker replacement, scale-up/down, unread-body shutdown and shutdown concurrent with bootstrap/restart. Production routing needs neither SQLite nor a native memory-map addon.

The forwarded-header fixture also binds explicitly to loopback. Its previous wildcard bind expected `0.0.0.0` as a peer address and failed on the unmodified baseline in this Linux environment.

## Performance and rollout gates

Earlier measurements remain diagnostics. The five-seed primary fixture completed 31,500 requests without response errors or leaked reservations, but did not establish a repeatable per-app tail improvement. The latest completed seven-seed forwarding cohort preceded the dependency rebase and shutdown fix: default round robin measured 101.3% of pristine stock HTTP/1 throughput and 100.2% of HTTP/2 throughput at the median. Least outstanding measured 81.3% and 113.2%, respectively; bootstrap intervals were wide (HTTP/1 79.1–113.9%, HTTP/2 81.8–117.0%). It fails the proposed overhead/repeatability gate and is not release evidence. All runs, including outliers, are retained locally.

The current `release-v17-final` serial campaign is running against a frozen snapshot of commit `dd9c49ed64eeee5fc918cf1e72eac3cd807a403d` and uses the latest frozen production source and identical instrumentation/resource budgets. It includes seven-seed cheap forwarding, a five-seed multi-app primary matrix, isolated rate sweeps, healthy/overload/shifted traffic, two/four frontends, uniformly heavy pools, TLS, and three-seed 180-second scaler runs. Scripts retain actual deployed-source hashes, configurations, arrivals, every terminal outcome, health samples, GC observations, generation changes and server logs under `results/review/multi-app/`. The Docker VM also hosts unrelated services, so measured variation must remain visible. Nginx is excluded.

Run `BENCH_WORKSPACE=/work python3 review/multi-app/campaign.py --revision <unique-revision>` after `setup.sh` in a clean checkout. Run capacity experiments serially and after correctness tests finish. The development overlays used `/focused` instead of `/work`.

Do not promote this draft until the latest campaign demonstrates a repeatable benefit without an unacceptable cost to any app, the overhead gate passes, production SLOs/resource budgets are supplied, and a representative canary exercises normal load variation and worker replacement. The multi-app TCP/Rust comparison remains separate work; the existing single-app prototype measurements do not satisfy it. Disabling `requestRouting` and restarting returns to round robin; validate that rollback during the canary before rollout.
