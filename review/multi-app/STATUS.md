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

- Latest mesh revision: 40 targeted tests pass on Linux Node 22, 24 and 26; the same 40 pass as UID 65534 with dropped capabilities, default seccomp, no-new-privileges, read-only root, four CPUs and 2 GiB memory.
- Latest close/drain revision: 33 relevant existing default-routing, policy, messaging, restart and crash cases pass. Lint passes; 50 TypeScript tests and 145 assertions pass.
- Previous revision, before the final channel-close store cleanup: broader runtime regression suite has 93 passes and one skip; 20 selected gateway cases pass, including mesh/TCP WebSockets, telemetry and empty responses.
- Seven reservation tests pass on macOS. Frozen dependency installation, package contents and license checks pass. Windows checks require repository CI.

Feature tests exercise persistent HTTP/1, multiplexed HTTP/2, upload/response streams, backpressure, cache hits, trace context, channel policies, bounded overload, a completely unavailable app, synchronous CPU cancellation, gateway/backend crashes, worker replacement, unread-body shutdown and shutdown concurrent with a gateway restart. A deterministic test reproduces the channel-close route-drain hang and verifies that client callbacks settle while accepted backend work remains reserved.

The forwarded-header fixture also binds explicitly to loopback. Its previous wildcard bind expected `0.0.0.0` as a peer address and failed on the unmodified baseline in this Linux environment.

## Performance and rollout gates

Earlier measurements remain diagnostics. The five-seed primary fixture completed 31,500 requests without response errors or leaked reservations, but did not establish a repeatable per-app tail improvement. An earlier seven-seed equal-entry forwarding comparison measured least-outstanding medians at about 97% of stock HTTP/1 throughput and 98% of HTTP/2 throughput. Wide confidence intervals prevented passing the proposed 95% repeatability gate. Those runs preceded the latest default-path optimization and overlapped some correctness testing; they are not final release evidence.

The final serial campaign uses the latest frozen production source and identical instrumentation/resource budgets. It includes seven-seed cheap forwarding, a five-seed multi-app primary matrix, isolated rate sweeps, healthy/overload/shifted traffic, two/four frontends, uniformly heavy pools, TLS, and three-seed 180-second scaler runs. Scripts retain actual deployed-source hashes, configurations, arrivals, every terminal outcome, health samples, GC observations, generation changes and server logs under `results/review/multi-app/`. The Docker VM also hosts unrelated services, so measured variation must remain visible. Nginx is excluded.

Run `BENCH_WORKSPACE=/work python3 review/multi-app/campaign.py --revision <unique-revision>` after `setup.sh` in a clean checkout. Run capacity experiments serially and after correctness tests finish. The development overlays used `/focused` instead of `/work`.

Do not promote this draft until the latest campaign demonstrates a repeatable benefit without an unacceptable cost to any app, the overhead gate passes, production SLOs/resource budgets are supplied, and a representative canary exercises normal load variation and worker replacement. The multi-app TCP/Rust comparison remains separate work; the existing single-app prototype measurements do not satisfy it. Disabling `requestRouting` and restarting returns to round robin; validate that rollback during the canary before rollout.
