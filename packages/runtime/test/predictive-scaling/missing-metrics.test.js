import assert from 'node:assert/strict'
import { test } from 'node:test'
import { MetricStore, PredictiveScalingAlgorithm } from '../../lib/predictive-scaling.js'

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

test('missing ticks use the last raw measurement, without extending its slope', () => {
  const store = new MetricStore(1000, 60000)
  store.push(1200, 0.25)
  store.push(2400, 1)

  assert.deepEqual(store.getEntries(1000, 4000), [
    { timestamp: 1000, value: 0.25 },
    { timestamp: 2000, value: 0.75 },
    { timestamp: 3000, value: 1 },
    { timestamp: 4000, value: 1 }
  ])
  // Estimates do not become measurements in the stored series.
  assert.deepEqual(store.getEntries(), [
    { timestamp: 1000, value: 0.25 },
    { timestamp: 2000, value: 0.75 }
  ])
})

for (const metric of ['elu', 'heap']) {
  for (const invalid of [null, undefined, NaN, Infinity, -Infinity, '0.9']) {
    test(`${metric}: invalid readings (${String(invalid)}) carry forward the last valid value`, () => {
      const algorithm = createAlgorithm()
      algorithm.addWorker('reporting', 0)
      algorithm.addWorker('invalid', 0)
      algorithm.addSample(metric, 'reporting', 10000, 0.25)
      algorithm.addSample(metric, 'invalid', 10000, 0.75)
      algorithm.process(10000)

      algorithm.addSample(metric, 'reporting', 11000, 0.25)
      algorithm.addSample(metric, 'invalid', 11000, invalid)
      algorithm.process(12000)
      assert.deepEqual(algorithm.getSnapshot(metric).history, [
        { timestamp: 10000, value: 0.5 },
        { timestamp: 11000, value: 0.5 },
        { timestamp: 12000, value: 0.5 }
      ])

      // A valid zero replaces the held value without revisiting earlier ticks.
      algorithm.addSample(metric, 'invalid', 13000, 0)
      algorithm.process(13000)
      assert.deepEqual(algorithm.getSnapshot(metric).history.at(-1), { timestamp: 13000, value: 0.125 })
    })
  }

  test(`${metric}: a silent worker retains its last value and remains counted`, () => {
    const algorithm = createAlgorithm()
    algorithm.addWorker('reporting', 0)
    algorithm.addWorker('silent', 0)
    algorithm.addSample(metric, 'reporting', 10000, 0.25)
    algorithm.addSample(metric, 'silent', 10000, 0.75)
    algorithm.process(10000)

    algorithm.addSample(metric, 'reporting', 12000, 0.5)
    algorithm.process(13000)
    assert.deepEqual(algorithm.getSnapshot(metric).history, [
      { timestamp: 10000, value: 0.5 },
      { timestamp: 11000, value: 0.5625 },
      { timestamp: 12000, value: 0.625 },
      { timestamp: 13000, value: 0.625 }
    ])
  })

  test(`${metric}: carry-forward continues across processing runs when all workers are silent`, () => {
    const algorithm = createAlgorithm()
    algorithm.addWorker('worker', 0)
    assert.equal(algorithm.process(9000), null) // No value to carry yet.
    algorithm.addSample(metric, 'worker', 10000, 0.5)
    algorithm.process(11000)
    algorithm.process(13000)
    assert.deepEqual(algorithm.getSnapshot(metric).history, [
      { timestamp: 10000, value: 0.5 },
      { timestamp: 11000, value: 0.5 },
      { timestamp: 12000, value: 0.5 },
      { timestamp: 13000, value: 0.5 }
    ])
    assert.equal(algorithm.process(13500), null)
  })

  test(`${metric}: zero is a valid last value`, () => {
    const algorithm = createAlgorithm()
    algorithm.addWorker('worker', 0)
    algorithm.addSample(metric, 'worker', 10000, 0)
    algorithm.process(12000)
    assert.deepEqual(algorithm.getSnapshot(metric).history, [
      { timestamp: 10000, value: 0 },
      { timestamp: 11000, value: 0 },
      { timestamp: 12000, value: 0 }
    ])
  })

  test(`${metric}: a new reading affects pending ticks without replaying carried ticks`, () => {
    const algorithm = createAlgorithm()
    algorithm.addWorker('worker', 0)
    algorithm.addSample(metric, 'worker', 10000, 0.25)
    algorithm.process(12000)
    algorithm.addSample(metric, 'worker', 14000, 0.75)
    algorithm.process(14000)
    assert.deepEqual(algorithm.getSnapshot(metric).history, [
      { timestamp: 10000, value: 0.25 },
      { timestamp: 11000, value: 0.25 },
      { timestamp: 12000, value: 0.25 },
      { timestamp: 13000, value: 0.625 },
      { timestamp: 14000, value: 0.75 }
    ])
  })

  test(`${metric}: carry-forward stops at exit and does not cross into a restarted lifetime`, () => {
    const algorithm = createAlgorithm()
    algorithm.addWorker('worker', 0)
    algorithm.addSample(metric, 'worker', 10000, 0.75)
    algorithm.removeWorker('worker', 12000)
    algorithm.addWorker('worker', 13000)
    algorithm.process(15000)
    assert.deepEqual(algorithm.getSnapshot(metric).history, [
      { timestamp: 10000, value: 0.75 },
      { timestamp: 11000, value: 0.75 }
    ])
    algorithm.addSample(metric, 'worker', 16000, 0.25)
    algorithm.process(17000)
    assert.deepEqual(algorithm.getSnapshot(metric).history.slice(-2), [
      { timestamp: 16000, value: 0.25 },
      { timestamp: 17000, value: 0.25 }
    ])
  })
}
