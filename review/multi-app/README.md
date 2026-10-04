# Multi-application routing experiments

One Watt runtime hosts catalog, rendering, search/cache and personalization applications. Each has two worker threads. Their heap live sets, allocation churn, real synchronous CPU work and background CPU hotspots differ. A Watt gateway forwards all routes. Each request is validated for application, worker and request identity.

The original single-app matrix remains in `review/benchmark/`; it is not evidence of multi-app performance. This fixture is synthetic and does not claim to reproduce Booking.com's proprietary traffic.

## Controls and policies

Every server run uses four CPU IDs, a four-CPU quota and a 2 GiB memory/swap limit, including all apps, the gateway and runtime supervisor. The client has four different CPU IDs. Workers have a 256 MiB configured total heap budget: 240 MiB old generation and 16 MiB young generation. The recorded roles use native ARM Linux (setup defaults to the Docker host architecture), UID/GID 65534, capabilities dropped, default seccomp, no-new-privileges and read-only root. Baseline container memory includes installed source/dependency page cache; whole-instance RSS is recorded separately.

- `rr`: original round-robin selection with no request reservations.
- `least`: opt-in maintained mesh integration, using shared reservation slots, bounded to 64 per backend in this fixture.
- `pressure`: benchmark-only preference atop least outstanding. Prefer ready workers with a health sample no older than 1500 ms, interval ELU below 0.85 and heap-used/heap-size-limit below 0.85. Try preferred workers first, then remaining ready workers in least-outstanding order before rejecting capacity. Metric samples are taken every 250 ms; actual sample times are retained. This is a preference, not a predicted-service-time model, and is not enabled by the public configuration schema.

The pressure policy is set only by this experiment's service plugin. The public implementation does not require application hooks for completion accounting. Benchmark health instrumentation is present in every variant. Distinct app identities are never interchangeable.

Retained heap targets above each worker's baseline are 1 MiB catalog, 8 MiB rendering, 32/128 MiB search and 32/80 MiB personalization. Retained JavaScript object graphs are attached to the app to keep them live. Search allocates 12,000 temporary objects per request; personalization 8,000, retaining the last three batches. Byte buffers are not used to simulate V8 heap pressure. Actual heap/GC measurements determine the achieved pressure; nominal allocation targets alone do not prove it.

Worker 0 of rendering runs 75 ms background CPU bursts every 90 ms; worker 0 of personalization runs 40 ms bursts every 90 ms. These are independent of request reservations. The request work uses one common PBKDF2 calibration, with rendering uniformly 100–400 nominal ms and personalization 30–150 nominal ms. Catalog/search wait 1 ms asynchronously; this is paired with their different live-set/allocation profiles.

## Runs and evidence

`python3 review/multi-app/run.py --suite primary` runs five seeds, three policies, HTTP/1.1 and HTTP/2, with 30-second offered load after five-second warmup. Default mix is 50/20/20/10 at 35 total requests/s. The HTTP/2 generator multiplexes all applications over one persistent connection. HTTP/1.1 has per-app persistent agent pools. Seeded arrival schedules are identical across policies for each case. Latency starts at planned arrival; the 30-second deadline includes client queueing. All errors are retained; success-only percentiles are censored if any deadline occurs.

Additional suites: `--suite tls` uses disposable local certificates; `--suite scaler` runs at least 180 seconds, enables runtime-wide `workers.dynamic: true`, observes every unmodified scaler recommendation and records generation changes. App-level dynamic flags alone do not enable the runtime scaler. The driver fails a scaler case with no recorded decision checks. `--suite rates` tests healthy, overload and rendering-heavy traffic; `--suite isolated` measures each app separately over a rate sweep; `--suite frontends` tests two/four gateway workers; `--suite uniform` removes background-worker hotspots. `--smoke` is an explicitly short diagnostic, not a release result. `--resume` reuses completed labels. Never resume across a change in deployed sources; keep revisions in separate output directories.

`campaign.py --revision <name>` runs isolated sweeps before the mixed workload and saves `load-profile.json`. The maximum observed successful goodput within each isolated arrival window provides a diagnostic rate anchor; dividing by the initial traffic share and taking the smallest value gives the mixed anchor. Primary runs use 60% of that anchor; rate sweeps use 35%, 80% and 130%, plus a shift toward rendering at the same primary total rate. All isolated points, errors and tails remain in the profile. These single-seed anchors do not establish sustainable production capacity, an SLO or healthy operation with shared-app background hotspots. The 35 requests/s default above remains available for standalone historical diagnostics; `--load-profile` selects the derived rates.

Scripts are in `review/multi-app/`. Every run records `.client.json` (arrivals, responses/errors and per-app tails/goodput), `.health.json` (per-worker time series, ELU, heap limit, external/ArrayBuffer memory, GC count/time, event-loop delay and accounting), and `.server.log`. Suite summaries retain before/after container CPU/memory/OOM counters. Count metrics for expired/retired workers need not equal successful requests; failure tests check reclamation separately.

The interrupted first primary matrix (eight completed runs; not release evidence) uses the archived `dependency-primary-v1.tar.gz`, with 32-bit non-wrapping leases. The supported implementation uses 64-bit leases and an occupancy bitmap so sustained throughput does not exhaust a worker generation after a few days. Report the revision for each experiment and rerun the supported implementation before using results as final release evidence.

## Pending release work

Representative production SLOs and a canary destination have not been supplied. The local matrix evaluates scheduling behavior, not a production release decision. Transport/frontend sweeps, TLS, scaler-enabled runs and final policy-overhead comparisons are separate checks; mark them complete only after execution and saved evidence. Nginx is excluded.

Run `bash review/multi-app/setup.sh` in a clean environment to provision the containers. Names are reserved by this experiment; reuse or remove only its own containers. The recorded development runs used frozen source overlays; `deployed-final-source.tar.gz` retains their exact source. Regenerate disposable TLS material with `openssl req -x509 -newkey rsa:2048 -nodes -keyout review/multi-app/tls/key.pem -out review/multi-app/tls/cert.pem -days 3 -subj /CN=watt-multi-server` and make the local fixture key readable by the non-root test user.


## Baseline and provenance

The forwarding diagnostic uses pristine `undici-thread-interceptor` 1.5.0 (`stock`), maintained round robin (`rr`) and reservations (`least`). All variants use the same benchmark-only entry module, with no custom loader threads. Production never loads that entry module. Default routing delegates directly to the original request handler until a configured or newly published routed target enables selection. Each experiment fingerprints deployed source, lockfile and fixture files; per-run runtime configuration is saved alongside responses and health data.

Run `python3 review/multi-app/forwarding.py --revision forwarding-release --seeds 7 --seconds 30` and `python3 review/multi-app/forwarding-analyze.py forwarding-release`. Keep all runs and errors. The older loader baseline and runs that overlapped correctness testing are retained as diagnostics. Do not combine their measurements with the final campaign.

The short forwarding cohort did not pass the repeatability gate. A separately declared steady-state cohort uses seeds 8–14, 15-second server warmup and 60-second measurement for every variant: `forwarding.py --revision release-v18-steady-forwarding --first-seed 8 --seeds 7 --warmup 15 --seconds 60`. Keep its statistics separate from the short cohort. Longer warmup/measurement is an experiment to reduce cold-start and short-window variation, not grounds to discard either cohort or relax the 95% gate. v18 changes the benchmark scaler fixture while preserving identical production routing source.

Aggregate with `analyze.py <revision>` and `forwarding-analyze.py <revision>`. `report.py` combines explicitly named fixed-worker, corrected scaler and separate forwarding cohorts into a release evaluation and compact evidence, excluding the six scaler-labelled v17 cases that never enabled scaling. It preserves all per-app outcomes and labels incomplete release gates.

The recorded v17/v18 gateway plugin was encapsulated away from proxy routes. Its global per-thread ELU/heap/GC samples are valid, but gateway request counters and identity headers are unavailable. Backend identity and shared reservation checks remain valid. The corrected fixture wraps that plugin with `fastify-plugin`; new clients require gateway identity. Separate two/four-gateway HTTP/1/HTTP/2 smoke cases validate the correction, without relabelling the earlier runs or treating smoke latency as capacity evidence. One persistent HTTP/2 connection can use only one gateway worker even when more are started; a frontend throughput comparison needs multiple connections as well.

Use `--policies rr least` and `--protocols h1 h2` to select explicitly documented diagnostic subsets. The primary workload keeps all three policies and at least five seeds. Every revision has its own output directory; never resume after changing deployed source. Start only one benchmark runner at a time, and run capacity measurements after correctness tests have stopped.
