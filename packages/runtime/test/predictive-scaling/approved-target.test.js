import assert from 'node:assert/strict'
import { test } from 'node:test'
import { PredictiveApplicationScaler } from '../../lib/predictive-scaling.js'

function createApplicationScaler (cooldowns = {}) {
  const metric = {
    threshold: 1,
    redistributionMs: 1,
    alphaUp: 1,
    alphaDown: 1,
    betaUp: 0,
    betaDown: 0
  }
  const applicationScaler = new PredictiveApplicationScaler({
    minimum: 1,
    maximum: 10,
    cooldowns: {
      scaleUpAfterScaleUpMs: 0,
      scaleUpAfterScaleDownMs: 0,
      scaleDownAfterScaleUpMs: 0,
      scaleDownAfterScaleDownMs: 0,
      ...cooldowns
    },
    metrics: { elu: metric, heap: metric }
  })
  applicationScaler.addWorker('w1', 1000)
  return applicationScaler
}

function sample (applicationScaler, timestamp, value, workers = ['w1']) {
  for (const worker of workers) {
    applicationScaler.addSample('elu', worker, timestamp, value)
    applicationScaler.addSample('heap', worker, timestamp, value)
  }
  return applicationScaler.process(timestamp)
}

test('recommendations do not change the target or start cooldowns', t => {
  t.mock.timers.enable({ apis: ['Date'], now: 10000 })
  const applicationScaler = createApplicationScaler({ scaleUpAfterScaleUpMs: 60000 })
  assert.equal(sample(applicationScaler, 10000, 4), 4)
  assert.equal(applicationScaler._getSnapshot('elu').targetCount, 1)
  assert.equal(applicationScaler._getSnapshot('heap').targetCount, 1)
  // The coordinator rejects the request. The next tick can still recommend it.
  assert.equal(sample(applicationScaler, 11000, 4), 4)
  assert.equal(sample(applicationScaler, 12000, 0.1), 1)
})

test('only the approved extra worker blocks scale-down, shared by both metrics', t => {
  t.mock.timers.enable({ apis: ['Date'], now: 10000 })
  const applicationScaler = createApplicationScaler()
  assert.equal(sample(applicationScaler, 10000, 4), 4)
  applicationScaler.setTargetCount(2)
  assert.equal(applicationScaler._getSnapshot('elu').targetCount, 2)
  assert.equal(applicationScaler._getSnapshot('heap').targetCount, 2)
  assert.equal(sample(applicationScaler, 11000, 0.1), 2)
  applicationScaler.addWorker('w2', 12000)
  assert.equal(sample(applicationScaler, 13000, 0.1, ['w1', 'w2']), 1)
  // Even scale-down recommendations need coordinator approval.
  assert.equal(applicationScaler._getSnapshot('elu').targetCount, 2)
  applicationScaler.setTargetCount(1)
  assert.equal(applicationScaler._getSnapshot('heap').targetCount, 1)
})

test('raising the stored target below the live count does not create pending starts', t => {
  t.mock.timers.enable({ apis: ['Date'], now: 10000 })
  const applicationScaler = createApplicationScaler()
  const workers = ['w1', 'w2', 'w3', 'w4', 'w5']
  for (const worker of workers.slice(1)) applicationScaler.addWorker(worker, 1000)
  applicationScaler.syncWorkersCount(3)
  assert.equal(sample(applicationScaler, 11000, 0.1, workers), 1)
})

test('a forced decrease does not start the scale-down cooldown even when the stored target increases', t => {
  t.mock.timers.enable({ apis: ['Date'], now: 10000 })
  const applicationScaler = createApplicationScaler({ scaleUpAfterScaleDownMs: 5000 })
  const workers = ['w1', 'w2', 'w3', 'w4', 'w5']
  for (const worker of workers.slice(1)) applicationScaler.addWorker(worker, 1000)
  applicationScaler.syncWorkersCount(3)
  assert.equal(applicationScaler.targetCount, 3)
  assert.equal(sample(applicationScaler, 11000, 1, workers), 5)
})

test('approving the existing target does not start a cooldown', t => {
  t.mock.timers.enable({ apis: ['Date'], now: 10000 })
  const applicationScaler = createApplicationScaler({ scaleUpAfterScaleUpMs: 5000, scaleUpAfterScaleDownMs: 5000 })
  applicationScaler.setTargetCount(1)
  assert.equal(applicationScaler.targetCount, 1)
  assert.equal(sample(applicationScaler, 11000, 4), 4)
})

test('correcting to the stored target allows further scale-down without a new cooldown', t => {
  t.mock.timers.enable({ apis: ['Date'], now: 10000 })
  const applicationScaler = createApplicationScaler({ scaleDownAfterScaleDownMs: 5000 })
  applicationScaler.syncWorkersCount(3)
  applicationScaler.addWorker('w2', 1000)
  applicationScaler.addWorker('w3', 1000)
  applicationScaler.syncWorkersCount(3)
  assert.equal(sample(applicationScaler, 11000, 0.1, ['w1', 'w2', 'w3']), 1)
})

test('a correction creates neither pending starts nor a scale-up cooldown', t => {
  t.mock.timers.enable({ apis: ['Date'], now: 10000 })
  const applicationScaler = createApplicationScaler({ scaleUpAfterScaleUpMs: 5000 })
  applicationScaler.syncWorkersCount(3)
  assert.equal(sample(applicationScaler, 11000, 4), 4)
  applicationScaler.syncWorkersCount(3)
  assert.equal(sample(applicationScaler, 12000, 0.1), 1)
})

test('corrections preserve pending start ages and discard superseded capacity', t => {
  t.mock.timers.enable({ apis: ['Date'], now: 10000 })
  const applicationScaler = createApplicationScaler()
  applicationScaler.setTargetCount(4)
  t.mock.timers.setTime(20000)
  applicationScaler.syncWorkersCount(3)
  assert.equal(sample(applicationScaler, 45000, 0.1), 3)
  assert.equal(sample(applicationScaler, 46000, 0.1), 1)
})

test('a correction discards pending starts above its target', t => {
  t.mock.timers.enable({ apis: ['Date'], now: 10000 })
  const applicationScaler = createApplicationScaler()
  applicationScaler.setTargetCount(4)
  applicationScaler.syncWorkersCount(2)
  applicationScaler.addWorker('w2', 11000)
  assert.equal(sample(applicationScaler, 12000, 0.1, ['w1', 'w2']), 1)
})

test('a correction preserves cooldowns from earlier predictive decisions', t => {
  t.mock.timers.enable({ apis: ['Date'], now: 10000 })
  const applicationScaler = createApplicationScaler({ scaleUpAfterScaleDownMs: 5000 })
  applicationScaler.syncWorkersCount(3)
  applicationScaler.setTargetCount(2)
  t.mock.timers.setTime(12000)
  applicationScaler.syncWorkersCount(3)
  assert.equal(sample(applicationScaler, 14000, 4), 3)
  assert.equal(sample(applicationScaler, 15000, 4), 4)
})

test('cooldown starts at approval, and setting the same target does not extend it', t => {
  t.mock.timers.enable({ apis: ['Date'], now: 20000 })
  const applicationScaler = createApplicationScaler({ scaleUpAfterScaleUpMs: 5000 })
  assert.equal(sample(applicationScaler, 10000, 4), 4)
  applicationScaler.setTargetCount(2)
  assert.equal(sample(applicationScaler, 24000, 4), 2)
  t.mock.timers.setTime(24000)
  applicationScaler.setTargetCount(2)
  assert.equal(sample(applicationScaler, 25000, 4), 4)
})

test('startup duration starts at approval rather than the earlier recommendation', t => {
  t.mock.timers.enable({ apis: ['Date'], now: 20000 })
  const applicationScaler = createApplicationScaler()
  assert.equal(sample(applicationScaler, 10000, 4), 4)
  applicationScaler.setTargetCount(3)
  applicationScaler.addWorker('w2', 21000)
  applicationScaler.addWorker('w3', 21000)
  assert.equal(applicationScaler._getSnapshot('elu').horizonMs, 7000)
  assert.equal(applicationScaler._getSnapshot('heap').horizonMs, 7000)
})

test('an approved worker that never starts stops blocking scale-down after expiry', t => {
  t.mock.timers.enable({ apis: ['Date'], now: 10000 })
  const applicationScaler = createApplicationScaler()
  applicationScaler.setTargetCount(2)
  // Expected startup at 15000 plus the existing 30000 ms expiry allowance.
  assert.equal(sample(applicationScaler, 45000, 0.1), 2)
  assert.equal(sample(applicationScaler, 46000, 0.1), 1)
  // Expiry removes capacity that never appeared from the remembered target.
  assert.equal(applicationScaler.targetCount, 1)
  assert.equal(applicationScaler._getSnapshot('elu').targetCount, 1)
})

test('expiry removes only old requests and leaves newer pending starts', t => {
  t.mock.timers.enable({ apis: ['Date'], now: 10000 })
  const applicationScaler = createApplicationScaler()
  applicationScaler.setTargetCount(2)
  t.mock.timers.setTime(20000)
  applicationScaler.setTargetCount(3)
  assert.equal(sample(applicationScaler, 46000, 0.1), 2)
  assert.equal(applicationScaler.targetCount, 2)
  applicationScaler.addWorker('w2', 47000)
  assert.equal(sample(applicationScaler, 48000, 0.1, ['w1', 'w2']), 1)
})

test('pending requests expire during processing even without a scale-down recommendation', t => {
  t.mock.timers.enable({ apis: ['Date'], now: 10000 })
  const applicationScaler = createApplicationScaler()
  applicationScaler.setTargetCount(3)
  assert.equal(sample(applicationScaler, 46000, 4), 4)
  // These starts must not match old requests and inflate the startup estimate.
  applicationScaler.addWorker('w2', 47000)
  applicationScaler.addWorker('w3', 47000)
  assert.equal(applicationScaler._getSnapshot('elu').horizonMs, 7000)
})

test('expiry lets the application scaler request the same missing capacity again', t => {
  t.mock.timers.enable({ apis: ['Date'], now: 10000 })
  const applicationScaler = createApplicationScaler()
  assert.equal(sample(applicationScaler, 10000, 1.5), 2)
  applicationScaler.setTargetCount(2)
  assert.equal(sample(applicationScaler, 45000, 1.5), 2)
  assert.equal(applicationScaler.targetCount, 2)
  assert.equal(sample(applicationScaler, 46000, 1.5), 2)
  assert.equal(applicationScaler.targetCount, 1)

  t.mock.timers.setTime(46000)
  applicationScaler.setTargetCount(2)
  assert.equal(sample(applicationScaler, 47000, 0.1), 2)
  applicationScaler.addWorker('w2', 48000)
  assert.equal(sample(applicationScaler, 49000, 0.1, ['w1', 'w2']), 1)
})

test('expiry preserves workers that started while dropping missing capacity', t => {
  t.mock.timers.enable({ apis: ['Date'], now: 10000 })
  const applicationScaler = createApplicationScaler()
  applicationScaler.setTargetCount(4)
  applicationScaler.addWorker('w2', 15000)
  sample(applicationScaler, 46000, 0.1, ['w1', 'w2'])
  assert.equal(applicationScaler.targetCount, 2)
})

test('expiry reconciles the target even when there are no metric samples', t => {
  t.mock.timers.enable({ apis: ['Date'], now: 10000 })
  const applicationScaler = createApplicationScaler()
  applicationScaler.setTargetCount(2)
  assert.equal(applicationScaler.process(46000), null)
  assert.equal(applicationScaler.targetCount, 1)
})

test('expiry does not restart or bypass scale-up cooldowns', t => {
  t.mock.timers.enable({ apis: ['Date'], now: 10000 })
  const applicationScaler = createApplicationScaler({ scaleUpAfterScaleUpMs: 50000 })
  applicationScaler.setTargetCount(2)
  assert.equal(sample(applicationScaler, 46000, 1.5), 1)
  assert.equal(applicationScaler.targetCount, 1)
  assert.equal(sample(applicationScaler, 60000, 1.5), 2)
})

test('a later request can expire before an earlier request when the startup estimate decreases', t => {
  t.mock.timers.enable({ apis: ['Date'], now: 10000 })
  const applicationScaler = createApplicationScaler()
  applicationScaler.setTargetCount(3) // Both starts expected at 15000.
  applicationScaler.addWorker('w2', 10100) // Reduces the estimate from 5000 to 4500.
  t.mock.timers.setTime(10200)
  applicationScaler.setTargetCount(4) // This start is expected earlier, at 14700.
  applicationScaler.process(44700)
  assert.equal(applicationScaler.targetCount, 4)
  applicationScaler.process(44701)
  assert.equal(applicationScaler.targetCount, 3)
  applicationScaler.addWorker('w3', 44800)
  assert.equal(sample(applicationScaler, 45000, 0.1, ['w1', 'w2', 'w3']), 1)
})

for (const replacementId of ['w1', 'replacement']) {
  test(`replacement ${replacementId} does not fulfil a pending scale-up until the live count grows`, t => {
    t.mock.timers.enable({ apis: ['Date'], now: 10000 })
    const applicationScaler = createApplicationScaler()
    applicationScaler.setTargetCount(2)
    applicationScaler.removeWorker('w1', 11000)
    applicationScaler.addWorker(replacementId, 12000)
    assert.equal(sample(applicationScaler, 13000, 0.1, [replacementId]), 2)

    applicationScaler.addWorker('extra', 14000)
    assert.equal(sample(applicationScaler, 15000, 0.1, [replacementId, 'extra']), 1)
  })
}

test('duplicate lifecycle events do not change the live count', t => {
  t.mock.timers.enable({ apis: ['Date'], now: 10000 })
  const applicationScaler = createApplicationScaler()
  applicationScaler.setTargetCount(2)
  applicationScaler.addWorker('w1', 11000)
  assert.equal(sample(applicationScaler, 12000, 0.1), 2)
  applicationScaler.removeWorker('w1', 13000)
  applicationScaler.removeWorker('w1', 13000)
  applicationScaler.removeWorker('unknown', 13000)
  applicationScaler.addWorker('replacement', 14000)
  assert.equal(sample(applicationScaler, 15000, 0.1, ['replacement']), 2)
  applicationScaler.addWorker('extra', 16000)
  assert.equal(sample(applicationScaler, 17000, 0.1, ['replacement', 'extra']), 1)
})

test('each pending scale-up waits for its own expected live count', t => {
  t.mock.timers.enable({ apis: ['Date'], now: 10000 })
  const applicationScaler = createApplicationScaler()
  applicationScaler.setTargetCount(2)
  t.mock.timers.setTime(11000)
  applicationScaler.setTargetCount(3)
  applicationScaler.addWorker('w2', 12000)
  assert.equal(sample(applicationScaler, 13000, 0.1, ['w1', 'w2']), 3)

  applicationScaler.removeWorker('w1', 14000)
  applicationScaler.addWorker('replacement', 15000)
  assert.equal(sample(applicationScaler, 16000, 0.1, ['replacement', 'w2']), 3)
  applicationScaler.addWorker('w3', 17000)
  assert.equal(sample(applicationScaler, 18000, 0.1, ['replacement', 'w2', 'w3']), 1)
})

test('startup estimates use the time when the requested capacity exists', t => {
  t.mock.timers.enable({ apis: ['Date'], now: 10000 })
  const applicationScaler = createApplicationScaler()
  applicationScaler.setTargetCount(3)
  applicationScaler.removeWorker('w1', 11000)
  applicationScaler.addWorker('replacement', 12000)
  applicationScaler.addWorker('w2', 20000)
  applicationScaler.addWorker('w3', 22000)
  // Both measured increases took longer than the initial five-second estimate.
  assert.ok(applicationScaler._getSnapshot('elu').horizonMs > 7000)
  assert.equal(applicationScaler._getSnapshot('heap').horizonMs, applicationScaler._getSnapshot('elu').horizonMs)
})

test('a replacement starting before the old worker exits can fulfil the requested count', t => {
  t.mock.timers.enable({ apis: ['Date'], now: 10000 })
  const applicationScaler = createApplicationScaler()
  applicationScaler.setTargetCount(2)
  // Accepted tradeoff: the count briefly reaches two during a rolling restart.
  applicationScaler.addWorker('replacement', 11000)
  applicationScaler.removeWorker('w1', 12000)
  assert.equal(sample(applicationScaler, 13000, 0.1, ['replacement']), 1)
})
