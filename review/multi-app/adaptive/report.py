"""Render the completed diagnostic comparison without hiding failed arrivals."""
import json
import statistics
from pathlib import Path
import sys

data = json.loads(Path(sys.argv[1]).read_text())
output = Path(sys.argv[2])
groups, cases = data['groups'], data['cases']
expected = {'adaptive-v23-fixed': 15, 'adaptive-v23-scaler': 9, 'adaptive-v23-overload': 9}
for cohort, count in expected.items():
    assert sum(r['cohort'] == cohort for r in cases) == count, (cohort, 'incomplete')
    stage = {'adaptive-v23-fixed': 'primary', 'adaptive-v23-scaler': 'scaler', 'adaptive-v23-overload': 'overload'}[cohort]
    design = data['plan'][stage]
    actual = [(r['policy'], r['seed'], r['protocol']) for r in cases if r['cohort'] == cohort]
    declared = [(policy, seed, design['protocol']) for policy in design['policies'] for seed in design['seeds']]
    assert sorted(actual) == sorted(declared), (cohort, 'matrix differs from declaration')
apps = ['catalog', 'rendering', 'search', 'personalization']
total = sum(a['offered'] for r in cases for a in r['apps'].values())
failed = sum(a['failures'] for r in cases for a in r['apps'].values())
rejected = sum(a['rejections'] for r in cases for a in r['apps'].values())
fixed_rr = next(r for r in groups if r['cohort'] == 'adaptive-v23-fixed' and r['policy'] == 'rr' and r['app'] == 'rendering')
dynamic_rr = next(r for r in groups if r['cohort'] == 'adaptive-v23-scaler' and r['policy'] == 'rr' and r['app'] == 'rendering')
allocation_change = 100 * (1 - dynamic_rr['medianP99Ms'] / fixed_rr['medianP99Ms'])
dynamic_rr_runs = [r for r in cases if r['cohort'] == 'adaptive-v23-scaler' and r['policy'] == 'rr']
dynamic_rr_arrivals = sum(a['offered'] for r in dynamic_rr_runs for a in r['apps'].values())
dynamic_rr_failures = sum(a['failures'] for r in dynamic_rr_runs for a in r['apps'].values())
lines = [
    '# Queue, health and admission evaluation', '',
    '**Release decision: hold.** These are controlled synthetic diagnostics with user production SLOs and a canary still unspecified. Health-aware selectors remain benchmark-only. The existing public opt-in least-outstanding policy is unchanged.', '',
    f"**Measured direction: prioritize app worker allocation and retain round robin for this fixture.** With round robin, median rendering p99 fell from {fixed_rr['medianP99Ms']:.1f} to {dynamic_rr['medianP99Ms']:.1f} ms ({allocation_change:.1f}% lower) when the corrected scaler changed allocation. Those three dynamic round-robin runs had {dynamic_rr_arrivals:,} arrivals and {dynamic_rr_failures:,} failures. Neither experimental ELU preference established a benefit over admission alone at fixed allocation; the pilot-derived limits introduced avoidable failures at the primary load. Do not promote those limits or health preferences as production defaults.", '',
    'The production change fixes two existing scaler defects: selection now compares the stored candidate ELU correctly, including the fewer-workers tie-break; metric retention now uses the 60-second window without multiplying milliseconds by 1,000 again. Three regressions fail before the changes and pass afterward. All 44 scaler unit/integration tests pass; five experimental policy-bound/freshness tests pass. Production commit `280608ce9` has 242 successful CI checks and one neutral check in the saved snapshot.', '',
    f'The three completed cohorts contain {len(cases)} cases and {total:,} planned arrivals. There are {failed:,} failed arrivals, including {rejected:,} explicit admission rejections. These failures remain in all offered-arrival denominators. Final reservation snapshots settle to zero. Successful-response percentiles below are conditional on success and must be read alongside failures.', '',
    '## Method', '',
    'The same four apps share a four-CPU, 2 GiB restricted Linux server. Every variant collects per-worker V8 heap/GC, supervisor ELU and request timing. The supervisor samples native worker handles every 100 ms; the fixture exports generation-scoped shared health to request selectors. The low-load pilot saw rendering self-published health gaps up to 1,206 ms versus 123 ms for supervisor samples. This establishes fresher collection in that pilot, not a latency improvement by itself.', '',
    'Limits were fixed before comparison from measured pilot handler-service p95 and declared synthetic queue budgets: catalog 11, rendering 2, search 4, personalization 1. The formula is `min(64, max(1, 1 + floor(queueBudgetMs / serviceP95Ms)))`. These are experimental concurrency caps, not an adaptive controller or an enforced queue deadline.', '',
    '`rr` is default round robin. `least` is least outstanding with 64 slots. `limited` uses least outstanding with the derived limits. `tie` prefers lower ELU only among equally least-loaded workers. `bounded` permits a pre-dispatch difference of one outstanding request when preferring lower ELU. Both health variants use 10-percentage-point bands and fall back to least outstanding when any eligible worker lacks a sample from the last 300 ms. The production reservation and completion protocol is unchanged.', '',
    'Fixed and scaler runs use identical arrivals for seeds 21–23 at 24.3 total rps, 300 seconds after 15 seconds of warmup. The overload cohort uses the same mix at 52.65 rps for 120 seconds. Cases run serially in randomized order. The unrelated services in the Docker VM remain running. Three seeds and five-minute runs improve the previous tail-sample resolution but do not establish production confidence. The protocol/policy integration was smoke-tested separately over HTTP/1 and HTTP/2; the longer comparisons use HTTP/1.', '',
    'Timely success means a successful response completed within the declared planned-arrival budget: catalog 50 ms, rendering 800 ms, search 75 ms, personalization 250 ms. These are diagnostic thresholds, not supplied production SLOs. A quick rejection is never counted as timely success.', ''
]
for cohort, title in [('adaptive-v23-fixed', 'Fixed worker allocation'), ('adaptive-v23-scaler', 'Dynamic worker allocation'), ('adaptive-v23-overload', 'Overload')]:
    lines += ['## ' + title, '', 'Values are medians across three seeds, with failures summed across those runs.', '',
              '| App | Policy | Offered / failed | Timely success | Successful p99 ms (range) | Dispatch-to-handler p95 ms | Handler p95 ms |',
              '| --- | --- | ---: | ---: | ---: | ---: | ---: |']
    for app in apps:
        for policy in ['rr', 'least', 'limited', 'tie', 'bounded']:
            row = next((r for r in groups if r['cohort'] == cohort and r['app'] == app and r['policy'] == policy), None)
            if row is None:
                continue
            lo, hi = row['p99RangeMs']
            timely_lo, timely_hi = row['timelyFractionRange']
            lines.append(f"| {app} | {policy} | {row['offered']:,} / {row['failures']:,} | {row['medianTimelyFraction']:.2%} ({timely_lo:.2%}–{timely_hi:.2%}) | {row['medianP99Ms']:.1f} ({lo:.1f}–{hi:.1f}) | {row['medianQueueP95Ms']:.1f} | {row['medianServiceP95Ms']:.1f} |")
    lines.append('')
    if cohort == 'adaptive-v23-overload':
        rendering = {r['policy']: r for r in groups if r['cohort'] == cohort and r['app'] == 'rendering'}
        rr, limited, bounded = [rendering[p] for p in ['rr', 'limited', 'bounded']]
        lines += [
            f"Rendering's fraction of offered arrivals completed successfully within 800 ms rises from {rr['medianTimelyFraction']:.2%} with round robin to {limited['medianTimelyFraction']:.2%} with admission alone and {bounded['medianTimelyFraction']:.2%} with bounded ELU preference. Round robin has {rr['failures']:,} deadline failures; admission alone has {limited['rejections']:,} explicit rejections. Admission therefore protects useful work under overload in this fixture. The small difference between the two capped policies does not establish an ELU-selection benefit from three seeds.", '',
            'The same fixed limits are too restrictive at the primary load, particularly personalization with one slot per worker. This supports evaluating per-app overload protection alongside worker allocation; it does not validate the pilot formula as a shipping controller. The overloaded round-robin successful-response p99 approaches the 30-second client deadline, with later outcomes counted as failures rather than removed.', ''
        ]

cpu = [r['resources']['averageCpuCoresIncludingDrain'] for r in cases]
rss = [v / 1048576 for r in cases for v in r['resources']['rssEndpointsBytes']]
memory = [v / 1048576 for r in cases for v in r['resources']['cgroupMemoryEndpointsBytes']]
oom = sum(r['resources']['oomEvents'] for r in cases)
oom_kills = sum(r['resources']['oomKills'] for r in cases)
lines += ['## Resources', '',
          f'Average CPU including observed drain ranges {min(cpu):.2f}–{max(cpu):.2f} cores. Before/after process RSS ranges {min(rss):.1f}–{max(rss):.1f} MiB; cgroup memory ranges {min(memory):.1f}–{max(memory):.1f} MiB. These are endpoint memory observations, not continuous peaks. OOM events: {oom}; OOM kills: {oom_kills}. Worker RSS is never summed as separate process memory.', '',
          'The following backend profiles are medians of per-run health quantiles across the three fixed-allocation round-robin cases. Timelines include warmup and observed drain. ELU measures event-loop activity, not CPU share. The profiles confirm distinct CPU and retained V8 heap pressure; they do not exercise heap exhaustion. The gateway retains self-published health but is outside the supervisor backend sampler.', '',
          '| Worker | Supervisor ELU p50 / p99 | Heap MiB p50 / p99 | Heap/limit p99 |', '| --- | ---: | ---: | ---: |']
baseline = [r['workerHealth'] for r in cases if r['cohort'] == 'adaptive-v23-fixed' and r['policy'] == 'rr']
for worker in sorted(baseline[0]):
    if worker.startswith('gateway:'):
        continue
    def median_health(metric, quantile):
        return statistics.median(r[worker][metric][quantile] for r in baseline)
    lines.append(f"| {worker} | {median_health('supervisorElu', 'p50'):.3f} / {median_health('supervisorElu', 'p99'):.3f} | {median_health('heapMiB', 'p50'):.1f} / {median_health('heapMiB', 'p99'):.1f} | {median_health('heapRatio', 'p99'):.3f} |")
lines += ['', '## Actual scaling', '', '| Case | Recommendations | Started / stopped / exited |', '| --- | --- | --- |']
for row in cases:
    if row['cohort'] != 'adaptive-v23-scaler':
        continue
    assert row['scalerEnabled']
    recommendations = [f"{rec['applicationId']}→{rec['workersCount']}" for decision in row['scalingDecisions'] for rec in decision['recommendations']]
    events = row['events']
    counts = [sum(e['name'] == 'application:worker:' + suffix for e in events) for suffix in ['started', 'stopped', 'exited']]
    lines.append(f"| {row['label']} | {', '.join(recommendations) or 'none'} | {' / '.join(map(str, counts))} |")
lines += ['',
    '## Interpretation and limits', '',
    'Compare `limited` with `least` to assess admission, then compare `tie`/`bounded` with `limited` to assess health-based selection. A lower successful-response p99 with more failed arrivals does not alone demonstrate a better service. Compare fixed and dynamic allocation separately; each app retains its identity and its own worker pool.', '',
    'Dispatch-to-handler time includes mesh transport and framework/event-loop waiting. Handler time excludes response serialization and delivery; end-to-end arrival latency includes those costs. Heap and GC are observations in this experiment, not inputs to the experimental ranking. Samples retain age, and fresh ELU is never presented as fresh heap information.', '',
    'The scaler fixture permits one replica for the light apps and adds a rendering replica within the fixed total-worker/memory budget. This is not an availability recommendation. Worker-index-specific background CPU and cache sizes are synthetic asymmetries; changing worker membership can change those costs. The live-set fixture does not model downstream cache-miss costs or framework cold starts. Fixed and dynamic cohorts ran successively, not as a randomized allocation A/B. The results do not establish savings for a production Booking.com workload.', '',
    'Production app demand, latency/error budgets and minimum replica requirements remain unspecified. Multi-app private TCP/Rust, frontend saturation with multiple HTTP/2 connections, the previous forwarding-confidence gate, representative canary and verified rollback remain open. No nginx comparison or Rust rewrite is claimed.', '',
    '## Evidence', '',
    'Raw results are under `results/review/multi-app/adaptive-v23-fixed/`, `adaptive-v23-scaler/` and `adaptive-v23-overload/`; pilot and limits are in `adaptive-v22-pilot/`. Each cohort preserves individual arrivals, response/error bodies, queue/service timing, health timelines, generation events, recommendations, configuration and logs. `adaptive-v23-deployed-source.tar.gz`, `adaptive-v23-plan.json` and `adaptive-v23-client-manifest.json` preserve deployed-source and client provenance. Exact host drivers and runtime/source hashes are saved in each suite. Before the later cohorts, the post-client observation deadline was extended to 180 seconds so overload work can drain after client timeouts; arrivals, client deadlines and policies were unchanged. This is recorded in `adaptive-v23-observation-amendment.json`; the fixed cohort retains its original captured driver.', '',
    'Recompute with `python3 review/multi-app/adaptive/summarize.py <summary.json> <fixed-directory> <scaler-directory> <overload-directory>` and `python3 review/multi-app/adaptive/report.py <summary.json> <REPORT.md>`. The generation step requires all 33 declared cases. See `README.md` and `experiment-plan.json` for policy definitions and the frozen design.', ''
]
output.write_text('\n'.join(lines))
print(output)
