import assert from 'node:assert/strict'
import { test } from 'node:test'
import { PredictiveScalingAlgorithm } from '../../lib/predictive-scaling.js'
import { metricView, scalingWarnings, WorkerHistory } from '../../public/scaler/model.js'

test('warnings include pending capacity, memory, selected app limits and delayed starts, and clear on recovery', () => {
  const selected = { id: 'a', targetCount: 3, liveCount: 1, max: 3, pending: [{ scaleAt: 900 }, { scaleAt: 1100 }] }
  const other = { id: 'b', targetCount: 1, liveCount: 1, max: 4, pending: [] }
  const snapshot = { now: 1000, maxTotalWorkers: 4, memory: { used: 200e6, limit: 200e6 }, applications: [selected, other] }
  const before = structuredClone(snapshot)
  const warnings = scalingWarnings(snapshot, selected)
  assert.equal(warnings.length, 4)
  assert.match(warnings[0], /Total worker limit reached \(4\/4 scheduled, including pending starts\)/)
  assert.match(warnings[1], /Memory limit reached/)
  assert.match(warnings[2], /a: application worker limit reached \(3\/3 scheduled\)/)
  assert.match(warnings[3], /a: 1 scheduled worker is taking longer/)
  assert.equal(scalingWarnings(snapshot, other).length, 2)
  assert.deepEqual(snapshot, before)

  snapshot.maxTotalWorkers = 8
  snapshot.memory.used = 100e6
  selected.max = 4
  selected.pending = []
  assert.deepEqual(scalingWarnings(snapshot, selected), [])
  assert.deepEqual(scalingWarnings({ applications: [], memory: null }, undefined), [])
})

function createAlgorithm () {
  return new PredictiveScalingAlgorithm({
    min: 1,
    max: 8,
    scaleUpMargin: 0.1,
    scaleDownMargin: 0.3,
    cooldowns: {},
    metrics: {
      elu: { threshold: 0.7, redistributionMs: 30000, alphaUp: 0.2, alphaDown: 0.1, betaUp: 0.1, betaDown: 0.1 },
      heap: { threshold: 100e6, redistributionMs: 30000, alphaUp: 0.2, alphaDown: 0.1, betaUp: 0.1, betaDown: 0.1 }
    }
  })
}

test('diagnostics expose approved capacity and existing lifetimes without recording a recommendation', t => {
  t.mock.timers.enable({ apis: ['Date'], now: 100000 })
  const algorithm = createAlgorithm()
  algorithm.addWorker('app:0', 60000)
  algorithm.addSample('elu', 'app:0', 99000, 1)
  algorithm.addSample('heap', 'app:0', 99000, 450e6)
  assert.equal(algorithm.process(100000), 5)
  algorithm.setTarget(3)
  const snapshot = algorithm.getDiagnostics()
  assert.equal(snapshot.targetCount, 3)
  assert.equal(snapshot.liveCount, 1)
  assert.equal(snapshot.pending.length, 2)
  assert.deepEqual(snapshot.pending.map(pending => pending.expectedCount), [2, 3])
  assert.equal(snapshot.metrics.elu.lastProcessedTick, 100000)
  assert.equal(snapshot.workers[0].metrics.elu.lastSampleAt, 99000)
  assert.equal(snapshot.metrics.elu.history.at(-1).timestamp, 100000)
  assert.equal(snapshot.workers[0].metrics.elu.history.at(-1).timestamp, 99000)
  algorithm.removeWorker('app:0', 100100)
  algorithm.addWorker('app:0', 100200)
  const replacement = algorithm.getDiagnostics(100200)
  assert.notEqual(replacement.workers[0].id, snapshot.workers[0].id)
  assert.deepEqual(replacement.workers[0].metrics, {})
})

test('polling never processes ticks, expires pending requests, or changes later decisions', t => {
  t.mock.timers.enable({ apis: ['Date'], now: 100000 })
  const observed = createAlgorithm()
  const control = createAlgorithm()
  for (const algorithm of [observed, control]) {
    algorithm.addWorker('app:0', 1000)
    algorithm.addSample('elu', 'app:0', 99000, 0.95)
    algorithm.process(100000)
    algorithm.setTarget(2)
  }
  for (const now of [100100, 102000, 140000, 1000000]) {
    const snapshot = observed.getDiagnostics(now)
    assert.equal(snapshot.targetCount, 2)
    assert.equal(snapshot.pending.length, 1)
    assert.equal(snapshot.metrics.elu.lastProcessedTick, 100000)
    assert.deepEqual(observed.getSnapshot('elu'), control.getSnapshot('elu'))
    // A caller cannot mutate retained histories, pending requests or worker data.
    snapshot.pending[0].expectedCount = 99
    snapshot.workers[0].metrics.elu.value = 99
    snapshot.metrics.elu.history.forEach(point => { point.value = 99 })
    snapshot.workers[0].metrics.elu.history.forEach(point => { point.value = 99 })
  }
  for (const now of [140000, 141000, 150000]) {
    for (const algorithm of [observed, control]) algorithm.addSample('elu', 'app:0', now, 0.15)
    assert.equal(observed.process(now), control.process(now))
    assert.deepEqual(observed.getDiagnostics(now), control.getDiagnostics(now))
  }
})

test('silent workers keep the last real reading without materializing a long carry-forward history', () => {
  const algorithm = createAlgorithm()
  algorithm.addWorker('app:0', 1000)
  algorithm.addSample('elu', 'app:0', 10100, 0.4)
  algorithm.addSample('elu', 'app:0', 10200, 0.9)
  const snapshot = algorithm.getDiagnostics(1000000)
  assert.equal(snapshot.liveCount, 1)
  assert.deepEqual(snapshot.workers[0].metrics.elu, { lastSampleAt: 10200, value: 0.9, history: [] })
  assert.deepEqual(snapshot.metrics.heap.history, [])
  assert.equal(snapshot.metrics.heap.level, null)
})

test('browser worker history starts at observation, records live counts, and stays bounded', () => {
  const history = new WorkerHistory()
  history.update({ now: 100000, applications: [{ id: 'a', liveCount: 2, targetCount: 3 }] })
  assert.deepEqual(history.get('a'), [{ timestamp: 100000, value: 2 }])
  for (let i = 1; i <= 200; i++) history.update({ now: 100000 + i, applications: [{ id: 'a', liveCount: 2, targetCount: 3 }] })
  assert.equal(history.get('a').length, 120)
  history.update({ now: 200000, applications: [{ id: 'a', liveCount: 3, targetCount: 3 }] })
  assert.deepEqual(history.get('a'), [{ timestamp: 140000, value: 2 }, { timestamp: 200000, value: 3 }])
  history.update({ now: 200001, applications: [] })
  assert.deepEqual(history.get('a'), [])
})

test('worker history preserves the count at minus 60 seconds between polling timestamps', () => {
  const history = new WorkerHistory()
  for (const [now, liveCount] of [[100000, 2], [105100, 3], [160200, 4]]) {
    history.update({ now, applications: [{ id: 'a', liveCount }] })
  }
  assert.deepEqual(history.get('a'), [
    { timestamp: 100200, value: 2 },
    { timestamp: 105100, value: 3 },
    { timestamp: 160200, value: 4 }
  ])
  history.update({ now: 165100, applications: [{ id: 'a', liveCount: 4 }] })
  assert.deepEqual(history.get('a').slice(0, 2), [
    { timestamp: 105100, value: 3 },
    { timestamp: 160200, value: 4 }
  ])
})

test('browser projections normalize by approved capacity, preserve units and handle missing state', () => {
  const app = {
    targetCount: 3,
    horizonMs: 7000,
    metrics: {
      elu: { level: 1.8, trend: 0.05, sampleIntervalMs: 1000, lastProcessedTick: 100000, history: [{ timestamp: 100000, value: 0.9 }], threshold: 0.7 },
      heap: { level: null, trend: 0, lastProcessedTick: 0, history: [], threshold: 100e6 }
    }
  }
  const view = metricView(app, 'elu', 101000)
  assert.equal(view.current, 0.9)
  assert.equal(view.forecast[0].value, 1.85 / 3)
  assert.equal(view.forecast[1].value, 2.2 / 3)
  assert.equal(view.forecast[1].timestamp, 108000)
  assert.deepEqual(metricView(app, 'heap', 101000).forecast, [])
  assert.equal(metricView(app, 'unknown', 101000), null)
})

test('ELU presentation reaches 100% at the crossing time and then flattens, as in ICC', () => {
  const app = {
    targetCount: 2,
    horizonMs: 24000,
    metrics: {
      elu: { level: 1.5, trend: 0.1, sampleIntervalMs: 1000, lastProcessedTick: 10000, history: [{ timestamp: 10000, value: 1.2 }], threshold: 0.7 }
    }
  }
  const before = structuredClone(app)
  const view = metricView(app, 'elu', 10000)
  assert.equal(view.current, 1)
  assert.deepEqual(view.forecast, [
    { timestamp: 10000, value: 0.75 },
    { timestamp: 15000, value: 1 },
    { timestamp: 34000, value: 1 }
  ])
  assert.deepEqual(app, before, 'display clamping does not overwrite raw state')
  assert.deepEqual(metricView(app, 'elu', 16000).forecast, [
    { timestamp: 16000, value: 1 },
    { timestamp: 40000, value: 1 }
  ])
})

test('negative forecasts flatten at zero, while heap growth has no upper cap', () => {
  const app = {
    targetCount: 2,
    horizonMs: 7000,
    metrics: {
      elu: { level: 1, trend: -0.5, sampleIntervalMs: 1000, lastProcessedTick: 10000, history: [{ timestamp: 10000, value: -0.1 }], threshold: 0.7 },
      heap: { level: 100e6, trend: 20e6, sampleIntervalMs: 1000, lastProcessedTick: 10000, history: [{ timestamp: 10000, value: 50e6 }], threshold: 100e6 }
    }
  }
  const view = metricView(app, 'elu', 10000)
  assert.equal(view.current, 0)
  assert.deepEqual(view.forecast, [
    { timestamp: 10000, value: 0.5 },
    { timestamp: 12000, value: 0 },
    { timestamp: 17000, value: 0 }
  ])
  assert.deepEqual(metricView(app, 'heap', 10000).forecast, [
    { timestamp: 10000, value: 50e6 },
    { timestamp: 17000, value: 120e6 }
  ])
})
