"""Keep failed arrivals in the denominator when evaluating admission policies."""
import collections
import hashlib
import json
import statistics
import sys
from pathlib import Path

plan = json.loads(Path(__file__).with_name('experiment-plan.json').read_text())
budgets = plan['arrivalLatencyBudgetMs']

def quantiles(values):
    a = sorted(values)
    return {name: a[min(len(a) - 1, int(len(a) * p))] if a else None for name, p in [('p50', .5), ('p95', .95), ('p99', .99)]}

output = Path(sys.argv[1])
cases = []
schedules = {}
source_fingerprint = None
for directory in map(Path, sys.argv[2:]):
    for env_file in directory.glob('*-environment.json'):
        env = json.loads(env_file.read_text())
        fingerprint = (env['deployedSources'], env['scalingAlgorithmSha256'])
        if source_fingerprint is None:
            source_fingerprint = fingerprint
        assert source_fingerprint == fingerprint, ('deployed sources differ', directory.name)
    for file in sorted(directory.glob('*-summary.json')):
        for run in json.loads(file.read_text()):
            arrivals, samples, errors = run['arrivals'], run['samples'], run['errors']
            ids = [r['rid'] for r in samples + errors]
            assert len(ids) == len(set(ids)) == len(arrivals)
            assert set(ids) == {r['rid'] for r in arrivals}
            invalid = [e for e in errors if e['error'].startswith(('invalid JSON', 'invalid timing', 'invalid response', 'invalid gateway identity'))]
            assert not invalid, (run['label'], invalid[:3])
            assert all(w['routing'] is None or w['routing']['outstanding'] == 0 for w in run['after']['workers'])
            schedule = hashlib.sha256(json.dumps(arrivals, sort_keys=True).encode()).hexdigest()
            key = (run['options']['seed'], run['protocol'], run['options']['rate'], run['options']['seconds'])
            assert schedules.setdefault(key, schedule) == schedule
            health = json.loads((directory / (run['label'] + '.health.json')).read_text())
            def counters(value):
                return {k: int(v) for k, v in (line.split() for line in value.splitlines())}
            before_cpu, after_cpu = [counters(run[point]['cpu']) for point in ['before', 'after']]
            before_oom, after_oom = [counters(run[point]['memoryEvents']) for point in ['before', 'after']]
            resources = {
                'averageCpuCoresIncludingDrain': (after_cpu['usage_usec'] - before_cpu['usage_usec']) / ((run['after']['at'] - run['before']['at']) * 1000),
                'rssEndpointsBytes': [run[point]['rss'] for point in ['before', 'after']],
                'cgroupMemoryEndpointsBytes': [run[point]['memory'] for point in ['before', 'after']],
                'oomEvents': after_oom['oom'] - before_oom['oom'],
                'oomKills': after_oom['oom_kill'] - before_oom['oom_kill'],
                'maximumObservedHeapRatio': max(w['heapUsed'] / w['heapLimit'] for w in health['timeline']),
            }
            worker_health = {}
            for app, index in sorted({(w['app'], w['index']) for w in health['timeline']}):
                samples_for_worker = [w for w in health['timeline'] if (w['app'], w['index']) == (app, index)]
                threads = {w['threadId'] for w in samples_for_worker}
                # A newly started worker can have supervisor ELU before its
                # first self-published sample supplies its application index.
                supervisor = [w for w in health['supervisorTimeline'] if w['app'] == app and w['thread'] in threads]
                worker_health[f'{app}:{index}'] = {
                    'samples': len(samples_for_worker),
                    'supervisorSamples': len(supervisor),
                    'supervisorElu': quantiles(w['elu'] for w in supervisor),
                    'heapMiB': quantiles(w['heapUsed'] / 1048576 for w in samples_for_worker),
                    'heapRatio': quantiles(w['heapUsed'] / w['heapLimit'] for w in samples_for_worker),
                    'heapAgeMs': quantiles(w['heapAgeMs'] for w in supervisor if w['heapAgeMs'] is not None),
                    'missingHeapSamples': sum(w['heapAgeMs'] is None for w in supervisor),
                    'generations': len(threads),
                }
            by_app = {}
            for app, budget in budgets.items():
                app_samples = [s for s in samples if s['app'] == app]
                app_errors = [e for e in errors if e['app'] == app]
                offered = sum(a['app'] == app for a in arrivals)
                successful = len(app_samples)
                timely = sum(s['latencyMs'] <= budget for s in app_samples)
                by_app[app] = {
                    'offered': offered, 'successes': successful, 'failures': len(app_errors),
                    'rejections': sum(e['error'] == 'capacity rejection' for e in app_errors),
                    'errorKinds': dict(collections.Counter(e['error'] for e in app_errors)),
                    'timelySuccesses': timely, 'timelyFractionOfOffered': timely / offered,
                    'timelyGoodput': timely / run['options']['seconds'],
                    'windowGoodput': run['apps'][app]['goodput'], 'latencyBudgetMs': budget,
                    'successLatencyMs': quantiles(s['latencyMs'] for s in app_samples),
                    'dispatchToHandlerMs': quantiles(s['timing']['dispatchToHandlerMs'] for s in app_samples),
                    'handlerServiceMs': quantiles(s['timing']['serviceMs'] for s in app_samples),
                    'rejectionLatencyMs': quantiles(s['latencyMs'] for s in app_errors if s['error'] == 'capacity rejection'),
                    'p99RankFromMaximum': successful - int(successful * .99),
                    'byWorker': dict(collections.Counter(s['worker'] for s in app_samples)),
                }
            cases.append({'cohort': directory.name, 'label': run['label'], 'policy': run['policy'],
                          'seed': run['options']['seed'], 'protocol': run['protocol'], 'seconds': run['options']['seconds'],
                          'arrivalSha256': schedule, 'generatorLagMs': run['generatorLagMs'], 'drainMs': run['drainMs'],
                          'apps': by_app, 'scalerEnabled': health.get('scalerEnabled'),
                          'scalingDecisions': [r for r in health.get('scalingDecisions', []) if r['recommendations']],
                          'events': health['events'], 'supervisorSamples': len(health['supervisorTimeline'])})
            cases[-1]['resources'] = resources
            cases[-1]['workerHealth'] = worker_health

groups = []
for cohort, policy in sorted({(r['cohort'], r['policy']) for r in cases}):
    runs = [r for r in cases if r['cohort'] == cohort and r['policy'] == policy]
    for app in budgets:
        rows = [r['apps'][app] for r in runs]
        groups.append({'cohort': cohort, 'policy': policy, 'app': app, 'runs': len(runs),
                       'offered': sum(r['offered'] for r in rows), 'failures': sum(r['failures'] for r in rows), 'rejections': sum(r['rejections'] for r in rows),
                       'medianTimelyFraction': statistics.median(r['timelyFractionOfOffered'] for r in rows),
                       'timelyFractionRange': [min(r['timelyFractionOfOffered'] for r in rows), max(r['timelyFractionOfOffered'] for r in rows)],
                       'medianP99Ms': statistics.median(r['successLatencyMs']['p99'] for r in rows),
                       'p99RangeMs': [min(r['successLatencyMs']['p99'] for r in rows), max(r['successLatencyMs']['p99'] for r in rows)],
                       'medianQueueP95Ms': statistics.median(r['dispatchToHandlerMs']['p95'] for r in rows),
                       'medianServiceP95Ms': statistics.median(r['handlerServiceMs']['p95'] for r in rows)})
output.parent.mkdir(parents=True, exist_ok=True)
output.write_text(json.dumps({'plan': plan, 'groups': groups, 'cases': cases}, indent=2) + '\n')
for row in groups:
    print(json.dumps(row))
