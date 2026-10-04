# Multi-app request-routing release evaluation

**Release verdict: hold.** The opt-in mesh implementation passes correctness checks, but these workloads do not establish a repeatable latency benefit for least outstanding. The experimental ELU/heap preference is worse on rendering. Production per-app SLOs, error budgets and a representative canary remain unspecified. Keep round robin as the default; this report does not recommend a Rust rewrite or make an nginx comparison.

## Implementation and validation

Draft PR: [platformatic/platformatic#5157](https://github.com/platformatic/platformatic/pull/5157). Measured production source is `dd9c49ed64eeee5fc918cf1e72eac3cd807a403d`, based on upstream `8f6b4e5ee2670d2148655d34235561ee6191248f` with Fastify 5.12.5. Request selection is per app and per HTTP request, including persistent HTTP/1 connections and multiplexed HTTP/2 streams. Shared bounded reservations remain held until backend completion or actual backend exit; client cancellation alone does not free accepted work.

All 42 targeted tests pass on Linux Node 22, 24 and 26 and in restricted non-root Linux. The current default lifecycle/channel cases (26), gateway cases (20), lint, packaging/license checks and post-rebase types pass. The implementation/evidence heads `7238c6cb5` and `c9fdbacd0` each had 243 successful CI checks and one neutral check. Raw validation logs and the CI snapshot are in `evidence/`. The original runtime-main run failed; preserved corrective runs and CI, rather than that failed run, establish validation. A reproduced scale-up/shutdown bootstrap-retry hang was fixed and has a regression test. Production requires neither SQLite nor a native memory-map addon.

## Controls and integrity

One real Watt instance hosts four apps, initially two workers per app and one gateway. All share four CPU IDs, a four-CPU quota and 2 GiB container memory with no additional swap. Workers have 240 MiB old/16 MiB young generation limits. A separate four-CPU client drives seeded open-loop arrivals; HTTP/2 uses one persistent connection across all apps. Every policy includes the same health instrumentation. Native ARM Linux uses UID 65534, dropped capabilities, default seccomp, no-new-privileges and a read-only root. The Docker VM hosts unrelated services; all run variation and outliers are retained.

There are 114 valid multi-app cases: 108 fixed-worker cases plus six corrected 180-second scaler cases. They contain 166,122 planned arrivals, 0 failed responses and no remaining reservations. Every arrival has one terminal outcome and distinct request identity. No error or deadline is dropped from the saved results. Capacity rejection is verified by targeted tests; these campaign cases must not be described as demonstrating rejection when they produced none.

Isolated sweeps cover three rates per app. Maximum successful goodput during the arrival window is a diagnostic anchor, not sustainable capacity or an SLO. The mixed anchor is the smallest isolated anchor divided by its initial share. Primary traffic is 60% of that anchor. Isolated runs disable background hotspots; they are not matched-load estimates of the cost of cohosting. Primary/rate runs preserve hotspots and share the CPU/memory budget.

| App | Isolated window-goodput anchor (rps) |
| --- | --- |
| catalog | 999.93 |
| rendering | 8.10 |
| search | 282.97 |
| personalization | 21.77 |

The mixed anchor is 40.50 rps; primary is 24.30, healthy 14.175, near 32.40 and overload 52.65. The rendering-heavy case changes shares from 50/20/20/10 to 20/50/20/10 at the primary total rate. These names denote diagnostic offered-load points, not certified operational states.

## Primary per-app tails

Values are median arrival-based p99 milliseconds across five seeds, with the full minimum–maximum range. Each primary run measures 30 seconds after five seconds of warmup. `pressure` is the predeclared benchmark-only preference for fresh ELU <0.85 and heap ratio <0.85, with least-outstanding fallback; it is absent from the public configuration.

| Protocol | App | Round robin | Least outstanding | ELU/heap preference |
| --- | --- | --- | --- | --- |
| h1 | catalog | 10.8 (9.9–14.2) | 9.7 (7.7–13.2) | 10.3 (8.4–13.3) |
| h1 | rendering | 801.9 (690.6–952.7) | 805.4 (715.8–1163.2) | 1491.2 (1031.4–1780.6) |
| h1 | search | 16.5 (15.7–21.1) | 18.7 (17.8–24.7) | 20.5 (13.6–21.4) |
| h1 | personalization | 186.7 (163.1–214.2) | 196.6 (171.6–236.1) | 182.0 (178.0–229.9) |
| h2 | catalog | 12.0 (9.0–15.5) | 11.1 (8.7–15.5) | 12.5 (9.1–14.8) |
| h2 | rendering | 805.6 (774.3–1005.3) | 803.5 (666.7–878.9) | 1100.8 (887.1–1616.6) |
| h2 | search | 17.5 (17.2–19.8) | 19.0 (16.1–21.0) | 19.2 (14.0–20.1) |
| h2 | personalization | 178.3 (176.2–198.3) | 187.2 (177.0–188.4) | 175.3 (163.6–218.2) |

Rendering tails are approximately unchanged with least outstanding at the primary load. The binary pressure preference shifts selections toward the worker without background CPU bursts, yet has worse rendering tails; these measurements do not isolate the cause. Request reservations do not measure background CPU demand, GC cost or remaining service time. Neither policy is established as the final production scheduling solution by these results.

## Load sweeps and frontend variants

Rate cases use three seeds, HTTP/1 and one gateway. Values below retain the median and full range for every app.

| Case | App | Round robin p99 ms | Least outstanding p99 ms |
| --- | --- | --- | --- |
| healthy | catalog | 8.8 (6.9–9.5) | 9.4 (7.5–9.5) |
| healthy | rendering | 533.2 (463.5–797.7) | 569.0 (496.5–697.3) |
| healthy | search | 16.3 (16.3–18.3) | 15.6 (13.4–21.8) |
| healthy | personalization | 161.4 (158.3–195.6) | 172.4 (171.2–189.0) |
| near | catalog | 9.5 (9.0–12.6) | 11.6 (11.1–15.1) |
| near | rendering | 1504.7 (1151.3–2023.1) | 1402.5 (1034.7–1495.4) |
| near | search | 16.9 (16.1–21.4) | 19.8 (16.5–21.4) |
| near | personalization | 190.8 (171.5–194.9) | 186.1 (162.5–205.8) |
| overload | catalog | 12.0 (11.4–15.1) | 12.7 (10.5–13.0) |
| overload | rendering | 11858.7 (11025.7–12162.8) | 11229.3 (10170.6–11480.1) |
| overload | search | 22.4 (17.9–23.9) | 21.9 (19.1–26.0) |
| overload | personalization | 227.2 (211.2–229.1) | 214.0 (211.1–218.8) |
| render-hot | catalog | 11.6 (11.0–14.2) | 9.8 (7.1–20.4) |
| render-hot | rendering | 15204.4 (14186.3–19686.5) | 16287.5 (13881.8–18822.6) |
| render-hot | search | 16.4 (16.0–20.0) | 18.1 (16.1–24.0) |
| render-hot | personalization | 180.9 (180.0–238.4) | 195.7 (176.7–231.2) |

Two/four gateway workers, uniform pools and TLS have three seeds per variant. All per-app p50/p95/p99, goodput and error totals are retained in `evidence/multi-app-results.json`; the raw configuration, arrival results and health files remain in the local cohort directories. More gateway workers do not add to the shared four-CPU budget. The multi-app TCP/Rust comparison remains open: the single-app prototype has different completion/failure semantics and cannot certify this request-reservation contract.

The recorded gateway plugin’s request hooks were encapsulated away from proxy routes: gateway request counters and identity headers are unavailable, rather than measured zero. Global per-thread ELU/heap/GC samples remain valid; backend identity checks and current reservation snapshots remain valid. The fixture now uses an unencapsulated Fastify plugin and requires gateway identity in new runs. HTTP/2 intentionally uses one connection, so a two/four-gateway case can still use only one frontend; these cases do not prove frontend throughput scaling. A complete frontend capacity comparison with corrected instrumentation remains open.

The correction passed 12 separate HTTP/1/HTTP/2 smoke cases with two/four gateways: every response has a valid gateway identity and actual served counters advance. Those cases and their source archive are in `results/review/multi-app/gateway-instrumentation-v19/`; they verify instrumentation, not capacity or latency gains.

## Achieved worker pressure and resources

These profiles pool the five primary HTTP/1 round-robin health timelines; ELU is interval event-loop activity, not measured CPU share. Heap values refer to V8 objects, with external/ArrayBuffer memory recorded separately.

| App:worker | ELU p50 / p99 | Heap MiB p50 / p99 | Heap/limit p99 |
| --- | --- | --- | --- |
| catalog:0 | 0.004 / 0.113 | 30.0 / 56.7 | 0.215 |
| catalog:1 | 0.004 / 0.104 | 33.5 / 66.3 | 0.251 |
| gateway:0 | 0.013 / 0.113 | 29.7 / 32.6 | 0.124 |
| personalization:0 | 0.453 / 0.822 | 72.7 / 83.8 | 0.317 |
| personalization:1 | 0.002 / 0.671 | 143.2 / 169.4 | 0.642 |
| rendering:0 | 0.941 / 1.000 | 39.5 / 47.9 | 0.181 |
| rendering:1 | 0.554 / 0.998 | 37.6 / 42.4 | 0.161 |
| search:0 | 0.006 / 0.173 | 79.6 / 129.5 | 0.490 |
| search:1 | 0.006 / 0.384 | 193.3 / 209.1 | 0.792 |

The full aggregate retains per-generation GC frequency/pause deltas, allocation counts, event-loop delay and sample gaps. A blocked worker can publish stale health; the corrected driver uses the supervisor’s current shared reservation snapshot for final drain assertions. Primary/isolated runs loaded an earlier driver, whose exact source was recovered and SHA-verified; retrospective assertions also check their current shared snapshots.

The primary search/personalization samples never crossed the experimental 85% heap threshold (maximum observed ratio about 81%). These runs demonstrate distinct large live sets and repeated GC, but do not test the preference’s behavior near heap exhaustion. Its primary comparison is driven by ELU/headroom freshness. Blocked rendering workers also produced health gaps above 1500 ms; their stale samples are retained, not interpolated into fresh measurements.

Across valid cases, average measured CPU use including client drain ranges 0.31–3.51 cores. Before/after process RSS ranges 239.9–1461.6 MiB; cgroup memory ranges 215.4–1474.1 MiB. These are endpoint observations, not continuous peak measurements. OOM events: 0; OOM kills: 0. Worker RSS is never summed as independent process memory.

## Corrected scaler experiment

Runtime-wide `workers.dynamic: true` is enabled, with an initial nine workers, a nine-worker total bound, per-app minimum one/maximum three, a 1.5 GiB scaler memory budget and zero cooldown/grace. The benchmark observes every existing recommendation without changing it. All recommendation inputs, available memory and worker-generation events are retained in each `.health.json`.

| Case | Scaler checks | Recommendations | Started / stopped / exited events |
| --- | --- | --- | --- |
| scaler-mixed-rr-h1-f1-s2 | 185 | 3 | 10 / 2 / 2 |
| scaler-mixed-least-h1-f1-s2 | 185 | 3 | 10 / 2 / 2 |
| scaler-mixed-least-h1-f1-s1 | 187 | 3 | 10 / 2 / 2 |
| scaler-mixed-least-h1-f1-s3 | 187 | 3 | 10 / 2 / 2 |
| scaler-mixed-rr-h1-f1-s3 | 186 | 3 | 10 / 2 / 2 |
| scaler-mixed-rr-h1-f1-s1 | 188 | 3 | 10 / 2 / 2 |

Every corrected run recommended catalog/search scale-down to one worker and rendering scale-up to three, finishing with eight active workers including the gateway. Actual scaling with accepted requests and concurrent shutdown is also covered by integration tests. Routing within an app and allocating workers among apps remain different decisions.

The earlier six scaler-labelled cases actually held worker counts fixed. They can be used as explicitly labelled 180-second fixed-worker diagnostics: each corrected case has an identical saved arrival schedule, request content and policy. Median p99 across three seeds is below. These successive cohorts also differ in scaler health collection/observation and execution time; they are not a randomized production A/B or evidence of an SLO.

| Policy | App | Fixed-worker diagnostic p99 ms | Dynamic allocation p99 ms |
| --- | --- | --- | --- |
| rr | catalog | 9.7 | 10.8 |
| rr | rendering | 907.9 | 599.2 |
| rr | search | 18.6 | 18.3 |
| rr | personalization | 176.2 | 187.6 |
| least | catalog | 9.9 | 10.2 |
| least | rendering | 792.7 | 614.7 |
| least | search | 16.8 | 19.0 |
| least | personalization | 181.1 | 194.8 |

This diagnostic supports investigating cross-app worker allocation before adopting a new request policy. Reducing an app to one replica is a fixture assumption, not an availability recommendation. Production minimum replica counts and budgets must be supplied before using that allocation in a canary.

## Forwarding overhead

Pristine transport, maintained round robin and least outstanding use identical benchmark entry modules, dependency versions and limits. Each cohort has seven seeds per policy/protocol. The short cohort measures 20 seconds after three seconds of warmup; the prospectively declared steady cohort uses seeds 8–14, 60-second measurement and 15-second warmup. They remain separate. Bootstrap intervals resample median throughput ratios 10,000 times; no outliers are removed. The initial policy-overhead requirement is at least 95% of stock, with enough confidence to distinguish regression from variation.

| Cohort | Protocol | Policy | Median rps | Ratio to stock | Bootstrap 95% ratio | Lower bound ≥95% |
| --- | --- | --- | --- | --- | --- | --- |
| short | h1 | stock | 12928.0 | 100.00% | 100.000–100.000% | True |
| short | h1 | rr | 13441.0 | 103.97% | 85.393–122.683% | False |
| short | h1 | least | 14995.5 | 115.99% | 94.958–117.628% | False |
| short | h2 | stock | 14165.8 | 100.00% | 100.000–100.000% | True |
| short | h2 | rr | 16568.5 | 116.96% | 83.311–124.760% | False |
| short | h2 | least | 15930.2 | 112.46% | 79.498–119.147% | False |
| steady | h1 | stock | 13369.7 | 100.00% | 100.000–100.000% | True |
| steady | h1 | rr | 16097.0 | 120.40% | 84.638–125.483% | False |
| steady | h1 | least | 15122.1 | 113.11% | 79.817–117.558% | False |
| steady | h2 | stock | 16722.5 | 100.00% | 100.000–100.000% | True |
| steady | h2 | rr | 14262.4 | 85.29% | 82.265–121.023% | False |
| steady | h2 | least | 15901.6 | 95.09% | 77.759–116.157% | False |

A passing point estimate does not override a failed confidence gate. Even a passing forwarding gate would not establish per-app latency gains, production capacity or canary readiness.

## Reproduction and retained failures

Run serially after correctness tests, using `setup.sh` in a clean checkout:

```sh
bash review/multi-app/setup.sh
BENCH_WORKSPACE=/work python3 review/multi-app/campaign.py --revision <unique-name>
BENCH_WORKSPACE=/work python3 review/multi-app/forwarding.py --revision <unique-steady-name> --first-seed 8 --seeds 7 --warmup 15 --seconds 60
python3 review/multi-app/forwarding-analyze.py <unique-steady-name>
```

Recorded development commands used `/focused` instead of `/work`. The corrected fixed-worker command was `campaign.py --revision release-v17-calibrated --skip-forwarding --forwarding-revision release-v17-final-forwarding`. Scaler correction ran `run.py --revision release-v18-scaler --suite scaler --policies rr least --seeds 3 --load-profile`, reusing the saved calibration/load profile. Aggregate with `analyze.py <revision>`; generate this report with `report.py --fixed release-v17-calibrated --scaler release-v18-scaler --short release-v17-final-forwarding --steady release-v18-steady-forwarding`.

Raw output is under `results/review/multi-app/release-v17-calibrated/`, `release-v18-scaler/`, `release-v17-final-forwarding/` and `release-v18-steady-forwarding/`. Deployed-source archives/manifests are `release-v17-final-deployed-source.tar.gz`, `release-v17-final-source-manifest.json`, `release-v18-deployed-source.tar.gz` and `release-v18-source-manifest.json`. Each suite fingerprints the actual deployed source/lockfile and loaded driver. v18 changes benchmark scaler configuration/observation, with identical production routing source. The corrected scaler fixtures must not be pooled with the earlier scaler-labelled cases.

The earlier `release-v17-final` isolated labels omitted the rate and overwrote per-run health/log files; those runs are diagnostic only and the twelve points were rerun with distinct labels. The six scaler-labelled cases in `release-v17-calibrated` omitted the runtime-wide dynamic switch and are excluded from valid scaler evidence. The original short forwarding confidence failure, initial failed runtime-main run, pre-fix scaler hang, failed bootstrap-race regression and corrected runs are all retained. No gate was relaxed and no failing cohort was deleted.

## Remaining release work

The local implementation and review evidence are available, but the plan is not fully complete. A repeatable scheduling benefit for the representative high-ELU/high-heap workload remains unproven. Matched-load isolated/cohosted comparisons, the multi-app TCP/Rust contract comparison, production per-app SLOs/error/resource budgets, representative canary and validated rollback remain open. These are release gates, not permission to infer production readiness from a green test suite.
