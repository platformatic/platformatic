#!/usr/bin/env python3
"""Run the final local campaign serially, preserving every result and failure."""
import argparse
import os
from pathlib import Path
import subprocess
import sys

p = argparse.ArgumentParser()
p.add_argument('--revision', required=True)
a = p.parse_args()
root = Path(__file__).resolve().parents[2]
os.chdir(root)

def run(script, *args):
    command = [sys.executable, str(root / 'review/multi-app' / script), *args]
    print(' '.join(command), flush=True)
    subprocess.run(command, check=True)

run('forwarding.py', '--revision', a.revision + '-forwarding', '--seeds', '7', '--seconds', '20')
run('forwarding-analyze.py', a.revision + '-forwarding')
run('run.py', '--revision', a.revision, '--suite', 'primary')
run('run.py', '--revision', a.revision, '--suite', 'isolated')
for suite in ['rates', 'frontends', 'uniform', 'tls', 'scaler']:
    run('run.py', '--revision', a.revision, '--suite', suite, '--policies', 'rr', 'least', '--seeds', '3')
    run('analyze.py', a.revision)
run('analyze.py', a.revision)
