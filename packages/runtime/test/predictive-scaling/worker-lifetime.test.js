import assert from 'node:assert/strict'
import { test } from 'node:test'
import { PredictiveApplicationScaler } from '../../lib/predictive-scaling.js'

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
    // Process only part of the pending history; the exited lifetime must survive.
    applicationScaler.process(10000)
    applicationScaler.process(13000)

    assert.deepEqual(applicationScaler._getSnapshot(metric).history, [
      { timestamp: 10000, value: 0.5 },
      { timestamp: 11000, value: 0.5 },
      { timestamp: 12000, value: 0.2 },
      { timestamp: 13000, value: 0.2 }
    ])
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
    // A later event must also be ignored after the ended state has been cleaned up.
    applicationScaler.addSample(metric, 'worker', 70000, 0.9)
    assert.equal(applicationScaler.process(71000), null)
    assert.deepEqual(applicationScaler._getSnapshot(metric), before)
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
    applicationScaler.process(14000)

    assert.deepEqual(applicationScaler._getSnapshot(metric).history, [
      { timestamp: 10000, value: 0.8 },
      { timestamp: 11000, value: 0.8 },
      { timestamp: 13000, value: 0.2 },
      { timestamp: 14000, value: 0.2 }
    ])

    // The old five-second removal must not remove the restarted worker's mapping.
    t.mock.timers.tick(5000)
    applicationScaler.addSample(metric, 'worker', 19000, 0.2)
    assert.notEqual(applicationScaler.process(19000), null)
    assert.equal(applicationScaler._getSnapshot(metric).history.at(-1).timestamp, 19000)
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
    assert.equal(applicationScaler._getSnapshot(metric).history.at(-1).timestamp, 141000)
  })

  test(`${metric}: duplicate start notifications preserve pending samples`, () => {
    const applicationScaler = createApplicationScaler()
    applicationScaler.addWorker('worker', 0)
    applicationScaler.addSample(metric, 'worker', 10000, 0.4)
    applicationScaler.addWorker('worker', 11000)
    applicationScaler.process(10000)
    assert.deepEqual(applicationScaler._getSnapshot(metric).history, [{ timestamp: 10000, value: 0.4 }])
  })
}
