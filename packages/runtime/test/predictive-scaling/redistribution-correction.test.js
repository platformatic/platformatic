import assert from 'node:assert/strict'
import { test } from 'node:test'
import { getStabilizationWeight, holt, PredictiveScalingAlgorithm, redistributeValues } from '../../lib/predictive-scaling.js'

const redistributionConfig = { redistributionMs: 5000, k: 1 }
const holtConfig = { alphaUp: 0.5, alphaDown: 0.3, betaUp: 0.3, betaDown: 0.1 }
const workers = new Map([
  ['stable', { startTime: 0 }],
  ['new', { startTime: 10000 }]
])

function assertClose (actual, expected) {
  assert.ok(Math.abs(actual - expected) < 1e-10, `expected ${actual} to be close to ${expected}`)
}

function makeTicks () {
  return [11000, 12000, 13000, 14000].map(timestamp => ({
    timestamp,
    workerValues: { stable: 100, new: 50 }
  }))
}

test('weight growth changes the level without creating a load trend', () => {
  const ticks = makeTicks()
  redistributeValues(ticks, workers, redistributionConfig, null)
  holt(ticks, holtConfig, null)

  assert.equal(ticks[0].redistribution.newSumDelta, 0)
  for (let i = 1; i < ticks.length; i++) {
    const previousWeight = getStabilizationWeight(ticks[i - 1].timestamp - 10000, 5000, 1)
    const weight = getStabilizationWeight(ticks[i].timestamp - 10000, 5000, 1)
    assertClose(ticks[i].redistribution.newSumDelta, (weight - previousWeight) * 50)
    assertClose(ticks[i].holt.level, ticks[i].redistribution.sum)
    assertClose(ticks[i].holt.trend, 0)
  }
})

test('real load growth still produces a positive trend during redistribution', () => {
  const ticks = makeTicks()
  ticks[1].workerValues.new = 80
  redistributeValues(ticks, workers, redistributionConfig, null)
  holt(ticks, holtConfig, null)
  assert.ok(ticks[1].holt.trend > 0)
})

test('drop absorption suppresses the weight correction', () => {
  const ticks = [{ timestamp: 12000, workerValues: { stable: 100, new: 50 } }]
  redistributeValues(ticks, workers, redistributionConfig, {
    prevSum: 140,
    prevSumOfWeight: getStabilizationWeight(1000, 5000, 1),
    prevNewAvgValue: 50,
    prevNewCount: 1
  })
  assert.equal(ticks[0].redistribution.sum, 140)
  assert.equal(ticks[0].redistribution.newSumDelta, 0)
})

test('graduating workers do not subtract their old weights from remaining weight growth', () => {
  const instances = new Map([
    ['stable', { startTime: 0 }],
    ['older', { startTime: 5000 }],
    ['younger', { startTime: 8000 }]
  ])
  const ticks = [9000, 10000].map(timestamp => ({
    timestamp,
    workerValues: { stable: 100, older: 40, younger: 60 }
  }))
  redistributeValues(ticks, instances, redistributionConfig, null)

  const previousWeights = getStabilizationWeight(4000, 5000, 1) + getStabilizationWeight(1000, 5000, 1)
  const remainingWeight = getStabilizationWeight(2000, 5000, 1)
  assertClose(ticks[1].redistribution.newSumDelta, (remainingWeight - previousWeights + 1) * 50)
})

test('stable-only ticks reset correction state, matching the original implementation', () => {
  const ticks = [{ timestamp: 15000, workerValues: { stable: 100, new: 50 } }]
  const current = redistributeValues(ticks, workers, redistributionConfig, {
    prevSum: 130,
    prevSumOfWeight: 0.8,
    prevNewAvgValue: 50,
    prevNewCount: 1
  })
  assert.equal(ticks[0].redistribution.newSumDelta, 0)
  assert.deepEqual(current, { prevSum: 150, prevSumOfWeight: 0, prevNewAvgValue: 0, prevNewCount: 0 })
})

test('one current redistribution state produces the same result across processing runs', () => {
  const combined = makeTicks()
  const expected = redistributeValues(combined, workers, redistributionConfig, null)
  holt(combined, holtConfig, null)

  const separate = makeTicks()
  let redistributionState = null
  let holtState = null
  for (const tick of separate) {
    redistributionState = redistributeValues([tick], workers, redistributionConfig, redistributionState)
    holtState = holt([tick], holtConfig, holtState)
  }

  assert.deepEqual(redistributionState, expected)
  assert.deepEqual(separate, combined)
})

test('Holt compensates both the forecast and the level difference', () => {
  const ticks = [{ redistribution: { sum: 110, newSumDelta: 10 } }]
  assert.deepEqual(holt(ticks, holtConfig, { level: 100, trend: 0 }), { level: 110, trend: 0 })
})

test('the application preserves independent correction state for ELU and heap between runs', () => {
  const metric = { ...holtConfig, redistributionMs: 5000, threshold: 1 }
  const algorithm = new PredictiveScalingAlgorithm({
    min: 1,
    max: 10,
    scaleUpMargin: 0.1,
    scaleDownMargin: 0.3,
    cooldowns: {},
    metrics: { elu: metric, heap: metric }
  })
  algorithm.addWorker('stable', 0)
  algorithm.addWorker('new', 10000)

  for (const timestamp of [11000, 12000, 13000, 14000]) {
    algorithm.addSample('elu', 'stable', timestamp, 0.5)
    algorithm.addSample('elu', 'new', timestamp, 0.25)
    algorithm.addSample('heap', 'stable', timestamp, 100)
    algorithm.addSample('heap', 'new', timestamp, 50)
    algorithm.process(timestamp)
  }

  const weight = getStabilizationWeight(4000, 5000, 1)
  assertClose(algorithm.getSnapshot('elu').level, 0.5 + weight * 0.25)
  assertClose(algorithm.getSnapshot('elu').trend, 0)
  assertClose(algorithm.getSnapshot('heap').level, 100 + weight * 50)
  assertClose(algorithm.getSnapshot('heap').trend, 0)
})
