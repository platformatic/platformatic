import assert from 'node:assert/strict'
import { test } from 'node:test'
import { PredictiveApplicationScaler } from '../../lib/predictive-scaling.js'
import { processAndAssertMetric } from './helpers.js'

function createApplicationScaler () {
  const metric = {
    threshold: 0.8,
    redistributionMs: 1,
    alphaUp: 1,
    alphaDown: 1,
    betaUp: 0,
    betaDown: 0
  }
  return new PredictiveApplicationScaler({
    minimum: 1,
    maximum: 10,
    cooldowns: {},
    metrics: { elu: metric, heap: metric }
  })
}

for (const metric of ['elu', 'heap']) {
  test(`${metric}: retain pending readings before exit, exclude the exit tick and later ticks`, () => {
    const applicationScaler = createApplicationScaler()
    applicationScaler.addWorker('remaining', 0)
    applicationScaler.addWorker('exiting', 0)
    for (const timestamp of [10000, 11000, 12000]) {
      applicationScaler.addSample(metric, 'remaining', timestamp, 0.2)
      applicationScaler.addSample(metric, 'exiting', timestamp, 0.8)
    }

    applicationScaler.removeWorker('exiting', 12000)
    // Processing the first tick must retain the exited worker's pending readings.
    processAndAssertMetric(applicationScaler, metric, 10000, 1)
    processAndAssertMetric(applicationScaler, metric, 11000, 1)
    processAndAssertMetric(applicationScaler, metric, 12000, 0.2)
    processAndAssertMetric(applicationScaler, metric, 13000, 0.2)
  })

  test(`${metric}: an exited worker does not truncate the readings of later workers`, () => {
    const applicationScaler = createApplicationScaler()
    for (const workerId of ['first', 'exiting', 'last']) {
      applicationScaler.addWorker(workerId, 0)
    }
    for (const workerId of ['first', 'exiting', 'last']) {
      applicationScaler.addSample(metric, workerId, 10000, 0.5)
    }
    processAndAssertMetric(applicationScaler, metric, 10000, 1.5)

    applicationScaler.removeWorker('exiting', 10500)
    for (const timestamp of [11000, 12000, 13000]) {
      applicationScaler.addSample(metric, 'first', timestamp, 0.5)
      applicationScaler.addSample(metric, 'last', timestamp, 0.5)
    }
    processAndAssertMetric(applicationScaler, metric, 13000, 1)
  })

  test(`${metric}: a run after the exit still counts the readings before it`, () => {
    const applicationScaler = createApplicationScaler()
    applicationScaler.addWorker('remaining', 0)
    applicationScaler.addWorker('exiting', 0)
    for (const timestamp of [10000, 11000, 12000]) {
      applicationScaler.addSample(metric, 'remaining', timestamp, 0.2)
      applicationScaler.addSample(metric, 'exiting', timestamp, 0.8)
    }

    applicationScaler.removeWorker('exiting', 12500)
    processAndAssertMetric(applicationScaler, metric, 12999, 1, 12000)
    processAndAssertMetric(applicationScaler, metric, 14000, 0.2)
  })

  test(`${metric}: batched processing excludes the exit tick`, () => {
    const applicationScaler = createApplicationScaler()
    applicationScaler.addWorker('remaining', 0)
    applicationScaler.addWorker('exiting', 0)
    for (const timestamp of [10000, 11000, 12000]) {
      applicationScaler.addSample(metric, 'remaining', timestamp, 0.2)
      applicationScaler.addSample(metric, 'exiting', timestamp, 0.8)
    }

    applicationScaler.removeWorker('exiting', 12000)
    processAndAssertMetric(applicationScaler, metric, 10000, 1)
    // Same result as processing 11000 and 12000 separately.
    processAndAssertMetric(applicationScaler, metric, 12000, 0.2)
  })

  test(`${metric}: metrics cannot register or revive a worker`, () => {
    const applicationScaler = createApplicationScaler()
    applicationScaler.addSample(metric, 'worker', 1000, 0.8)
    assert.equal(applicationScaler.process(2000), null)

    applicationScaler.addWorker('worker', 2000)
    applicationScaler.addSample(metric, 'worker', 3000, 0.8)
    applicationScaler.process(3000)
    applicationScaler.removeWorker('worker', 3500)
    applicationScaler.removeWorker('worker', 3600)
    const before = structuredClone(applicationScaler._getSnapshot(metric))

    applicationScaler.addSample(metric, 'worker', 4000, 0.9)
    assert.equal(applicationScaler.process(5000), null)
    assert.deepEqual(applicationScaler._getSnapshot(metric), before)
    // A later event must also be ignored after the ended state has been cleaned up.
    // The run restarts the stale state, but must not process the late reading.
    applicationScaler.addSample(metric, 'worker', 70000, 0.9)
    assert.equal(applicationScaler.process(71000), null)
    assert.equal(applicationScaler._getSnapshot(metric).lastProcessedTs, before.lastProcessedTs)
  })

  test(`${metric}: restarting the same worker ID keeps distinct lifetimes without a timer`, t => {
    t.mock.timers.enable({ apis: ['setTimeout'] })
    const applicationScaler = createApplicationScaler()
    applicationScaler.addWorker('worker', 0)
    applicationScaler.addSample(metric, 'worker', 10000, 0.8)
    applicationScaler.addSample(metric, 'worker', 11000, 0.8)
    applicationScaler.removeWorker('worker', 11500)

    applicationScaler.addWorker('worker', 12500)
    applicationScaler.addSample(metric, 'worker', 12000, 0.9) // Outside the new lifetime.
    applicationScaler.addSample(metric, 'worker', 12500, 0.2)
    applicationScaler.addSample(metric, 'worker', 13500, 0.2)
    processAndAssertMetric(applicationScaler, metric, 10000, 0.8)
    processAndAssertMetric(applicationScaler, metric, 11000, 0.8)
    processAndAssertMetric(applicationScaler, metric, 12000, 0.8, 11000)
    processAndAssertMetric(applicationScaler, metric, 13000, 0.2)
    processAndAssertMetric(applicationScaler, metric, 14000, 0.2)

    // The old five-second removal must not remove the restarted worker's mapping.
    t.mock.timers.tick(5000)
    applicationScaler.addSample(metric, 'worker', 19000, 0.2)
    assert.notEqual(applicationScaler.process(19000), null)
    assert.equal(applicationScaler._getSnapshot(metric).lastProcessedTs, 19000)
  })

  test(`${metric}: silence does not expire an active lifetime`, () => {
    const applicationScaler = createApplicationScaler()
    applicationScaler.addWorker('worker', 0)
    applicationScaler.process(70000) // Includes an active worker with no samples yet.
    applicationScaler.addSample(metric, 'worker', 71000, 0.4)
    assert.notEqual(applicationScaler.process(71000), null)

    applicationScaler.process(140000)
    applicationScaler.addSample(metric, 'worker', 141000, 0.4)
    assert.notEqual(applicationScaler.process(141000), null)
    assert.equal(applicationScaler._getSnapshot(metric).lastProcessedTs, 141000)
  })

  test(`${metric}: duplicate start notifications preserve pending samples`, () => {
    const applicationScaler = createApplicationScaler()
    applicationScaler.addWorker('worker', 0)
    applicationScaler.addSample(metric, 'worker', 10000, 0.4)
    applicationScaler.addWorker('worker', 11000)
    processAndAssertMetric(applicationScaler, metric, 10000, 0.4)
  })
}

test('batched ticks match incremental processing across missing readings and restarted lifetimes', () => {
  const config = {
    minimum: 1,
    maximum: 10,
    cooldowns: {},
    metrics: {
      elu: { threshold: 0.8, redistributionMs: 5000, alphaUp: 0.2, alphaDown: 0.1, betaUp: 0.2, betaDown: 0.1 },
      heap: { threshold: 100, redistributionMs: 7000, alphaUp: 0.5, alphaDown: 0.3, betaUp: 0.3, betaDown: 0.1 }
    }
  }
  const batchedScaler = new PredictiveApplicationScaler(config)
  const incrementalScaler = new PredictiveApplicationScaler(config)

  for (const applicationScaler of [batchedScaler, incrementalScaler]) {
    applicationScaler.addWorker('remaining', 1000)
    applicationScaler.addWorker('restarting', 9000)
    for (const [metric, multiplier] of [['elu', 1], ['heap', 100]]) {
      applicationScaler.addSample(metric, 'remaining', 10000, 0.2 * multiplier)
      applicationScaler.addSample(metric, 'remaining', 12000, 0.4 * multiplier)
      applicationScaler.addSample(metric, 'restarting', 10000, 0.8 * multiplier)
    }
    applicationScaler.removeWorker('restarting', 12500)
    applicationScaler.addWorker('restarting', 13500)
    for (const [metric, multiplier] of [['elu', 1], ['heap', 100]]) {
      applicationScaler.addSample(metric, 'restarting', 13500, 0.1 * multiplier)
      applicationScaler.addSample(metric, 'restarting', 14500, 0.3 * multiplier)
    }
  }

  for (const timestamp of [10000, 11000, 12000, 13000, 14000]) incrementalScaler.process(timestamp)
  // Retain the exited lifetime across a partial batch before draining its samples.
  batchedScaler.process(10000)
  assert.equal(batchedScaler.process(15000), incrementalScaler.process(15000))
  for (const metric of ['elu', 'heap']) {
    assert.deepEqual(batchedScaler._getSnapshot(metric), incrementalScaler._getSnapshot(metric))
  }

  // These readings interpolate across already processed carry-forward ticks.
  for (const applicationScaler of [batchedScaler, incrementalScaler]) {
    applicationScaler.addSample('elu', 'remaining', 18000, 0.7)
    applicationScaler.addSample('heap', 'remaining', 18000, 90)
    applicationScaler.addSample('elu', 'restarting', 16000, NaN)
    applicationScaler.addSample('heap', 'restarting', 16000, undefined)
  }
  for (const timestamp of [16000, 17000, 18000]) incrementalScaler.process(timestamp)
  assert.equal(batchedScaler.process(19000), incrementalScaler.process(19000))
  for (const metric of ['elu', 'heap']) {
    assert.deepEqual(batchedScaler._getSnapshot(metric), incrementalScaler._getSnapshot(metric))
  }
})

test('a run after a long gap restarts from the stored samples', () => {
  const config = {
    minimum: 1,
    maximum: 10,
    cooldowns: {},
    metrics: {
      elu: { threshold: 0.8, redistributionMs: 1, alphaUp: 0.2, alphaDown: 0.1, betaUp: 0.1, betaDown: 0.1 }
    }
  }
  const resumedScaler = new PredictiveApplicationScaler(config)
  const freshScaler = new PredictiveApplicationScaler(config)
  resumedScaler.addWorker('worker', 0)
  freshScaler.addWorker('worker', 0)

  for (let timestamp = 1000; timestamp <= 240000; timestamp += 1000) {
    const value = 0.3 + timestamp / 1e6
    resumedScaler.addSample('elu', 'worker', timestamp, value)
    if (timestamp <= 60000) {
      resumedScaler.process(timestamp)
    } else {
      // Only the stored samples matter after the gap.
      freshScaler.addSample('elu', 'worker', timestamp, value)
    }
  }

  resumedScaler.process(240000)
  freshScaler.process(240000)
  assert.deepEqual(resumedScaler._getSnapshot('elu'), freshScaler._getSnapshot('elu'))
})
