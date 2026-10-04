#!/usr/bin/env python3
import argparse, json, pathlib, random, subprocess, time, hashlib
from evidence import deployed_sources
ROOT = pathlib.Path(__file__).resolve().parents[2]
OUT = ROOT / 'results/review/multi-app'
SERVER, CLIENT = 'watt-multi-server', 'watt-multi-client'
WORKSPACE = __import__('os').environ.get('BENCH_WORKSPACE', '/work')
p = argparse.ArgumentParser()
p.add_argument('--smoke', action='store_true'); p.add_argument('--resume', action='store_true')
p.add_argument('--revision', default='release')
p.add_argument('--policies', nargs='+', choices=['rr','least','pressure'])
p.add_argument('--protocols', nargs='+', choices=['h1','h2','h1tls','h2tls'])
p.add_argument('--seconds', type=int, default=30); p.add_argument('--seeds', type=int, default=5)
p.add_argument('--suite', choices=['primary','rates','isolated','frontends','uniform','tls','scaler'], default='primary')
a = p.parse_args()
OUT = OUT / a.revision
def cmd(args): return subprocess.check_output(args, text=True, stderr=subprocess.STDOUT)
def control(path=''):
 return json.loads(cmd(['docker','exec',CLIENT,'node','-e',f'fetch("http://{SERVER}:3999/{path}").then(r=>r.text()).then(console.log)']))
def start(policy, protocol, frontends=1, apps=None, hotspots=True):
 cmd(['docker','exec',SERVER,'sh','-c','rm -rf /tmp/watt-multi-app /tmp/multi.log'])
 env=['-e',f'MULTI_POLICY={policy}','-e',f'MULTI_PROTOCOL={protocol}','-e',f'MULTI_FRONTENDS={frontends}','-e',f'MULTI_HOTSPOTS={int(hotspots)}']
 if a.suite=='scaler':env+=['-e','MULTI_SCALER=1']
 if apps: env+=['-e','MULTI_APPS='+','.join(apps)]
 cmd(['docker','exec','-d',*env,'-w',WORKSPACE,SERVER,'sh','-c','node review/multi-app/server.js > /tmp/multi.log 2>&1'])
 for _ in range(120):
  try:
   s=control()
   if s['ready']:return s
  except subprocess.CalledProcessError:pass
  time.sleep(.25)
 raise RuntimeError(cmd(['docker','exec',SERVER,'cat','/tmp/multi.log']))
def stop(label):
 try: cmd(['docker','exec',CLIENT,'node','-e',f'fetch("http://{SERVER}:3999/stop")'])
 except subprocess.CalledProcessError:pass
 for _ in range(160):
  try: control(); time.sleep(.25)
  except subprocess.CalledProcessError:break
 else: raise RuntimeError('server did not stop')
 (OUT/(label+'.server.log')).write_text(cmd(['docker','exec',SERVER,'cat','/tmp/multi.log']))
def generate(options, path):
 options['startAt']=int(time.time()*1000)+300
 value=cmd(['docker','exec',CLIENT,'node','/tmp/multi-client.mjs',json.dumps(options)])
 path.write_text(value);return json.loads(value)
OUT.mkdir(parents=True,exist_ok=True)
if not (OUT/'calibration.json').exists():
 start('rr','h1',apps=['catalog'],hotspots=False)
 cal=control('calibrate');cal['iterationsPerMs']=round(10000/cal['msPer10000']);(OUT/'calibration.json').write_text(json.dumps(cal,indent=2));stop('calibration')
cal=json.loads((OUT/'calibration.json').read_text())
# One snapshot per invocation records the actual deployed code, limits and runtime.
env={'implementationCommit':__import__('os').environ.get('BENCH_IMPLEMENTATION_COMMIT'),'options':vars(a),'sourceHead':cmd(['git','rev-parse','HEAD']).strip(),'server':json.loads(cmd(['docker','inspect',SERVER])),
 'client':json.loads(cmd(['docker','inspect',CLIENT])),'node':cmd(['docker','exec',SERVER,'node','--version']),
 'kernel':cmd(['docker','exec',SERVER,'uname','-a']),'deployedSources':deployed_sources(SERVER,WORKSPACE),'files':{str(f.relative_to(ROOT)):hashlib.sha256(f.read_bytes()).hexdigest() for f in (ROOT/'review/multi-app').glob('*') if f.is_file()}}
(OUT/(a.suite+'-environment.json')).write_text(json.dumps(env,indent=2))
cases=[('mixed',35,[50,20,20,10],None,1,True)]
if a.suite=='rates':cases=[('healthy',20,[50,20,20,10],None,1,True),('overload',60,[50,20,20,10],None,1,True),('render-hot',35,[20,50,20,10],None,1,True)]
if a.suite=='isolated':cases=[(app,rate,[1],[app],1,False) for app in ['catalog','rendering','search','personalization'] for rate in ([100,500,1000] if app=='catalog' else [4,8,12] if app=='rendering' else [50,150,300] if app=='search' else [8,16,24])]
if a.suite=='frontends':cases=[('frontend',35,[50,20,20,10],None,f,True) for f in [2,4]]
if a.suite=='uniform':cases=[('uniform',35,[50,20,20,10],None,1,False)]
policies=['rr','least','pressure']; protocols=['h1','h2'];seeds=range(1,a.seeds+1)
if a.suite=='tls':protocols=['h1tls','h2tls']
if a.suite=='scaler':policies=['rr','least'];protocols=['h1'];seeds=range(1,a.seeds+1);a.seconds=max(180,a.seconds)
if a.suite in ['rates','uniform']:protocols=['h1']
if a.suite=='isolated':policies=['rr'];protocols=['h1'];seeds=range(1,2)
if a.smoke:policies=['rr','least','pressure'];protocols=['h1tls'] if a.suite=='tls' else ['h1'];seeds=range(1,2)
if a.policies:policies=a.policies
if a.protocols:protocols=a.protocols
jobs=[(seed,policy,proto,case) for seed in seeds for policy in policies for proto in protocols for case in cases]
random.Random(20261003).shuffle(jobs)
file=OUT/(a.suite+('-smoke' if a.smoke else '')+'-summary.json')
records=json.loads(file.read_text()) if a.resume and file.exists() else []
done={r['label'] for r in records}
for i,(seed,policy,protocol,(name,rate,weights,apps,frontends,hotspots)) in enumerate(jobs):
 label=f'{a.suite}-{"smoke-" if a.smoke else ""}{name}-{policy}-{protocol}-f{frontends}-s{seed}'
 if label in done:continue
 print(f'[{i+1}/{len(jobs)}] {label}',flush=True)
 start(policy,protocol,frontends,apps,hotspots)
 (OUT/(label+'.config.json')).write_text(cmd(['docker','exec',SERVER,'cat','/tmp/watt-multi-app/platformatic.json']))
 options=dict(seed=seed,rate=rate,seconds=3 if a.smoke else a.seconds,weights=weights,protocol=protocol,iterationsPerMs=cal['iterationsPerMs'])
 if apps:options['apps']=apps
 if not a.smoke:generate({**options,'seconds':5},OUT/(label+'.warmup.json'))
 before=control();result=generate(options,OUT/(label+'.client.json'))
 # Client errors may leave accepted backend work. Wait for accounting and
 # application work to settle, while preserving all timed-out outcomes.
 for _ in range(160):
  after=control()
  if all(w['running']==0 and (w['routing'] is None or w['routing']['outstanding']==0) for w in after['workers']):break
  time.sleep(.25)
 else:raise RuntimeError('backend did not drain')
 timeline=control('timeline');(OUT/(label+'.health.json')).write_text(json.dumps(timeline,indent=2))
 stop(label)
 result.update(label=label,policy=policy,protocol=protocol,before=before,after=after)
 records.append(result);file.write_text(json.dumps(records,indent=2))
 invalid=[e for e in result['errors'] if (e.get('error')=='invalid JSON' or str(e.get('error','')).startswith('invalid response'))]
 if invalid:raise RuntimeError(f'wrong application/body: {invalid[:2]}')
 if policy!='rr' and any(w['routing']['selected']!=w['routing']['completed'] for w in after['workers']):raise RuntimeError('reservation accounting mismatch')
 print(json.dumps(result['apps']),flush=True)
