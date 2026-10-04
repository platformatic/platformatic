"""Freeze admission limits from pilot service time before policy comparisons."""
import json
import math
from pathlib import Path
import sys

pilot = Path(sys.argv[1])
plan = json.loads(Path(__file__).with_name('experiment-plan.json').read_text())
rows = json.loads((pilot / 'primary-summary.json').read_text())
assert len(rows) == 1 and not rows[0]['errors']
limits, measurements = {}, {}
for app, budget in plan['queueBudgetMs'].items():
    values = sorted(s['timing']['serviceMs'] for s in rows[0]['samples'] if s['app'] == app)
    assert len(values) >= 100, (app, len(values))
    p95 = values[min(len(values) - 1, math.floor(len(values) * .95))]
    limits[app] = min(64, max(1, 1 + math.floor(budget / p95)))
    measurements[app] = {'samples': len(values), 'serviceP95Ms': p95, 'queueBudgetMs': budget}
result = {'pilot': str(pilot.resolve()), 'limits': limits, 'measurements': measurements,
          'rule': plan['limitRule'], 'note': 'Fixed experimental limits, not an adaptive controller or a production latency guarantee.'}
Path(sys.argv[2]).write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps(result, indent=2))
