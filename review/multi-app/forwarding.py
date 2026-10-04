#!/usr/bin/env python3
"""Compare final least-outstanding with the maintained RR and pristine RR transport.
Runs serially; do not run concurrently with the multi-app matrix.
"""
import argparse, json, pathlib, random, subprocess, time
from evidence import deployed_sources
p=argparse.ArgumentParser();p.add_argument('--seeds',type=int,default=5);p.add_argument('--seconds',type=int,default=20);p.add_argument('--revision',default='forwarding-final');a=p.parse_args()
WORKSPACE=__import__('os').environ.get('BENCH_WORKSPACE','/work')
OUT=pathlib.Path('results/review/multi-app')/a.revision;OUT.mkdir(parents=True,exist_ok=True)
def cmd(args):return subprocess.check_output(args,text=True,stderr=subprocess.STDOUT)
def control():return json.loads(cmd(['docker','exec','watt-multi-client','node','-e','fetch("http://watt-multi-server:3999/").then(r=>r.text()).then(console.log)']))
jobs=[(s,p,h) for s in range(1,a.seeds+1) for p in ['stock','rr','least'] for h in ['h1','h2']]
random.Random(20261003).shuffle(jobs)
(OUT/'environment.json').write_text(json.dumps({'server':json.loads(cmd(['docker','inspect','watt-multi-server'])),'client':json.loads(cmd(['docker','inspect','watt-multi-client'])),'node':cmd(['docker','exec','watt-multi-server','node','--version']),'deployedSources':deployed_sources('watt-multi-server',WORKSPACE),'options':vars(a),'baselineMethod':'common entry-module overlay; no custom loader'},indent=2))
summary=[]
for i,(seed,policy,protocol) in enumerate(jobs):
 print(f'[{i+1}/{len(jobs)}] {policy}-{protocol}-s{seed}',flush=True)
 cmd(['docker','exec','watt-multi-server','sh','-c','rm -rf /tmp/watt-forwarding /tmp/forwarding.log'])
 # The container's pristine source overlay is selected only for the stock
 # mode; runtime imports the standalone routing helper but never configures it.
 module=WORKSPACE+'/review/multi-app/forwarding-server.js'
 env=['-e',f'MULTI_POLICY={policy}','-e',f'MULTI_PROTOCOL={protocol}']
 cmd(['docker','exec','-d',*env,'-w',WORKSPACE,'watt-multi-server','sh','-c','node review/multi-app/forwarding-server.js > /tmp/forwarding.log 2>&1'])
 for _ in range(80):
  try:
   if control()['ready']:break
  except subprocess.CalledProcessError:pass
  time.sleep(.25)
 else:raise RuntimeError(cmd(['docker','exec','watt-multi-server','cat','/tmp/forwarding.log']))
 (OUT/(f'{policy}-{protocol}-s{seed}'+'.config.json')).write_text(cmd(['docker','exec','watt-multi-server','cat','/tmp/watt-forwarding/platformatic.json']))
 opts=dict(protocol=protocol,workload='cheap',seconds=a.seconds,concurrency=64,clients=4,seed=seed)
 def generate(seconds):
  opts['seconds']=seconds;opts['startAt']=int(time.time()*1000)+300
  return json.loads(cmd(['docker','exec','watt-multi-client','node','/tmp/forwarding-client.mjs',json.dumps(opts)]))
 generate(3);before=control();value=generate(a.seconds);after=control()
 label=f'{policy}-{protocol}-s{seed}'
 value.update(label=label,policy=policy,protocol=protocol,before=before,after=after)
 (OUT/(label+'.json')).write_text(json.dumps(value,indent=2));summary.append(value)
 (OUT/'summary.json').write_text(json.dumps(summary,indent=2))
 cmd(['docker','exec','watt-multi-client','node','-e','fetch("http://watt-multi-server:3999/stop")'])
 for _ in range(120):
  try:control();time.sleep(.25)
  except subprocess.CalledProcessError:break
 else:raise RuntimeError('forwarding runtime did not stop')
 (OUT/(label+'.server.log')).write_text(cmd(['docker','exec','watt-multi-server','cat','/tmp/forwarding.log']))
 if value['errors']:raise RuntimeError(value['errors'][:5])
 if policy=='least' and any(w['requestRouting']['outstanding'] for w in after['workers'] if w.get('requestRouting')):raise RuntimeError('reservation leak')
 print(value['rps'],flush=True)
