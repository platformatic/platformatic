import assert from 'node:assert/strict'
import { test } from 'node:test'
import { MetricStore, PredictiveApplicationScaler } from '../../lib/predictive-scaling.js'

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
      const applicationScaler = createApplicationScaler()
      applicationScaler.addWorker('reporting', 0)
      applicationScaler.addWorker('invalid', 0)
      applicationScaler.addSample(metric, 'reporting', 10000, 0.25)
      applicationScaler.addSample(metric, 'invalid', 10000, 0.75)
      applicationScaler.process(10000)

      applicationScaler.addSample(metric, 'reporting', 11000, 0.25)
      applicationScaler.addSample(metric, 'invalid', 11000, invalid)
      applicationScaler.process(12000)
      assert.deepEqual(applicationScaler._getSnapshot(metric).history, [
        { timestamp: 10000, value: 0.5 },
        { timestamp: 11000, value: 0.5 },
        { timestamp: 12000, value: 0.5 }
      ])

      // A valid zero replaces the held value without revisiting earlier ticks.
      applicationScaler.addSample(metric, 'invalid', 13000, 0)
      applicationScaler.process(13000)
      assert.deepEqual(applicationScaler._getSnapshot(metric).history.at(-1), { timestamp: 13000, value: 0.125 })
    })
  }

  test(`${metric}: a silent worker retains its last value and remains counted`, () => {
    const applicationScaler = createApplicationScaler()
    applicationScaler.addWorker('reporting', 0)
    applicationScaler.addWorker('silent', 0)
    applicationScaler.addSample(metric, 'reporting', 10000, 0.25)
    applicationScaler.addSample(metric, 'silent', 10000, 0.75)
    applicationScaler.process(10000)

    applicationScaler.addSample(metric, 'reporting', 12000, 0.5)
    applicationScaler.process(13000)
    assert.deepEqual(applicationScaler._getSnapshot(metric).history, [
      { timestamp: 10000, value: 0.5 },
      { timestamp: 11000, value: 0.5625 },
      { timestamp: 12000, value: 0.625 },
      { timestamp: 13000, value: 0.625 }
    ])
  })

  test(`${metric}: carry-forward continues across processing runs when all workers are silent`, () => {
    const applicationScaler = createApplicationScaler()
    applicationScaler.addWorker('worker', 0)
    assert.equal(applicationScaler.process(9000), null) // No value to carry yet.
    applicationScaler.addSample(metric, 'worker', 10000, 0.5)
    applicationScaler.process(11000)
    applicationScaler.process(13000)
    assert.deepEqual(applicationScaler._getSnapshot(metric).history, [
      { timestamp: 10000, value: 0.5 },
      { timestamp: 11000, value: 0.5 },
      { timestamp: 12000, value: 0.5 },
      { timestamp: 13000, value: 0.5 }
    ])
    assert.equal(applicationScaler.process(13500), null)
  })

  test(`${metric}: zero is a valid last value`, () => {
    const applicationScaler = createApplicationScaler()
    applicationScaler.addWorker('worker', 0)
    applicationScaler.addSample(metric, 'worker', 10000, 0)
    applicationScaler.process(12000)
    assert.deepEqual(applicationScaler._getSnapshot(metric).history, [
      { timestamp: 10000, value: 0 },
      { timestamp: 11000, value: 0 },
      { timestamp: 12000, value: 0 }
    ])
  })

  test(`${metric}: a new reading affects pending ticks without replaying carried ticks`, () => {
    const applicationScaler = createApplicationScaler()
    applicationScaler.addWorker('worker', 0)
    applicationScaler.addSample(metric, 'worker', 10000, 0.25)
    applicationScaler.process(12000)
    applicationScaler.addSample(metric, 'worker', 14000, 0.75)
    applicationScaler.process(14000)
    assert.deepEqual(applicationScaler._getSnapshot(metric).history, [
      { timestamp: 10000, value: 0.25 },
      { timestamp: 11000, value: 0.25 },
      { timestamp: 12000, value: 0.25 },
      { timestamp: 13000, value: 0.625 },
      { timestamp: 14000, value: 0.75 }
    ])
  })

  test(`${metric}: carry-forward stops at exit and does not cross into a restarted lifetime`, () => {
    const applicationScaler = createApplicationScaler()
    applicationScaler.addWorker('worker', 0)
    applicationScaler.addSample(metric, 'worker', 10000, 0.75)
    applicationScaler.removeWorker('worker', 12000)
    applicationScaler.addWorker('worker', 13000)
    applicationScaler.process(15000)
    assert.deepEqual(applicationScaler._getSnapshot(metric).history, [
      { timestamp: 10000, value: 0.75 },
      { timestamp: 11000, value: 0.75 }
    ])
    applicationScaler.addSample(metric, 'worker', 16000, 0.25)
    applicationScaler.process(17000)
    assert.deepEqual(applicationScaler._getSnapshot(metric).history.slice(-2), [
      { timestamp: 16000, value: 0.25 },
      { timestamp: 17000, value: 0.25 }
    ])
  })
}
