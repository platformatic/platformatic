import assert from 'node:assert/strict'
import { test } from 'node:test'
import { PredictiveScalingAlgorithm } from '../../lib/predictive-scaling.js'

function createAlgorithm () {
  const metric = {
    threshold: 0.8,
    redistributionMs: 1,
    alphaUp: 1,
    alphaDown: 1,
    betaUp: 0,
    betaDown: 0
  }
  return new PredictiveScalingAlgorithm({
    min: 1,
    max: 10,
    scaleUpMargin: 0.1,
    scaleDownMargin: 0.3,
    cooldowns: {},
    metrics: { elu: metric, heap: metric }
  })
}

for (const metric of ['elu', 'heap']) {
  test(`${metric}: retain pending readings before exit, exclude the exit tick and later ticks`, () => {
    const algorithm = createAlgorithm()
    algorithm.addWorker('remaining', 0)
    algorithm.addWorker('exiting', 0)
    for (const timestamp of [10000, 11000, 12000]) {
      algorithm.addSample(metric, 'remaining', timestamp, 0.2)
      algorithm.addSample(metric, 'exiting', timestamp, 0.8)
    }

    algorithm.removeWorker('exiting', 12000)
    // Process only part of the pending history; the exited lifetime must survive.
    algorithm.process(10000)
    algorithm.process(13000)

    assert.deepEqual(algorithm.getSnapshot(metric).history, [
      { timestamp: 10000, value: 0.5 },
      { timestamp: 11000, value: 0.5 },
      { timestamp: 12000, value: 0.2 },
      { timestamp: 13000, value: 0.2 }
    ])
  })

  test(`${metric}: metrics cannot register or revive a worker`, () => {
    const algorithm = createAlgorithm()
    algorithm.addSample(metric, 'worker', 1000, 0.8)
    assert.equal(algorithm.process(2000), null)

    algorithm.addWorker('worker', 2000)
    algorithm.addSample(metric, 'worker', 3000, 0.8)
    algorithm.process(3000)
    algorithm.removeWorker('worker', 3500)
    algorithm.removeWorker('worker', 3600)
    const before = structuredClone(algorithm.getSnapshot(metric))

    algorithm.addSample(metric, 'worker', 4000, 0.9)
    assert.equal(algorithm.process(5000), null)
    // A later event must also be ignored after the ended state has been cleaned up.
    algorithm.addSample(metric, 'worker', 70000, 0.9)
    assert.equal(algorithm.process(71000), null)
    assert.deepEqual(algorithm.getSnapshot(metric), before)
  })

  test(`${metric}: restarting the same worker ID keeps distinct lifetimes without a timer`, t => {
    t.mock.timers.enable({ apis: ['setTimeout'] })
    const algorithm = createAlgorithm()
    algorithm.addWorker('worker', 0)
    algorithm.addSample(metric, 'worker', 10000, 0.8)
    algorithm.addSample(metric, 'worker', 11000, 0.8)
    algorithm.removeWorker('worker', 11500)

    algorithm.addWorker('worker', 12500)
    algorithm.addSample(metric, 'worker', 12000, 0.9) // Outside the new lifetime.
    algorithm.addSample(metric, 'worker', 12500, 0.2)
    algorithm.addSample(metric, 'worker', 13500, 0.2)
    algorithm.process(14000)

    assert.deepEqual(algorithm.getSnapshot(metric).history, [
      { timestamp: 10000, value: 0.8 },
      { timestamp: 11000, value: 0.8 },
      { timestamp: 13000, value: 0.2 },
      { timestamp: 14000, value: 0.2 }
    ])

    // The old five-second removal must not remove the restarted worker's mapping.
    t.mock.timers.tick(5000)
    algorithm.addSample(metric, 'worker', 19000, 0.2)
    assert.notEqual(algorithm.process(19000), null)
    assert.equal(algorithm.getSnapshot(metric).history.at(-1).timestamp, 19000)
  })

  test(`${metric}: silence does not expire an active lifetime`, () => {
    const algorithm = createAlgorithm()
    algorithm.addWorker('worker', 0)
    algorithm.process(70000) // Includes an active worker with no samples yet.
    algorithm.addSample(metric, 'worker', 71000, 0.4)
    assert.notEqual(algorithm.process(71000), null)

    algorithm.process(140000)
    algorithm.addSample(metric, 'worker', 141000, 0.4)
    assert.notEqual(algorithm.process(141000), null)
    assert.equal(algorithm.getSnapshot(metric).history.at(-1).timestamp, 141000)
  })

  test(`${metric}: duplicate start notifications preserve pending samples`, () => {
    const algorithm = createAlgorithm()
    algorithm.addWorker('worker', 0)
    algorithm.addSample(metric, 'worker', 10000, 0.4)
    algorithm.addWorker('worker', 11000)
    algorithm.process(10000)
    assert.deepEqual(algorithm.getSnapshot(metric).history, [{ timestamp: 10000, value: 0.4 }])
  })
}
