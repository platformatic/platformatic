#!/usr/bin/env python3
"""Derive diagnostic offered load from isolated window goodput, retaining all points."""
import argparse
import json
from pathlib import Path

p = argparse.ArgumentParser()
p.add_argument('revision')
a = p.parse_args()
root = Path(__file__).resolve().parents[2] / 'results/review/multi-app' / a.revision
source = root / 'isolated-summary.json'
runs = json.loads(source.read_text())
shares = dict(catalog=.5, rendering=.2, search=.2, personalization=.1)
points = {}
anchors = {}
for app in shares:
    points[app] = [{
        'label': r['label'], 'offered': r['apps'][app]['offered'],
        'windowGoodput': r['apps'][app]['goodput'],
        'errors': r['apps'][app]['errors'],
        'successLatencyMs': r['apps'][app]['latencyMs'],
    } for r in runs if list(r['apps']) == [app]]
    if len(points[app]) != 3:
        raise ValueError(f'{app}: expected all three isolated rate points')
    anchors[app] = max(x['windowGoodput'] for x in points[app])
    if anchors[app] <= 0:
        raise ValueError(f'{app}: no observed successful window goodput')
mixed = min(anchors[app] / shares[app] for app in shares)
value = {
    'method': 'Maximum observed isolated window goodput, divided by each initial traffic share; minimum across apps. This is a diagnostic anchor, not proven sustainable capacity or a production SLO.',
    'source': source.name, 'initialShares': shares, 'isolatedPoints': points,
    'observedGoodputAnchors': anchors, 'mixedAnchor': mixed,
    'rates': {'primary': mixed * .6, 'healthy': mixed * .35,
              'near': mixed * .8, 'overload': mixed * 1.3,
              'render-hot': mixed * .6},
}
(root / 'load-profile.json').write_text(json.dumps(value, indent=2) + '\n')
print(json.dumps(value, indent=2))
