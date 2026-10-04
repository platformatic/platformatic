# Queue, health and admission experiment

The completed comparison and decision are in [REPORT.md](REPORT.md). Compact results, CI checks and deployed-source provenance are in `../evidence/adaptive-v23-*` and `../evidence/pr-ci-head-280608ce9.json`.

This experiment follows the v17/v18 release evaluation. It does not change the public routing configuration. The only production changes in this iteration fix the existing scaler's candidate comparison and metric retention window. The selector, supervisor sampler and request timing below are benchmark fixtures.

## Comparators

All policies use the same four applications, background work, retained V8 objects, CPU/memory limits, instrumentation and seeded arrivals. Worker counts remain fixed first; the second cohort enables the corrected existing scaler with the previous nine-worker/1.5 GiB scaling budgets. The declared matrix is in `experiment-plan.json`.

| Policy | Admission | Selection |
| --- | --- | --- |
| `rr` | Existing default, without shared request reservations | Round robin |
| `least` | 64 reservations per backend | Least outstanding |
| `limited` | Pilot-derived per-app limits | Least outstanding |
| `tie` | Same limits as `limited` | Prefer lower ELU only among equally least-loaded workers |
| `bounded` | Same limits as `limited` | Prefer lower ELU among workers with at most one more outstanding request than the minimum |

`bounded` limits the pre-dispatch difference to one reservation. Admitting the new request can make the difference two; concurrent dispatchers still use approximate snapshots. The production lease slots enforce the hard per-worker capacity limit. Both health variants use ten-percentage-point ELU bands, preserving rotated ties within a band. If any eligible worker has missing health or a sample older than 300 ms, they fall back to least outstanding. They never select an unready/draining generation or a TCP backend. They reuse the existing acceptance, completion, crash and retirement behavior.

## Signals and timing

The supervisor reads each native worker handle's interval ELU every 100 ms and publishes it in the existing shared buffer. Collection does not ask the worker to execute a JavaScript timer. Every policy pays for the same collection. Per-worker heap/GC/loop-delay timers continue to record actual sample ages. Heap is observed; it does not enter the experimental ranking. No fresh-heap claim is inferred from a fresh supervisor ELU sample.

The benchmark mesh entry adds a process-monotonic dispatch timestamp through the supported client request hook for every policy. The backend reports dispatch-to-handler delay and handler service time. The former includes transport, framework handling and event-loop waiting; it is not an isolated queue-time measurement. The latter excludes response serialization and delivery. The client still records full planned-arrival-to-completion latency, including generator delay and client queueing. All successful responses must have valid application, worker, gateway, request identity and finite nonnegative timing.

The pilot uses the prior CPU calibration and a 14.175 rps mixed workload. Its measured handler-service p95 derives fixed limits using `min(64, max(1, 1 + floor(queueBudgetMs / serviceP95Ms)))`. Queue budgets are declared before the pilot: catalog/search 25 ms, rendering 400 ms, personalization 150 ms. The resulting limits are catalog 11, rendering 2, search 4 and personalization 1. This is a sizing experiment, not an adaptive controller or a latency guarantee. I/O concurrency, service-time variance, GC and background CPU can all invalidate the approximation.

## Evaluation

Primary/scaler runs last 300 seconds after 15 seconds of warmup, with seeds 21–23 and identical arrivals for matching cases. HTTP/1 is the primary diagnostic protocol; separate HTTP/1/HTTP/2 smoke cases verified the instrumentation and policy integration. Five-minute runs increase the number of tail observations relative to the previous 30-second runs, but three seeds do not establish production SLOs or release confidence. Report sample counts and tail order-statistic resolution rather than implying that a larger total guarantees precision.

Preserve every planned arrival, admission rejection and deadline. A 503 is an unsuccessful arrival, even when it returns promptly. Report successful-response latency conditionally alongside success/rejection totals, successful window goodput and the fraction of all offered requests completing successfully within declared arrival-latency budgets: catalog 50 ms, rendering 800 ms, search 75 ms, personalization 250 ms. These thresholds are synthetic diagnostics, not user-approved production requirements. A lower conditional p99 obtained by dropping more requests is not sufficient evidence of improvement.

Compare `limited` against `least` to measure admission, and `tie`/`bounded` against `limited` to measure selection. Compare fixed and dynamic allocation separately. Keep all cohorts and outliers; do not pool v17/v18 with this instrumentation. No nginx experiment is included. Rust/TCP capacity, multi-connection HTTP/2 frontend capacity, actual production SLOs and canary/rollback remain separate release work.

## Reproduction and evidence

The recorded deployment uses `watt-adaptive-server`, the existing dedicated `watt-multi-client`, the same native ARM Linux images and disjoint four-CPU server/client assignments. The server remains non-root, read-only, capability-free and under the previous 2 GiB limit. The unrelated Docker services remain running. `adaptive-v23-deployed-source.tar.gz` captures the frozen deployed overlays; each suite also records actual source hashes, its exact loaded driver and runtime/container settings. The scaler file is fingerprinted explicitly.

Run `node --test review/multi-app/adaptive/policy.test.js` for selector bounds and stale-health fallback. The ten protocol/policy smoke cases are in `results/review/multi-app/analysis-v21/`. They include expected capacity rejections and verify integrity, not performance. Pilot output and the fixed limits are in `adaptive-v22-pilot/`. Use `derive-limits.py <pilot-directory> <limits.json>` to recompute them. `campaign.py` runs the declared fixed, scaler and overload cohorts serially; it refuses to overwrite an existing archive/cohort. Set `BENCH_WORKSPACE` to the frozen deployment root and `BENCH_RESULTS_ROOT` to the desired raw-output directory.

Run `summarize.py <output.json> <cohort-directory>...` only on completed cohorts. It validates unique terminal outcomes, request identity, matching arrival schedules, error classification and settled reservations before aggregating. Raw per-request results, health timelines, recommendations and server logs remain alongside the summaries.

The fixed cohort captured the original post-client drain observer. Before scaler/overload, that observer was extended to a monotonic 180-second deadline so accepted backend work could finish after client deadlines. Arrivals, policies and client deadlines did not change. The amendment and both exact driver hashes are preserved; longer observation never converts a client timeout into success.

Generate the completed report with `python3 review/multi-app/adaptive/report.py <summary.json> <REPORT.md>`. It requires the full declared 33-case matrix. The committed summary includes per-case p50/p95/p99, offered and failed counts, timely and window goodput, per-worker health, resource observations and scaling events. Full raw arrays and the frozen source archive remain under `results/review/multi-app/` rather than being embedded in the PR.
