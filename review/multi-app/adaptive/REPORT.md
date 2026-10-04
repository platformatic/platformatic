# Queue, health and admission evaluation

**Release decision: hold.** These are controlled synthetic diagnostics with user production SLOs and a canary still unspecified. Health-aware selectors remain benchmark-only. The existing public opt-in least-outstanding policy is unchanged.

**Measured direction: prioritize app worker allocation and retain round robin for this fixture.** With round robin, median rendering p99 fell from 914.8 to 539.4 ms (41.0% lower) when the corrected scaler changed allocation. Those three dynamic round-robin runs had 21,870 arrivals and 0 failures. Neither experimental ELU preference established a benefit over admission alone at fixed allocation; the pilot-derived limits introduced avoidable failures at the primary load. Do not promote those limits or health preferences as production defaults.

The production change fixes two existing scaler defects: selection now compares the stored candidate ELU correctly, including the fewer-workers tie-break; metric retention now uses the 60-second window without multiplying milliseconds by 1,000 again. Three regressions fail before the changes and pass afterward. All 44 scaler unit/integration tests pass; five experimental policy-bound/freshness tests pass. Production commit `280608ce9` has 242 successful CI checks and one neutral check in the saved snapshot.

The three completed cohorts contain 33 cases and 231,822 planned arrivals. There are 4,500 failed arrivals, including 3,222 explicit admission rejections. These failures remain in all offered-arrival denominators. Final reservation snapshots settle to zero. Successful-response percentiles below are conditional on success and must be read alongside failures.

## Method

The same four apps share a four-CPU, 2 GiB restricted Linux server. Every variant collects per-worker V8 heap/GC, supervisor ELU and request timing. The supervisor samples native worker handles every 100 ms; the fixture exports generation-scoped shared health to request selectors. The low-load pilot saw rendering self-published health gaps up to 1,206 ms versus 123 ms for supervisor samples. This establishes fresher collection in that pilot, not a latency improvement by itself.

Limits were fixed before comparison from measured pilot handler-service p95 and declared synthetic queue budgets: catalog 11, rendering 2, search 4, personalization 1. The formula is `min(64, max(1, 1 + floor(queueBudgetMs / serviceP95Ms)))`. These are experimental concurrency caps, not an adaptive controller or an enforced queue deadline.

`rr` is default round robin. `least` is least outstanding with 64 slots. `limited` uses least outstanding with the derived limits. `tie` prefers lower ELU only among equally least-loaded workers. `bounded` permits a pre-dispatch difference of one outstanding request when preferring lower ELU. Both health variants use 10-percentage-point bands and fall back to least outstanding when any eligible worker lacks a sample from the last 300 ms. The production reservation and completion protocol is unchanged.

Fixed and scaler runs use identical arrivals for seeds 21–23 at 24.3 total rps, 300 seconds after 15 seconds of warmup. The overload cohort uses the same mix at 52.65 rps for 120 seconds. Cases run serially in randomized order. The unrelated services in the Docker VM remain running. Three seeds and five-minute runs improve the previous tail-sample resolution but do not establish production confidence. The protocol/policy integration was smoke-tested separately over HTTP/1 and HTTP/2; the longer comparisons use HTTP/1.

Timely success means a successful response completed within the declared planned-arrival budget: catalog 50 ms, rendering 800 ms, search 75 ms, personalization 250 ms. These are diagnostic thresholds, not supplied production SLOs. A quick rejection is never counted as timely success.

## Fixed worker allocation

Values are medians across three seeds, with failures summed across those runs.

| App | Policy | Offered / failed | Timely success | Successful p99 ms (range) | Dispatch-to-handler p95 ms | Handler p95 ms |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| catalog | rr | 11,006 / 0 | 100.00% (100.00%–100.00%) | 10.1 (9.4–11.2) | 0.4 | 2.6 |
| catalog | least | 11,006 / 0 | 100.00% (100.00%–100.00%) | 11.3 (10.7–11.5) | 0.4 | 2.4 |
| catalog | limited | 11,006 / 0 | 100.00% (100.00%–100.00%) | 10.5 (10.2–11.6) | 0.4 | 2.8 |
| catalog | tie | 11,006 / 0 | 100.00% (100.00%–100.00%) | 9.9 (9.5–11.0) | 0.6 | 2.4 |
| catalog | bounded | 11,006 / 0 | 100.00% (99.81%–100.00%) | 10.5 (10.5–12.7) | 0.4 | 2.7 |
| rendering | rr | 4,439 / 0 | 97.72% (97.59%–98.14%) | 914.8 (862.3–958.7) | 378.1 | 381.2 |
| rendering | least | 4,439 / 0 | 96.90% (95.70%–99.52%) | 956.8 (720.4–1101.8) | 427.9 | 411.1 |
| rendering | limited | 4,439 / 129 | 96.97% (96.94%–97.38%) | 636.0 (612.2–646.7) | 238.9 | 379.8 |
| rendering | tie | 4,439 / 171 | 96.61% (94.56%–96.90%) | 697.6 (657.3–765.8) | 287.4 | 399.1 |
| rendering | bounded | 4,439 / 181 | 96.09% (95.32%–96.15%) | 698.6 (636.8–745.2) | 295.3 | 387.5 |
| search | rr | 4,276 / 0 | 100.00% (100.00%–100.00%) | 17.1 (15.1–17.3) | 0.4 | 5.9 |
| search | least | 4,276 / 0 | 100.00% (100.00%–100.00%) | 16.8 (15.9–19.1) | 0.4 | 6.0 |
| search | limited | 4,276 / 0 | 100.00% (100.00%–100.00%) | 17.8 (17.4–18.2) | 0.5 | 5.5 |
| search | tie | 4,276 / 0 | 100.00% (100.00%–100.00%) | 17.6 (17.1–18.5) | 0.5 | 5.5 |
| search | bounded | 4,276 / 0 | 100.00% (99.78%–100.00%) | 17.0 (13.9–21.7) | 0.5 | 6.2 |
| personalization | rr | 2,149 / 0 | 100.00% (100.00%–100.00%) | 189.5 (176.9–200.5) | 31.4 | 149.0 |
| personalization | least | 2,149 / 0 | 100.00% (99.87%–100.00%) | 183.8 (178.1–189.3) | 34.9 | 146.4 |
| personalization | limited | 2,149 / 27 | 98.68% (98.61%–98.93%) | 182.2 (182.1–201.0) | 33.0 | 152.3 |
| personalization | tie | 2,149 / 25 | 99.06% (98.19%–99.27%) | 178.6 (177.3–180.1) | 21.5 | 152.2 |
| personalization | bounded | 2,149 / 23 | 98.75% (98.66%–99.12%) | 178.6 (167.7–207.4) | 23.6 | 155.5 |

## Dynamic worker allocation

Values are medians across three seeds, with failures summed across those runs.

| App | Policy | Offered / failed | Timely success | Successful p99 ms (range) | Dispatch-to-handler p95 ms | Handler p95 ms |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| catalog | rr | 11,006 / 0 | 100.00% (100.00%–100.00%) | 9.8 (9.1–10.2) | 0.3 | 2.6 |
| catalog | limited | 11,006 / 0 | 100.00% (100.00%–100.00%) | 10.6 (10.2–10.8) | 0.3 | 2.7 |
| catalog | bounded | 11,006 / 0 | 100.00% (100.00%–100.00%) | 10.5 (8.2–10.7) | 0.3 | 2.7 |
| rendering | rr | 4,439 / 0 | 100.00% (99.74%–100.00%) | 539.4 (503.9–629.4) | 139.4 | 400.2 |
| rendering | limited | 4,439 / 8 | 99.79% (99.67%–99.79%) | 599.9 (545.4–639.0) | 145.0 | 413.4 |
| rendering | bounded | 4,439 / 5 | 99.86% (99.79%–99.93%) | 665.9 (665.0–673.0) | 280.3 | 389.2 |
| search | rr | 4,276 / 0 | 100.00% (100.00%–100.00%) | 16.7 (16.3–19.9) | 0.3 | 5.7 |
| search | limited | 4,276 / 0 | 100.00% (100.00%–100.00%) | 16.2 (15.8–17.2) | 0.3 | 5.6 |
| search | bounded | 4,276 / 0 | 100.00% (100.00%–100.00%) | 18.1 (15.2–18.7) | 0.4 | 5.8 |
| personalization | rr | 2,149 / 0 | 100.00% (99.86%–100.00%) | 185.0 (184.4–200.7) | 32.5 | 152.9 |
| personalization | limited | 2,149 / 29 | 98.68% (98.33%–98.80%) | 183.4 (176.4–184.5) | 31.9 | 150.7 |
| personalization | bounded | 2,149 / 27 | 98.66% (98.47%–98.98%) | 184.3 (182.0–195.5) | 24.1 | 154.7 |

## Overload

Values are medians across three seeds, with failures summed across those runs.

| App | Policy | Offered / failed | Timely success | Successful p99 ms (range) | Dispatch-to-handler p95 ms | Handler p95 ms |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| catalog | rr | 9,529 / 0 | 100.00% (100.00%–100.00%) | 13.6 (12.2–14.1) | 0.4 | 2.4 |
| catalog | limited | 9,529 / 0 | 100.00% (100.00%–100.00%) | 13.7 (13.1–15.1) | 0.4 | 2.5 |
| catalog | bounded | 9,529 / 0 | 100.00% (100.00%–100.00%) | 12.9 (10.3–13.6) | 0.3 | 2.5 |
| rendering | rr | 3,829 / 1,278 | 1.92% (1.28%–2.71%) | 29808.5 (29705.9–29809.1) | 19239.9 | 397.2 |
| rendering | limited | 3,829 / 1,165 | 69.43% (68.42%–70.65%) | 729.8 (689.7–741.8) | 342.3 | 383.9 |
| rendering | bounded | 3,829 / 1,160 | 70.09% (67.85%–71.05%) | 694.1 (691.2–746.0) | 344.0 | 377.1 |
| search | rr | 3,695 / 0 | 100.00% (100.00%–100.00%) | 22.8 (19.5–22.9) | 0.7 | 7.7 |
| search | limited | 3,695 / 0 | 100.00% (100.00%–100.00%) | 19.5 (18.7–23.7) | 0.6 | 6.4 |
| search | bounded | 3,695 / 0 | 100.00% (99.92%–100.00%) | 21.5 (21.0–21.7) | 0.7 | 6.6 |
| personalization | rr | 1,901 / 0 | 99.51% (99.20%–99.85%) | 234.4 (226.2–236.9) | 43.4 | 151.6 |
| personalization | limited | 1,901 / 137 | 92.82% (91.21%–93.50%) | 199.8 (190.5–204.2) | 32.9 | 160.7 |
| personalization | bounded | 1,901 / 135 | 93.81% (90.58%–93.96%) | 208.6 (196.2–208.9) | 30.1 | 152.2 |

Rendering's fraction of offered arrivals completed successfully within 800 ms rises from 1.92% with round robin to 69.43% with admission alone and 70.09% with bounded ELU preference. Round robin has 1,278 deadline failures; admission alone has 1,165 explicit rejections. Admission therefore protects useful work under overload in this fixture. The small difference between the two capped policies does not establish an ELU-selection benefit from three seeds.

The same fixed limits are too restrictive at the primary load, particularly personalization with one slot per worker. This supports evaluating per-app overload protection alongside worker allocation; it does not validate the pilot formula as a shipping controller. The overloaded round-robin successful-response p99 approaches the 30-second client deadline, with later outcomes counted as failures rather than removed.

## Resources

Average CPU including observed drain ranges 2.29–2.99 cores. Before/after process RSS ranges 730.5–1141.8 MiB; cgroup memory ranges 728.1–1151.6 MiB. These are endpoint memory observations, not continuous peaks. OOM events: 0; OOM kills: 0. Worker RSS is never summed as separate process memory.

The following backend profiles are medians of per-run health quantiles across the three fixed-allocation round-robin cases. Timelines include warmup and observed drain. ELU measures event-loop activity, not CPU share. The profiles confirm distinct CPU and retained V8 heap pressure; they do not exercise heap exhaustion. The gateway retains self-published health but is outside the supervisor backend sampler.

| Worker | Supervisor ELU p50 / p99 | Heap MiB p50 / p99 | Heap/limit p99 |
| --- | ---: | ---: | ---: |
| catalog:0 | 0.006 / 0.027 | 33.1 / 59.5 | 0.225 |
| catalog:1 | 0.006 / 0.022 | 34.3 / 64.5 | 0.244 |
| personalization:0 | 0.489 / 1.000 | 73.7 / 82.9 | 0.314 |
| personalization:1 | 0.003 / 1.000 | 121.5 / 138.4 | 0.524 |
| rendering:0 | 1.000 / 1.000 | 37.9 / 44.8 | 0.170 |
| rendering:1 | 0.857 / 1.000 | 40.8 / 44.8 | 0.170 |
| search:0 | 0.003 / 0.342 | 73.7 / 86.6 | 0.328 |
| search:1 | 0.003 / 0.727 | 197.2 / 210.9 | 0.799 |

## Actual scaling

| Case | Recommendations | Started / stopped / exited |
| --- | --- | --- |
| scaler-mixed-bounded-h1-f1-s22 | catalog→1, search→1, rendering→3 | 10 / 2 / 2 |
| scaler-mixed-limited-h1-f1-s23 | catalog→1, search→1, rendering→3 | 10 / 2 / 2 |
| scaler-mixed-limited-h1-f1-s22 | catalog→1, search→1, rendering→3 | 10 / 2 / 2 |
| scaler-mixed-rr-h1-f1-s23 | catalog→1, search→1, rendering→3 | 10 / 2 / 2 |
| scaler-mixed-rr-h1-f1-s22 | catalog→1, search→1, rendering→3 | 10 / 2 / 2 |
| scaler-mixed-limited-h1-f1-s21 | catalog→1, search→1, rendering→3 | 10 / 2 / 2 |
| scaler-mixed-bounded-h1-f1-s21 | catalog→1, search→1, rendering→3 | 10 / 2 / 2 |
| scaler-mixed-bounded-h1-f1-s23 | catalog→1, search→1, rendering→3 | 10 / 2 / 2 |
| scaler-mixed-rr-h1-f1-s21 | catalog→1, search→1, rendering→3 | 10 / 2 / 2 |

## Interpretation and limits

Compare `limited` with `least` to assess admission, then compare `tie`/`bounded` with `limited` to assess health-based selection. A lower successful-response p99 with more failed arrivals does not alone demonstrate a better service. Compare fixed and dynamic allocation separately; each app retains its identity and its own worker pool.

Dispatch-to-handler time includes mesh transport and framework/event-loop waiting. Handler time excludes response serialization and delivery; end-to-end arrival latency includes those costs. Heap and GC are observations in this experiment, not inputs to the experimental ranking. Samples retain age, and fresh ELU is never presented as fresh heap information.

The scaler fixture permits one replica for the light apps and adds a rendering replica within the fixed total-worker/memory budget. This is not an availability recommendation. Worker-index-specific background CPU and cache sizes are synthetic asymmetries; changing worker membership can change those costs. The live-set fixture does not model downstream cache-miss costs or framework cold starts. Fixed and dynamic cohorts ran successively, not as a randomized allocation A/B. The results do not establish savings for a production Booking.com workload.

Production app demand, latency/error budgets and minimum replica requirements remain unspecified. Multi-app private TCP/Rust, frontend saturation with multiple HTTP/2 connections, the previous forwarding-confidence gate, representative canary and verified rollback remain open. No nginx comparison or Rust rewrite is claimed.

## Evidence

Raw results are under `results/review/multi-app/adaptive-v23-fixed/`, `adaptive-v23-scaler/` and `adaptive-v23-overload/`; pilot and limits are in `adaptive-v22-pilot/`. Each cohort preserves individual arrivals, response/error bodies, queue/service timing, health timelines, generation events, recommendations, configuration and logs. `adaptive-v23-deployed-source.tar.gz`, `adaptive-v23-plan.json` and `adaptive-v23-client-manifest.json` preserve deployed-source and client provenance. Exact host drivers and runtime/source hashes are saved in each suite. Before the later cohorts, the post-client observation deadline was extended to 180 seconds so overload work can drain after client timeouts; arrivals, client deadlines and policies were unchanged. This is recorded in `adaptive-v23-observation-amendment.json`; the fixed cohort retains its original captured driver.

Recompute with `python3 review/multi-app/adaptive/summarize.py <summary.json> <fixed-directory> <scaler-directory> <overload-directory>` and `python3 review/multi-app/adaptive/report.py <summary.json> <REPORT.md>`. The generation step requires all 33 declared cases. See `README.md` and `experiment-plan.json` for policy definitions and the frozen design.
