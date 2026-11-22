import assert from 'node:assert/strict'
import { test } from 'node:test'
import { MAX_SAMPLES, PredictiveApplicationScaler } from '../../lib/predictive-scaling.js'

function createApplicationScaler () {
  const metric = { redistributionMs: 30000, alphaUp: 0.2, alphaDown: 0.1, betaUp: 0.1, betaDown: 0.1 }
  return new PredictiveApplicationScaler({
    minimum: 1,
    maximum: 8,
    cooldowns: {},
    metrics: { elu: { ...metric, threshold: 0.7 }, heap: { ...metric, threshold: 100e6 } }
  })
}

test('diagnostics expose targets, pending starts, metric state and live workers', t => {
  t.mock.timers.enable({ apis: ['Date'], now: 100000 })
  const applicationScaler = createApplicationScaler()
  applicationScaler.addWorker('app:0', 60000)
  applicationScaler.addSample('elu', 'app:0', 99000, 1)
  applicationScaler.addSample('heap', 'app:0', 99000, 450e6)
  applicationScaler.process(100000)
  applicationScaler.setTargetCount(3)

  const diagnostics = applicationScaler.getDiagnostics()
  assert.equal(diagnostics.targetCount, 3)
  assert.equal(diagnostics.liveCount, 1)
  assert.equal(diagnostics.minimum, 1)
  assert.equal(diagnostics.maximum, 8)
  assert.deepEqual(diagnostics.pending.map(pending => pending.expectedCount), [2, 3])
  assert.equal(diagnostics.metrics.elu.lastProcessedTs, 100000)
  assert.equal(diagnostics.metrics.elu.threshold, 0.7)
  assert.ok(diagnostics.metrics.elu.level > 0)
  assert.deepEqual(diagnostics.workers[0].metrics.elu, {
    lastSampleTs: 99000,
    lastValue: 1,
    firstSampleTs: 99000,
    intervalMs: 1000,
    values: [1]
  })

  applicationScaler.removeWorker('app:0', 100100)
  applicationScaler.addWorker('app:0', 100200)
  const replacement = applicationScaler.getDiagnostics()
  assert.equal(replacement.workers.length, 1)
  assert.notEqual(replacement.workers[0].id, diagnostics.workers[0].id)
  assert.deepEqual(replacement.workers[0].metrics, {})
})

test('reading diagnostics does not change state or later decisions', t => {
  t.mock.timers.enable({ apis: ['Date'], now: 100000 })
  const observed = createApplicationScaler()
  const control = createApplicationScaler()
  for (const applicationScaler of [observed, control]) {
    applicationScaler.addWorker('app:0', 1000)
    applicationScaler.addSample('elu', 'app:0', 99000, 0.95)
    applicationScaler.process(100000)
    applicationScaler.setTargetCount(2)
  }

  assert.deepEqual(observed.getDiagnostics(), control.getDiagnostics())

  for (const now of [140000, 141000, 150000]) {
    for (const applicationScaler of [observed, control]) applicationScaler.addSample('elu', 'app:0', now, 0.15)
    observed.getDiagnostics()
    assert.equal(observed.process(now), control.process(now))
    assert.deepEqual(observed.getDiagnostics(), control.getDiagnostics())
  }
})

test('worker samples are the stored ones only, without carry-forward', () => {
  const applicationScaler = createApplicationScaler()
  applicationScaler.addWorker('app:0', 1000)
  applicationScaler.addSample('elu', 'app:0', 10100, 0.4)
  applicationScaler.addSample('elu', 'app:0', 10200, 0.9)
  assert.deepEqual(applicationScaler.getDiagnostics().workers[0].metrics.elu, {
    lastSampleTs: 10200,
    lastValue: 0.9,
    firstSampleTs: 10000,
    intervalMs: 1000,
    values: [0.4]
  })

  for (let timestamp = 11000; timestamp <= 200000; timestamp += 1000) {
    applicationScaler.addSample('elu', 'app:0', timestamp, 0.5)
  }
  assert.equal(applicationScaler.getDiagnostics().workers[0].metrics.elu.values.length, MAX_SAMPLES)
})
