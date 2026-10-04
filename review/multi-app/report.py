#!/usr/bin/env python3
"""Report saved cohorts without pooling revisions or removing failed runs."""
import argparse
import collections
import json
from pathlib import Path
import statistics

p = argparse.ArgumentParser()
p.add_argument('--fixed', default='release-v17-calibrated')
p.add_argument('--scaler', default='release-v18-scaler')
p.add_argument('--short', default='release-v17-final-forwarding')
p.add_argument('--steady', default='release-v18-steady-forwarding')
p.add_argument('--output', default='review/multi-app/REPORT.md')
a = p.parse_args()
root = Path(__file__).resolve().parents[2]
raw = root / 'results/review/multi-app'
read = lambda name, file: json.loads((raw / name / file).read_text())
fixed = read(a.fixed, 'aggregate.json')
scaler = read(a.scaler, 'aggregate.json')
assert len(fixed['checks']) == 114 and len(scaler['checks']) == 6
valid = [x for x in fixed['checks'] if not x['label'].startswith('scaler-')] + scaler['checks']
assert len(valid) == 114 and all(x['accountingDrained'] for x in valid)
profile = read(a.fixed, 'load-profile.json')
apps = [x for x in fixed['apps'] if not x['case'].startswith('scaler-')] + scaler['apps']
lookup = {(x['case'], x['policy'], x['app']): x for x in apps}
forwarding = {'short': read(a.short, 'aggregate.json'), 'steady': read(a.steady, 'aggregate.json')}
assert all(x['runs'] == 7 for rows in forwarding.values() for x in rows)
resources = []
decisions = []
for revision in [a.fixed, a.scaler]:
    for file in (raw / revision).glob('*-summary.json'):
        if revision == a.fixed and file.name == 'scaler-summary.json':
            continue
        for run in json.loads(file.read_text()):
            before, after = run['before'], run['after']
            def counters(text):
                return {k: int(v) for k, v in (line.split() for line in text.splitlines())}
            cpu0, cpu1 = counters(before['cpu']), counters(after['cpu'])
            mem0, mem1 = counters(before['memoryEvents']), counters(after['memoryEvents'])
            resources.append({'label': run['label'],
                'averageCpuCoresIncludingDrain': (cpu1['usage_usec'] - cpu0['usage_usec']) / ((after['at'] - before['at']) * 1000),
                'beforeRssMiB': before['rss'] / 1048576, 'afterRssMiB': after['rss'] / 1048576,
                'beforeCgroupMiB': before['memory'] / 1048576, 'afterCgroupMiB': after['memory'] / 1048576,
                'oomDelta': mem1['oom'] - mem0['oom'], 'oomKillDelta': mem1['oom_kill'] - mem0['oom_kill'],
                'drainMs': run['drainMs']})
            if revision == a.scaler:
                health = read(revision, run['label'] + '.health.json')
                assert health['scalerEnabled'] and health['scalerChecks'] > 0
                recommendations = [x for d in health['scalingDecisions'] for x in d['recommendations']]
                decisions.append({'label': run['label'], 'checks': health['scalerChecks'],
                    'recommendations': recommendations, 'events': after['events']})
summary = {'implementationCommit': 'dd9c49ed64eeee5fc918cf1e72eac3cd807a403d',
    'cohorts': vars(a), 'checks': valid, 'apps': apps, 'resources': resources,
    'primaryWorkerProfiles': [x for x in fixed['workers'] if x['case'].startswith('primary-')],
    'scaling': decisions, 'forwarding': forwarding, 'loadProfile': profile}
target = root / a.output
target.parent.mkdir(parents=True, exist_ok=True)
(target.parent / 'evidence/multi-app-results.json').write_text(json.dumps(summary, indent=2) + '\n')
lines = []
def line(text=''):
    lines.append(text)
def table(headers, rows):
    line('| ' + ' | '.join(headers) + ' |')
    line('| ' + ' | '.join(['---'] * len(headers)) + ' |')
    for row in rows:
        line('| ' + ' | '.join(map(str, row)) + ' |')
    line()
def tail(case, policy, app):
    v = lookup[(case, policy, app)]['successLatencyMs']['p99']
    return f"{v['median']:.1f} ({v['min']:.1f}–{v['max']:.1f})"
line('# Multi-app request-routing release evaluation')
line()
line('**Release verdict: hold.** The opt-in mesh implementation passes correctness checks, but these workloads do not establish a repeatable latency benefit for least outstanding. The experimental ELU/heap preference is worse on rendering. Production per-app SLOs, error budgets and a representative canary remain unspecified. Keep round robin as the default; this report does not recommend a Rust rewrite or make an nginx comparison.')
line()
line('## Implementation and validation')
line()
line('Draft PR: [platformatic/platformatic#5157](https://github.com/platformatic/platformatic/pull/5157). Measured production source is `dd9c49ed64eeee5fc918cf1e72eac3cd807a403d`, based on upstream `8f6b4e5ee2670d2148655d34235561ee6191248f` with Fastify 5.12.5. Request selection is per app and per HTTP request, including persistent HTTP/1 connections and multiplexed HTTP/2 streams. Shared bounded reservations remain held until backend completion or actual backend exit; client cancellation alone does not free accepted work.')
line()
line('All 42 targeted tests pass on Linux Node 22, 24 and 26 and in restricted non-root Linux. The current default lifecycle/channel cases (26), gateway cases (20), lint, packaging/license checks and post-rebase types pass. The PR head `7238c6cb5` had 243 successful CI checks and one neutral check. Raw validation logs and the CI snapshot are in `evidence/`. The original runtime-main run failed; preserved corrective runs and CI, rather than that failed run, establish validation. A reproduced scale-up/shutdown bootstrap-retry hang was fixed and has a regression test. Production requires neither SQLite nor a native memory-map addon.')
line()
line('## Controls and integrity')
line()
line('One real Watt instance hosts four apps, initially two workers per app and one gateway. All share four CPU IDs, a four-CPU quota and 2 GiB container memory with no additional swap. Workers have 240 MiB old/16 MiB young generation limits. A separate four-CPU client drives seeded open-loop arrivals; HTTP/2 uses one persistent connection across all apps. Every policy includes the same health instrumentation. Native ARM Linux uses UID 65534, dropped capabilities, default seccomp, no-new-privileges and a read-only root. The Docker VM hosts unrelated services; all run variation and outliers are retained.')
line()
line(f"There are {len(valid)} valid multi-app cases: 108 fixed-worker cases plus six corrected 180-second scaler cases. They contain {sum(x['offered'] for x in valid):,} planned arrivals, {sum(x['errors'] for x in valid)} failed responses and no remaining reservations. Every arrival has one terminal outcome and distinct request identity. No error or deadline is dropped from the saved results. Capacity rejection is verified by targeted tests; these campaign cases must not be described as demonstrating rejection when they produced none.")
line()
line('Isolated sweeps cover three rates per app. Maximum successful goodput during the arrival window is a diagnostic anchor, not sustainable capacity or an SLO. The mixed anchor is the smallest isolated anchor divided by its initial share. Primary traffic is 60% of that anchor. Isolated runs disable background hotspots; they are not matched-load estimates of the cost of cohosting. Primary/rate runs preserve hotspots and share the CPU/memory budget.')
line()
table(['App', 'Isolated window-goodput anchor (rps)'], [[k, f'{v:.2f}'] for k, v in profile['observedGoodputAnchors'].items()])
line(f"The mixed anchor is {profile['mixedAnchor']:.2f} rps; primary is {profile['rates']['primary']:.2f}, healthy {profile['rates']['healthy']:.3f}, near {profile['rates']['near']:.2f} and overload {profile['rates']['overload']:.2f}. The rendering-heavy case changes shares from 50/20/20/10 to 20/50/20/10 at the primary total rate. These names denote diagnostic offered-load points, not certified operational states.")
line()
line('## Primary per-app tails')
line()
line('Values are median arrival-based p99 milliseconds across five seeds, with the full minimum–maximum range. Each primary run measures 30 seconds after five seconds of warmup. `pressure` is the predeclared benchmark-only preference for fresh ELU <0.85 and heap ratio <0.85, with least-outstanding fallback; it is absent from the public configuration.')
line()
table(['Protocol', 'App', 'Round robin', 'Least outstanding', 'ELU/heap preference'],
    [[proto, app, *[tail(f'primary-mixed-{proto}-f1', policy, app) for policy in ['rr', 'least', 'pressure']]]
     for proto in ['h1', 'h2'] for app in ['catalog', 'rendering', 'search', 'personalization']])
line('Rendering tails are approximately unchanged with least outstanding at the primary load. The binary pressure preference routes too much work away from the busy worker and has worse rendering tails. Request reservations do not measure background CPU demand, GC cost or remaining service time. Neither policy is established as the final production scheduling solution by these results.')
line()
line('## Load sweeps and frontend variants')
line()
line('Rate cases use three seeds, HTTP/1 and one gateway. Values below retain the median and full range for every app.')
line()
table(['Case', 'App', 'Round robin p99 ms', 'Least outstanding p99 ms'],
    [[case, app, tail(f'rates-{case}-h1-f1', 'rr', app), tail(f'rates-{case}-h1-f1', 'least', app)]
     for case in ['healthy', 'near', 'overload', 'render-hot'] for app in ['catalog', 'rendering', 'search', 'personalization']])
line('Two/four gateway workers, uniform pools and TLS have three seeds per variant. All per-app p50/p95/p99, goodput and error totals are retained in `evidence/multi-app-results.json`; the raw configuration, arrival results and health files remain in the local cohort directories. More gateway workers do not add to the shared four-CPU budget. The multi-app TCP/Rust comparison remains open: the single-app prototype has different completion/failure semantics and cannot certify this request-reservation contract.')
line()
line('## Achieved worker pressure and resources')
line()
line('These profiles pool the five primary HTTP/1 round-robin health timelines; ELU is interval event-loop activity, not measured CPU share. Heap values refer to V8 objects, with external/ArrayBuffer memory recorded separately.')
line()
table(['App:worker', 'ELU p50 / p99', 'Heap MiB p50 / p99', 'Heap/limit p99'],
    [[f"{w['app']}:{w['index']}", f"{w['elu']['p50']:.3f} / {w['elu']['p99']:.3f}",
      f"{w['heapUsedMiB']['p50']:.1f} / {w['heapUsedMiB']['p99']:.1f}", f"{w['heapRatioP99']:.3f}"]
     for w in fixed['workers'] if w['case'] == 'primary-mixed-h1-f1' and w['policy'] == 'rr'])
line('The full aggregate retains per-generation GC frequency/pause deltas, allocation counts, event-loop delay and sample gaps. A blocked worker can publish stale health; the corrected driver uses the supervisor’s current shared reservation snapshot for final drain assertions. Primary/isolated runs loaded an earlier driver, whose exact source was recovered and SHA-verified; retrospective assertions also check their current shared snapshots.')
line()
line(f"Across valid cases, average measured CPU use including client drain ranges {min(x['averageCpuCoresIncludingDrain'] for x in resources):.2f}–{max(x['averageCpuCoresIncludingDrain'] for x in resources):.2f} cores. Before/after process RSS ranges {min(min(x['beforeRssMiB'], x['afterRssMiB']) for x in resources):.1f}–{max(max(x['beforeRssMiB'], x['afterRssMiB']) for x in resources):.1f} MiB; cgroup memory ranges {min(min(x['beforeCgroupMiB'], x['afterCgroupMiB']) for x in resources):.1f}–{max(max(x['beforeCgroupMiB'], x['afterCgroupMiB']) for x in resources):.1f} MiB. These are endpoint observations, not continuous peak measurements. OOM events: {sum(x['oomDelta'] for x in resources)}; OOM kills: {sum(x['oomKillDelta'] for x in resources)}. Worker RSS is never summed as independent process memory.")
line()
line('## Corrected scaler experiment')
line()
line('Runtime-wide `workers.dynamic: true` is enabled, with an initial nine workers, a nine-worker total bound, per-app minimum one/maximum three, a 1.5 GiB scaler memory budget and zero cooldown/grace. The benchmark observes every existing recommendation without changing it. All recommendation inputs, available memory and worker-generation events are retained in each `.health.json`.')
line()
table(['Case', 'Scaler checks', 'Recommendations', 'Started / stopped / exited events'],
    [[d['label'], d['checks'], len(d['recommendations']),
      ' / '.join(str(collections.Counter(e['name'] for e in d['events'])[f'application:worker:{name}']) for name in ['started', 'stopped', 'exited'])] for d in decisions])
line('Zero recommendations are a measured scaler outcome, not evidence that scale-up/down was exercised. Actual scaling with accepted requests and concurrent shutdown is covered separately by integration tests. Routing within an app and allocating workers among apps remain different decisions.')
line()
line('## Forwarding overhead')
line()
line('Pristine transport, maintained round robin and least outstanding use identical benchmark entry modules, dependency versions and limits. Each cohort has seven seeds per policy/protocol. The short cohort measures 20 seconds after three seconds of warmup; the prospectively declared steady cohort uses seeds 8–14, 60-second measurement and 15-second warmup. They remain separate. Bootstrap intervals resample median throughput ratios 10,000 times; no outliers are removed. The initial policy-overhead requirement is at least 95% of stock, with enough confidence to distinguish regression from variation.')
line()
table(['Cohort', 'Protocol', 'Policy', 'Median rps', 'Ratio to stock', 'Bootstrap 95% ratio', 'Lower bound ≥95%'],
    [[cohort, r['protocol'], r['policy'], f"{r['medianRps']:.1f}", f"{r['ratioToStock']*100:.2f}%",
      f"{r['bootstrap95Ratio'][0]*100:.3f}–{r['bootstrap95Ratio'][1]*100:.3f}%", r['confidenceLowerGate95']]
     for cohort, rows in forwarding.items() for r in rows])
line('A passing point estimate does not override a failed confidence gate. Even a passing forwarding gate would not establish per-app latency gains, production capacity or canary readiness.')
line()
line('## Reproduction and retained failures')
line()
line('Run serially after correctness tests, using `setup.sh` in a clean checkout:')
line()
line('```sh')
line('bash review/multi-app/setup.sh')
line('BENCH_WORKSPACE=/work python3 review/multi-app/campaign.py --revision <unique-name>')
line('BENCH_WORKSPACE=/work python3 review/multi-app/forwarding.py --revision <unique-steady-name> --first-seed 8 --seeds 7 --warmup 15 --seconds 60')
line('python3 review/multi-app/forwarding-analyze.py <unique-steady-name>')
line('```')
line()
line(f"Recorded development commands used `/focused` instead of `/work`. The corrected fixed-worker command was `campaign.py --revision {a.fixed} --skip-forwarding --forwarding-revision {a.short}`. Scaler correction ran `run.py --revision {a.scaler} --suite scaler --policies rr least --seeds 3 --load-profile`, reusing the saved calibration/load profile. Aggregate with `analyze.py <revision>`; generate this report with `report.py --fixed {a.fixed} --scaler {a.scaler} --short {a.short} --steady {a.steady}`.")
line()
line(f"Raw output is under `results/review/multi-app/{a.fixed}/`, `{a.scaler}/`, `{a.short}/` and `{a.steady}/`. Deployed-source archives/manifests are `release-v17-final-deployed-source.tar.gz`, `release-v17-final-source-manifest.json`, `release-v18-deployed-source.tar.gz` and `release-v18-source-manifest.json`. Each suite fingerprints the actual deployed source/lockfile and loaded driver. v18 changes benchmark scaler configuration/observation, with identical production routing source. The corrected scaler fixtures must not be pooled with the earlier scaler-labelled cases.")
line()
line('The earlier `release-v17-final` isolated labels omitted the rate and overwrote per-run health/log files; those runs are diagnostic only and the twelve points were rerun with distinct labels. The six scaler-labelled cases in `release-v17-calibrated` omitted the runtime-wide dynamic switch and are excluded from valid scaler evidence. The original short forwarding confidence failure, initial failed runtime-main run, pre-fix scaler hang, failed bootstrap-race regression and corrected runs are all retained. No gate was relaxed and no failing cohort was deleted.')
line()
line('## Remaining release work')
line()
line('The local implementation and review evidence are available, but the plan is not fully complete. A repeatable scheduling benefit for the representative high-ELU/high-heap workload remains unproven. Matched-load isolated/cohosted comparisons, the multi-app TCP/Rust contract comparison, production per-app SLOs/error/resource budgets, representative canary and validated rollback remain open. These are release gates, not permission to infer production readiness from a green test suite.')
target.write_text('\n'.join(lines) + '\n')
print(target)
