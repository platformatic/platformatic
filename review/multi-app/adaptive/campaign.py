"""Run the declared comparisons serially against one frozen deployment."""
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tarfile

here = Path(__file__).resolve().parent
root = here.parents[2]
out = Path(os.environ['BENCH_RESULTS_ROOT'])
pilot = out / 'adaptive-v22-pilot'
plan = json.loads((here / 'experiment-plan.json').read_text())
archive = out / 'adaptive-v23-deployed-source.tar.gz'
if archive.exists():
    raise RuntimeError('Use a new cohort name; never overwrite an experiment')
with tarfile.open(archive, 'w:gz', dereference=False) as tar:
    tar.add('/tmp/watt-request-adaptive-v21-source', arcname='deployed-source')
(out / 'adaptive-v23-plan.json').write_text(json.dumps({
    'plan': plan, 'limits': json.loads((pilot / 'limits.json').read_text()),
    'sourceArchiveSha256': hashlib.sha256(archive.read_bytes()).hexdigest(),
    'note': 'Five-minute per-run estimates increase tail observations tenfold; they remain diagnostic, not production SLO validation.'
}, indent=2) + '\n')
for stage, revision, suite in [('primary', 'adaptive-v23-fixed', 'primary'),
                               ('scaler', 'adaptive-v23-scaler', 'scaler'),
                               ('overload', 'adaptive-v23-overload', 'primary')]:
    config = plan[stage]
    target = out / revision
    target.mkdir(exist_ok=False)
    for name in ['calibration.json', 'limits.json', 'experiment-plan.json']:
        shutil.copy2(pilot / name, target / name)
    command = [sys.executable, str(here / 'run.py'), '--revision', revision, '--suite', suite,
               '--policies', *config['policies'], '--protocols', config['protocol'],
               '--rate', str(config['rate']), '--seconds', str(config['seconds']),
               '--seeds', str(len(config['seeds'])), '--first-seed', str(config['seeds'][0]),
               '--warmup', str(config['warmup']), '--limits-file', str(target / 'limits.json')]
    with (target / 'command.json').open('w') as f:
        json.dump(command, f, indent=2)
    print('Starting', revision, flush=True)
    with (target / 'run.log').open('w') as log:
        subprocess.run(command, cwd=root, env=os.environ, stdout=log, stderr=subprocess.STDOUT, check=True)
    print('Completed', revision, flush=True)
