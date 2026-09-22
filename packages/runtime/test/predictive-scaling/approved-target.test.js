import assert from 'node:assert/strict'
import { test } from 'node:test'
import { PredictiveScalingAlgorithm } from '../../lib/predictive-scaling.js'

function createAlgorithm (cooldowns = {}) {
  const metric = {
    threshold: 1,
    redistributionMs: 1,
    alphaUp: 1,
    alphaDown: 1,
    betaUp: 0,
    betaDown: 0
  }
  const algorithm = new PredictiveScalingAlgorithm({
    min: 1,
    max: 10,
    scaleUpMargin: 0,
    scaleDownMargin: 0,
    cooldowns: {
      scaleUpAfterScaleUpMs: 0,
      scaleUpAfterScaleDownMs: 0,
      scaleDownAfterScaleUpMs: 0,
      scaleDownAfterScaleDownMs: 0,
      ...cooldowns
    },
    metrics: { elu: metric, heap: metric }
  })
  algorithm.addWorker('w1', 1000)
  return algorithm
}

function sample (algorithm, timestamp, value, workers = ['w1']) {
  for (const worker of workers) {
    algorithm.addSample('elu', worker, timestamp, value)
    algorithm.addSample('heap', worker, timestamp, value)
  }
  return algorithm.process(timestamp)
}

test('recommendations do not change the target or start cooldowns', t => {
  t.mock.timers.enable({ apis: ['Date'], now: 10000 })
  const algorithm = createAlgorithm({ scaleUpAfterScaleUpMs: 60000 })
  assert.equal(sample(algorithm, 10000, 4), 4)
  assert.equal(algorithm.getSnapshot('elu').targetCount, 1)
  assert.equal(algorithm.getSnapshot('heap').targetCount, 1)
  // The coordinator rejects the request. The next tick can still recommend it.
  assert.equal(sample(algorithm, 11000, 4), 4)
  assert.equal(sample(algorithm, 12000, 0.1), 1)
})

test('only the approved extra worker blocks scale-down, shared by both metrics', t => {
  t.mock.timers.enable({ apis: ['Date'], now: 10000 })
  const algorithm = createAlgorithm()
  assert.equal(sample(algorithm, 10000, 4), 4)
  algorithm.setTarget(2)
  assert.equal(algorithm.getSnapshot('elu').targetCount, 2)
  assert.equal(algorithm.getSnapshot('heap').targetCount, 2)
  assert.equal(sample(algorithm, 11000, 0.1), 2)
  algorithm.addWorker('w2', 12000)
  assert.equal(sample(algorithm, 13000, 0.1, ['w1', 'w2']), 1)
  // Even scale-down recommendations need coordinator approval.
  assert.equal(algorithm.getSnapshot('elu').targetCount, 2)
  algorithm.setTarget(1)
  assert.equal(algorithm.getSnapshot('heap').targetCount, 1)
})

test('cooldown starts at approval, and setting the same target does not extend it', t => {
  t.mock.timers.enable({ apis: ['Date'], now: 20000 })
  const algorithm = createAlgorithm({ scaleUpAfterScaleUpMs: 5000 })
  assert.equal(sample(algorithm, 10000, 4), 4)
  algorithm.setTarget(2)
  assert.equal(sample(algorithm, 24000, 4), 2)
  t.mock.timers.setTime(24000)
  algorithm.setTarget(2)
  assert.equal(sample(algorithm, 25000, 4), 4)
})

test('startup duration starts at approval rather than the earlier recommendation', t => {
  t.mock.timers.enable({ apis: ['Date'], now: 20000 })
  const algorithm = createAlgorithm()
  assert.equal(sample(algorithm, 10000, 4), 4)
  algorithm.setTarget(3)
  algorithm.addWorker('w2', 21000)
  algorithm.addWorker('w3', 21000)
  assert.equal(algorithm.getSnapshot('elu').horizonMs, 7000)
  assert.equal(algorithm.getSnapshot('heap').horizonMs, 7000)
})

test('an approved worker that never starts stops blocking scale-down after expiry', t => {
  t.mock.timers.enable({ apis: ['Date'], now: 10000 })
  const algorithm = createAlgorithm()
  algorithm.setTarget(2)
  // Expected startup at 15000 plus the existing 30000 ms expiry allowance.
  assert.equal(sample(algorithm, 45000, 0.1), 2)
  assert.equal(sample(algorithm, 46000, 0.1), 1)
  // Expiry clears pending starts, but does not itself approve a new target.
  assert.equal(algorithm.getSnapshot('elu').targetCount, 2)
})

test('expiry removes only old requests and leaves newer pending starts', t => {
  t.mock.timers.enable({ apis: ['Date'], now: 10000 })
  const algorithm = createAlgorithm()
  algorithm.setTarget(2)
  t.mock.timers.setTime(20000)
  algorithm.setTarget(3)
  assert.equal(sample(algorithm, 46000, 0.1), 3)
  algorithm.addWorker('w2', 47000)
  assert.equal(sample(algorithm, 48000, 0.1, ['w1', 'w2']), 3)
  algorithm.addWorker('w3', 49000)
  assert.equal(sample(algorithm, 50000, 0.1, ['w1', 'w2', 'w3']), 1)
})

test('pending requests expire during processing even without a scale-down recommendation', t => {
  t.mock.timers.enable({ apis: ['Date'], now: 10000 })
  const algorithm = createAlgorithm()
  algorithm.setTarget(3)
  assert.equal(sample(algorithm, 46000, 4), 4)
  // These starts must not match old requests and inflate the startup estimate.
  algorithm.addWorker('w2', 47000)
  algorithm.addWorker('w3', 47000)
  assert.equal(algorithm.getSnapshot('elu').horizonMs, 7000)
})

for (const replacementId of ['w1', 'replacement']) {
  test(`replacement ${replacementId} does not fulfil a pending scale-up until the live count grows`, t => {
    t.mock.timers.enable({ apis: ['Date'], now: 10000 })
    const algorithm = createAlgorithm()
    algorithm.setTarget(2)
    algorithm.removeWorker('w1', 11000)
    algorithm.addWorker(replacementId, 12000)
    assert.equal(sample(algorithm, 13000, 0.1, [replacementId]), 2)

    algorithm.addWorker('extra', 14000)
    assert.equal(sample(algorithm, 15000, 0.1, [replacementId, 'extra']), 1)
  })
}

test('duplicate lifecycle events do not change the live count', t => {
  t.mock.timers.enable({ apis: ['Date'], now: 10000 })
  const algorithm = createAlgorithm()
  algorithm.setTarget(2)
  algorithm.addWorker('w1', 11000)
  assert.equal(sample(algorithm, 12000, 0.1), 2)
  algorithm.removeWorker('w1', 13000)
  algorithm.removeWorker('w1', 13000)
  algorithm.removeWorker('unknown', 13000)
  algorithm.addWorker('replacement', 14000)
  assert.equal(sample(algorithm, 15000, 0.1, ['replacement']), 2)
  algorithm.addWorker('extra', 16000)
  assert.equal(sample(algorithm, 17000, 0.1, ['replacement', 'extra']), 1)
})

test('each pending scale-up waits for its own expected live count', t => {
  t.mock.timers.enable({ apis: ['Date'], now: 10000 })
  const algorithm = createAlgorithm()
  algorithm.setTarget(2)
  t.mock.timers.setTime(11000)
  algorithm.setTarget(3)
  algorithm.addWorker('w2', 12000)
  assert.equal(sample(algorithm, 13000, 0.1, ['w1', 'w2']), 3)

  algorithm.removeWorker('w1', 14000)
  algorithm.addWorker('replacement', 15000)
  assert.equal(sample(algorithm, 16000, 0.1, ['replacement', 'w2']), 3)
  algorithm.addWorker('w3', 17000)
  assert.equal(sample(algorithm, 18000, 0.1, ['replacement', 'w2', 'w3']), 1)
})

test('startup estimates use the time when the requested capacity exists', t => {
  t.mock.timers.enable({ apis: ['Date'], now: 10000 })
  const algorithm = createAlgorithm()
  algorithm.setTarget(3)
  algorithm.removeWorker('w1', 11000)
  algorithm.addWorker('replacement', 12000)
  algorithm.addWorker('w2', 20000)
  algorithm.addWorker('w3', 22000)
  // Both measured increases took longer than the initial five-second estimate.
  assert.ok(algorithm.getSnapshot('elu').horizonMs > 7000)
  assert.equal(algorithm.getSnapshot('heap').horizonMs, algorithm.getSnapshot('elu').horizonMs)
})

test('a replacement starting before the old worker exits can fulfil the requested count', t => {
  t.mock.timers.enable({ apis: ['Date'], now: 10000 })
  const algorithm = createAlgorithm()
  algorithm.setTarget(2)
  // Accepted tradeoff: the count briefly reaches two during a rolling restart.
  algorithm.addWorker('replacement', 11000)
  algorithm.removeWorker('w1', 12000)
  assert.equal(sample(algorithm, 13000, 0.1, ['replacement']), 1)
})
