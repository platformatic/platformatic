#!/usr/bin/env python3
"""Keep every run; bootstrap the median throughput ratio, never drop outliers."""
import argparse,collections,json,pathlib,random,statistics
p=argparse.ArgumentParser();p.add_argument('revision');a=p.parse_args()
root=pathlib.Path('results/review/multi-app')/a.revision
runs=json.loads((root/'summary.json').read_text());groups=collections.defaultdict(list)
for r in runs:
 assert not r['errors'],(r['label'],r['errors'])
 assert all(w.get('requestRouting',{}).get('outstanding',0)==0 for w in r['after']['workers']),r['label']
 groups[(r['protocol'],r['policy'])].append(r['rps'])
rng=random.Random(20261003);rows=[]
for protocol in ['h1','h2']:
 stock=groups[(protocol,'stock')]
 for policy in ['stock','rr','least']:
  values=groups[(protocol,policy)]
  ratios=sorted(statistics.median(rng.choices(values,k=len(values)))/statistics.median(rng.choices(stock,k=len(stock))) for _ in range(10000))
  if policy=='stock':ratios=[1.0]*10000
  row={'protocol':protocol,'policy':policy,'runs':len(values),'rps':values,'medianRps':statistics.median(values),'ratioToStock':statistics.median(values)/statistics.median(stock),'bootstrap95Ratio':[ratios[250],ratios[9750]],'pointGate95':statistics.median(values)/statistics.median(stock)>=.95,'confidenceLowerGate95':ratios[250]>=.95}
  rows.append(row);print(json.dumps(row))
(root/'aggregate.json').write_text(json.dumps(rows,indent=2))
