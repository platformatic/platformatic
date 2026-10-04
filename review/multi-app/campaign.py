#!/usr/bin/env python3
"""Run the final local campaign serially, preserving every result and failure."""
import argparse
import json
import os
from pathlib import Path
import subprocess
import sys

p = argparse.ArgumentParser()
p.add_argument('--revision', required=True)
p.add_argument('--skip-forwarding', action='store_true', help='Continue after the complete forwarding cohort, without rerunning it')
p.add_argument('--forwarding-revision', help='Existing complete forwarding directory for the same deployed source')
a = p.parse_args()
root = Path(__file__).resolve().parents[2]
os.chdir(root)

def run(script, *args):
    command = [sys.executable, str(root / 'review/multi-app' / script), *args]
    print(' '.join(command), flush=True)
    subprocess.run(command, check=True)

forwarding_revision = a.forwarding_revision or a.revision + '-forwarding'
if not a.skip_forwarding:
    run('forwarding.py', '--revision', forwarding_revision, '--seeds', '7', '--seconds', '20')
else:
    cohort_root = root / 'results/review/multi-app' / forwarding_revision
    cohort = json.loads((cohort_root / 'summary.json').read_text())
    expected = {f'{policy}-{protocol}-s{seed}' for seed in range(1, 8) for policy in ['stock', 'rr', 'least'] for protocol in ['h1', 'h2']}
    if len(cohort) != len(expected) or {r['label'] for r in cohort} != expected or any(r['errors'] for r in cohort):
        raise RuntimeError('Cannot continue from an incomplete or failed forwarding cohort')
    from evidence import deployed_sources
    env = json.loads((cohort_root / 'environment.json').read_text())
    if env['deployedSources'] != deployed_sources('watt-multi-server', os.environ.get('BENCH_WORKSPACE', '/work')):
        raise RuntimeError('Cannot reuse forwarding after changing deployed source')
run('forwarding-analyze.py', forwarding_revision)
run('run.py', '--revision', a.revision, '--suite', 'isolated')
run('load-profile.py', a.revision)
run('run.py', '--revision', a.revision, '--suite', 'primary', '--load-profile')
for suite in ['rates', 'frontends', 'uniform', 'tls', 'scaler']:
    run('run.py', '--revision', a.revision, '--suite', suite, '--policies', 'rr', 'least', '--seeds', '3', '--load-profile')
    run('analyze.py', a.revision)
run('analyze.py', a.revision)
