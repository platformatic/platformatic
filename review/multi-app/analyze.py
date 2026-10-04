#!/usr/bin/env python3
"""Aggregate saved runs; failed requests remain explicit, never success-only evidence."""
import argparse, collections, json, pathlib, statistics
p=argparse.ArgumentParser();p.add_argument('revision',nargs='?',default='release');a=p.parse_args()
root=pathlib.Path('results/review/multi-app')/a.revision
quantile=lambda x,q: sorted(x)[min(len(x)-1,int(len(x)*q))] if x else None
spread=lambda x: {'median':statistics.median(x),'min':min(x),'max':max(x),'n':len(x)} if x else None
runs=[]
for f in root.glob('*-summary.json'): runs+=json.loads(f.read_text())
groups=collections.defaultdict(list);health=collections.defaultdict(list);checks=[]; per_run_health=[]
for r in runs:
 offered=sum(v['offered'] for v in r['apps'].values())
 assert offered==len(r['samples'])+len(r['errors']),(r['label'],'missing outcomes')
 identities=[x['rid'] for x in r['samples']+r['errors']]
 assert len(set(identities))==offered,(r['label'],'duplicate outcomes')
 assert not [e for e in r['errors'] if (e.get('error')=='invalid JSON' or str(e.get('error','')).startswith('invalid response'))],(r['label'],'incorrect response')
 configured=[w['routing'] for w in r['after']['workers'] if w['routing']]
 assert all(x['outstanding']==0 for x in configured),(r['label'],'reservation leak')
 if not r['label'].startswith('scaler'):assert all(x['selected']==x['completed'] for x in configured),(r['label'],'accounting mismatch')
 checks.append({'label':r['label'],'offered':offered,'successes':len(r['samples']),'errors':len(r['errors']),'accountingDrained':True})
 # Strip only policy and seed from a label; different mixes/frontends stay separate.
 key=r['label'].replace('-'+r['policy']+'-','-').rsplit('-s',1)[0]
 for app,v in r['apps'].items():groups[(key,r['policy'],app)].append((r,v))
 timeline=json.loads((root/(r['label']+'.health.json')).read_text()).get('timeline',[])
 begin=r['options']['startAt'];end=begin+r['options']['seconds']*1000+r['drainMs']
 by_generation=collections.defaultdict(list)
 for sample in timeline:
  if begin<=sample['at']<=end:
   health[(key,r['policy'],sample['app'],sample['index'])].append(sample)
   by_generation[(sample['app'],sample['index'],sample['threadId'])].append(sample)
 for (app,index,thread),samples in by_generation.items():
  samples.sort(key=lambda s:s['at']);first,last=samples[0],samples[-1];span=(last['at']-first['at'])/1000
  gaps=[b['at']-a['at'] for a,b in zip(samples,samples[1:])]
  per_run_health.append({'label':r['label'],'app':app,'worker':index,'thread':thread,'observedSeconds':span,
   'gcCount':last['gcCount']-first['gcCount'],'gcPauseMs':last['gcMs']-first['gcMs'],
   'gcHz':(last['gcCount']-first['gcCount'])/span if span else None,
   'allocationObjects':last['allocations']-first['allocations'],
   'sampleGapMs':{'p50':quantile(gaps,.5),'p99':quantile(gaps,.99),'max':max(gaps) if gaps else None},
   'gapsAbove1500ms':sum(x>1500 for x in gaps)})
aggregate=[]
for (case,policy,app),values in sorted(groups.items()):
 rows=[v for _,v in values];outcomes=[x for r,_ in values for x in r['samples']+r['errors'] if x['app']==app]
 aggregate.append({'case':case,'policy':policy,'app':app,'runs':len(rows),'offered':sum(v['offered'] for v in rows),
  'successes':sum(v['successes'] for v in rows),'errors':sum(v['errors'] for v in rows),
  'successLatencyConditionalOnSuccess':any(v['errors'] for v in rows),
  'errorsByType':dict(collections.Counter(x['error'] for x in outcomes if x.get('error'))),
  'deadlineCensored':sum(x.get('error')=='deadline' for x in outcomes),
  'goodput':spread([v['goodput'] for v in rows]),
  'successLatencyMs':{k:spread([v['latencyMs'][k] for v in rows if v['latencyMs'][k] is not None]) for k in ['p50','p95','p99']},
  'allTerminalOutcomeLatencyMs':{k:quantile([x['latencyMs'] for x in outcomes],q) for k,q in [('p50',.5),('p95',.95),('p99',.99)]}})
workers=[]
for (case,policy,app,index),samples in sorted(health.items()):
 workers.append({'case':case,'policy':policy,'app':app,'index':index,'samples':len(samples),
  'elu':{k:quantile([s['elu'] for s in samples],q) for k,q in [('p50',.5),('p95',.95),('p99',.99)]},
  'heapUsedMiB':{k:quantile([s['heapUsed']/1048576 for s in samples],q) for k,q in [('p50',.5),('p95',.95),('p99',.99)]},
  'heapRatioP99':quantile([s['heapUsed']/s['heapLimit'] for s in samples],.99),
  'eventLoopDelayP99Ms':quantile([s['loopP99Ms'] for s in samples],.99),
  'gc': {'reportedCount': max(s['gcCount'] for s in samples), 'reportedPauseMs': max(s['gcMs'] for s in samples)},
  'allocationObjectsMax':max(s['allocations'] for s in samples)})
(root/'aggregate.json').write_text(json.dumps({'checks':checks,'apps':aggregate,'workers':workers,'perRunWorkerHealth':per_run_health},indent=2))
print('| Case | Policy | App | n | Median p99 ms (range) | Errors |')
print('| --- | --- | --- | ---: | ---: | ---: |')
for r in aggregate:
 v=r['successLatencyMs']['p99']
 print(f"| {r['case']} | {r['policy']} | {r['app']} | {r['runs']} | {v['median']:.1f} ({v['min']:.1f}–{v['max']:.1f}) | {r['errors']} |" if v else str(r))
