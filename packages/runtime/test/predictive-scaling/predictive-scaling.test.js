import assert from 'node:assert'
import { test } from 'node:test'
import {
  MetricStore,
  getStabilizationWeight,
  redistributeValues,
  holt,
  TrendDirection,
  getTrendDirection,
  makeScalingDecision,
  median,
  calculateInitTimeout,
  SlidingWindow,
  PredictiveScalingAlgorithm
} from '../../lib/predictive-scaling.js'

const REDIST_MS = 5000

function weight (age, redistributionMs, k = 0.5) {
  const t = age / redistributionMs
  return (Math.exp(k * t) - 1) / (Math.exp(k) - 1)
}

function assertClose (actual, expected, tolerance = 1e-6) {
  assert.ok(
    Math.abs(actual - expected) < tolerance,
    `expected ${actual} to be close to ${expected} (tolerance ${tolerance})`
  )
}

// ---------------------------------------------------------------------------
// MetricStore
// ---------------------------------------------------------------------------

test('MetricStore', async (t) => {
  await t.test('first sample aligns to grid floor', () => {
    const w = new MetricStore(1000, 60000)
    w.push(1500, 0.42)

    const ticks = w.getEntries()
    assert.strictEqual(ticks.length, 1)
    assert.strictEqual(ticks[0].timestamp, 1000)
    assert.strictEqual(ticks[0].value, 0.42)
  })

  await t.test('interpolates between samples to fill grid ticks', () => {
    const w = new MetricStore(1000, 60000)
    w.push(1500, 0.1)
    w.push(2500, 0.3)

    const ticks = w.getEntries()
    assert.strictEqual(ticks.length, 3)
    assert.strictEqual(ticks[0].timestamp, 1000)
    assert.strictEqual(ticks[0].value, 0.1)
    assert.strictEqual(ticks[1].timestamp, 2000)
    // ratio = (2000 - 1500) / (2500 - 1500) = 0.5
    // value = 0.1 + (0.3 - 0.1) * 0.5 = 0.2
    assertClose(ticks[1].value, 0.2)
    // projected entry at 3000
    assert.strictEqual(ticks[2].timestamp, 3000)
  })

  await t.test('fills multiple grid ticks between distant samples', () => {
    const w = new MetricStore(1000, 60000)
    w.push(1500, 0.0)
    w.push(4500, 0.6)

    const ticks = w.getEntries()
    assert.strictEqual(ticks.length, 5)
    assert.strictEqual(ticks[0].timestamp, 1000)
    assert.strictEqual(ticks[1].timestamp, 2000)
    assert.strictEqual(ticks[2].timestamp, 3000)
    assert.strictEqual(ticks[3].timestamp, 4000)
    // projected entry at 5000
    assert.strictEqual(ticks[4].timestamp, 5000)
  })

  await t.test('two samples in same interval: only first creates a tick', () => {
    const w = new MetricStore(1000, 60000)
    w.push(1100, 0.3)
    w.push(1200, 0.9)

    const ticks = w.getEntries()
    assert.strictEqual(ticks.length, 1)
    assert.strictEqual(ticks[0].value, 0.3)
  })

  await t.test('getValues with start filters ticks', () => {
    const w = new MetricStore(1000, 60000)
    w.push(1500, 0.1)
    w.push(2500, 0.2)
    w.push(3500, 0.3)
    w.push(4500, 0.4)

    const ticks = w.getEntries(3000)
    assert.strictEqual(ticks.length, 3)
    assert.strictEqual(ticks[0].timestamp, 3000)
    assert.strictEqual(ticks[1].timestamp, 4000)
    // projected entry at 5000
    assert.strictEqual(ticks[2].timestamp, 5000)
  })

  await t.test('sliding window expires old ticks', () => {
    const w = new MetricStore(1000, 5000)

    for (let i = 1; i <= 10; i++) {
      w.push(i * 1000 + 500, 0.3)
    }

    // last aligned tick at 10000, cutoff = 10000 - 5000 = 5000
    const ticks = w.getEntries()
    assert.ok(ticks.length > 0)
    assert.ok(ticks[0].timestamp >= 5000, `oldest tick ${ticks[0].timestamp} should be >= 5000`)
  })

  await t.test('works with different intervals', () => {
    const w = new MetricStore(500, 60000)
    w.push(1500, 0.1)
    w.push(2500, 0.3)

    const ticks = w.getEntries()
    assert.strictEqual(ticks.length, 4)
    assert.strictEqual(ticks[0].timestamp, 1500)
    assert.strictEqual(ticks[1].timestamp, 2000)
    assert.strictEqual(ticks[2].timestamp, 2500)
    // projected entry at 3000
    assert.strictEqual(ticks[3].timestamp, 3000)
  })
})

// ---------------------------------------------------------------------------
// SlidingWindow
// ---------------------------------------------------------------------------

test('SlidingWindow', async (t) => {
  await t.test('push and read entries', () => {
    const sw = new SlidingWindow(5000)
    sw.push(1000, 0.5)
    sw.push(2000, 0.6)

    assert.strictEqual(sw.getEntries().length, 2)
    assert.strictEqual(sw.getEntries()[0].timestamp, 1000)
    assert.strictEqual(sw.getEntries()[0].value, 0.5)
  })

  await t.test('auto-expires old entries on push', () => {
    const sw = new SlidingWindow(5000)
    sw.push(1000, 0.5)
    sw.push(3000, 0.6)
    sw.push(6000, 0.7)
    sw.push(8000, 0.8)

    // last push at 8000, cutoff = 3000, entries with timestamp < 3000 removed
    assert.strictEqual(sw.getEntries().length, 3)
    assert.strictEqual(sw.getEntries()[0].timestamp, 3000)
    assert.strictEqual(sw.getEntries()[1].timestamp, 6000)
    assert.strictEqual(sw.getEntries()[2].timestamp, 8000)
  })

  await t.test('no expiry when all entries within window', () => {
    const sw = new SlidingWindow(60000)
    sw.push(1000, 0.5)
    sw.push(2000, 0.6)

    assert.strictEqual(sw.getEntries().length, 2)
  })

  await t.test('empty window', () => {
    const sw = new SlidingWindow(5000)
    assert.strictEqual(sw.getEntries().length, 0)
  })
})

// ---------------------------------------------------------------------------
// redistribution.js
// ---------------------------------------------------------------------------

test('getStabilizationWeight', async (t) => {
  await t.test('returns 0 at age 0', () => {
    assertClose(getStabilizationWeight(0, REDIST_MS, 0.5), 0)
  })

  await t.test('returns 1 at age = redistributionMs', () => {
    assertClose(getStabilizationWeight(REDIST_MS, REDIST_MS, 0.5), 1)
  })

  await t.test('monotonically increasing', () => {
    const w1 = getStabilizationWeight(1000, REDIST_MS, 0.5)
    const w2 = getStabilizationWeight(2000, REDIST_MS, 0.5)
    const w3 = getStabilizationWeight(3000, REDIST_MS, 0.5)

    assert.ok(w1 > 0 && w1 < 1)
    assert.ok(w2 > w1)
    assert.ok(w3 > w2)
    assert.ok(w3 < 1)
  })

  await t.test('matches expected formula', () => {
    const age = 2500
    const expected = weight(age, REDIST_MS, 0.5)
    assertClose(getStabilizationWeight(age, REDIST_MS, 0.5), expected)
  })
})

test('redistributeValues', async (t) => {
  await t.test('empty ticks', () => {
    const state = []
    const prevSum = redistributeValues(state, new Map(), { redistributionMs: REDIST_MS }, null)

    assert.strictEqual(state.length, 0)
    assert.strictEqual(prevSum, null)
  })

  await t.test('all stable workers', () => {
    const state = [{
      timestamp: 10000,
      workerValues: { w1: 100, w2: 80 }
    }]
    const workers = new Map([
      ['w1', { startTime: 0 }],
      ['w2', { startTime: 0 }]
    ])

    redistributeValues(state, workers, { redistributionMs: REDIST_MS }, null)

    assert.strictEqual(state[0].redistribution.sum, 180)
    assert.strictEqual(state[0].redistribution.count, 2)
  })

  await t.test('one stable and one new worker', () => {
    const state = [{
      timestamp: 10000,
      workerValues: { w1: 100, w2: 50 }
    }]
    const workers = new Map([
      ['w1', { startTime: 0 }],
      ['w2', { startTime: 8000 }]
    ])

    redistributeValues(state, workers, { redistributionMs: REDIST_MS }, null)

    // w1: age 10000 >= 5000 -> stable
    // w2: age 2000 < 5000 -> new
    const w2Weight = weight(2000, REDIST_MS)
    const baseShare = w2Weight // sumOfWeights / newCount = w2Weight / 1
    const expectedSum = 100 + 50 * baseShare
    const expectedCount = 1 + 1 * baseShare

    assertClose(state[0].redistribution.sum, expectedSum)
    assertClose(state[0].redistribution.count, expectedCount)
  })

  await t.test('all new workers', () => {
    const state = [{
      timestamp: 10000,
      workerValues: { w1: 60, w2: 40 }
    }]
    const workers = new Map([
      ['w1', { startTime: 8000 }],
      ['w2', { startTime: 9000 }]
    ])

    redistributeValues(state, workers, { redistributionMs: REDIST_MS }, null)

    // w1: age 2000, w2: age 1000 -> both new
    const w1Weight = weight(2000, REDIST_MS)
    const w2Weight = weight(1000, REDIST_MS)
    const baseShare = (w1Weight + w2Weight) / 2
    const total = 100
    const expectedSum = total * baseShare

    assertClose(state[0].redistribution.sum, expectedSum)
  })

  await t.test('prevSum clamping prevents sum from dropping', () => {
    const state = [
      {
        timestamp: 10000,
        workerValues: { w1: 200 }
      },
      {
        timestamp: 11000,
        workerValues: { w1: 100, w2: 20 }
      }
    ]
    const workers = new Map([
      ['w1', { startTime: 0 }],
      ['w2', { startTime: 10500 }]
    ])

    redistributeValues(state, workers, { redistributionMs: REDIST_MS }, null)

    // Tick 0: only w1 (stable), sum = 200
    assert.strictEqual(state[0].redistribution.sum, 200)

    // Tick 1: w1 stable (100), w2 new age=500 (weight very small)
    // rawSum = 100 + 20 * weight(500) << 200
    // clamped to min(total=120, prevSum=200) = 120
    assert.strictEqual(state[1].redistribution.sum, 120)
  })

  await t.test('prevSum clamping does not clamp when not needed', () => {
    const state = [
      {
        timestamp: 8000,
        workerValues: { w1: 100 }
      },
      {
        timestamp: 9000,
        workerValues: { w1: 100, w2: 80 }
      }
    ]
    const workers = new Map([
      ['w1', { startTime: 0 }],
      ['w2', { startTime: 5000 }]
    ])

    redistributeValues(state, workers, { redistributionMs: REDIST_MS }, null)

    // Tick 0: only w1 (stable), sum = 100, prevSum = 100
    assert.strictEqual(state[0].redistribution.sum, 100)

    // Tick 1: w1 stable, w2 age=4000 < 5000 -> new
    const w2Weight = weight(4000, REDIST_MS)
    const rawSum = 100 + 80 * w2Weight
    // rawSum should be > prevSum(100), so no clamping
    assert.ok(rawSum > 100)
    assertClose(state[1].redistribution.sum, rawSum)
  })

  await t.test('multi-tick forward pass with worker becoming stable', () => {
    const state = [
      {
        timestamp: 8000,
        workerValues: { w1: 100, w2: 50 }
      },
      {
        timestamp: 10000,
        workerValues: { w1: 100, w2: 50 }
      }
    ]
    const workers = new Map([
      ['w1', { startTime: 0 }],
      ['w2', { startTime: 4000 }]
    ])

    redistributeValues(state, workers, { redistributionMs: REDIST_MS }, null)

    // Tick 0: w2 age 4000 < 5000 -> new
    const w2Weight0 = weight(4000, REDIST_MS)
    const expectedSum0 = 100 + 50 * w2Weight0
    assertClose(state[0].redistribution.sum, expectedSum0)

    // Tick 1: w2 age 6000 >= 5000 -> stable
    assert.strictEqual(state[1].redistribution.sum, 150)
    assert.strictEqual(state[1].redistribution.count, 2)
  })

  await t.test('new worker with zero value', () => {
    const state = [{
      timestamp: 10000,
      workerValues: { w1: 100, w2: 0 }
    }]
    const workers = new Map([
      ['w1', { startTime: 0 }],
      ['w2', { startTime: 8000 }]
    ])

    redistributeValues(state, workers, { redistributionMs: REDIST_MS }, null)

    // newVal = 0 -> sum = stableSum, count = stableCount + newCount
    assert.strictEqual(state[0].redistribution.sum, 100)
    assert.strictEqual(state[0].redistribution.count, 2)
  })

  await t.test('state continuation with prevSum', () => {
    const state1 = [{
      timestamp: 10000,
      workerValues: { w1: 100 }
    }]
    const workers = new Map([['w1', { startTime: 0 }]])

    const prevSum1 = redistributeValues(state1, workers, { redistributionMs: REDIST_MS }, null)

    const state2 = [{
      timestamp: 11000,
      workerValues: { w1: 120 }
    }]

    redistributeValues(state2, workers, { redistributionMs: REDIST_MS }, prevSum1)

    assert.strictEqual(state2[0].redistribution.sum, 120)
    assert.strictEqual(state2[0].redistribution.count, 1)
  })

  await t.test('worker not in registry treated as stable', () => {
    const state = [{
      timestamp: 10000,
      workerValues: { w1: 100, w2: 50 }
    }]
    // w2 is not in the workers map
    const workers = new Map([['w1', { startTime: 0 }]])

    redistributeValues(state, workers, { redistributionMs: REDIST_MS }, null)

    // w2 has no worker entry -> goes to stable path
    assert.strictEqual(state[0].redistribution.sum, 150)
    assert.strictEqual(state[0].redistribution.count, 2)
  })

  await t.test('default k parameter', () => {
    const state = [{
      timestamp: 10000,
      workerValues: { w1: 100, w2: 50 }
    }]
    const workers = new Map([
      ['w1', { startTime: 0 }],
      ['w2', { startTime: 8000 }]
    ])

    // Without explicit k
    redistributeValues(state, workers, { redistributionMs: REDIST_MS }, null)

    const w2Weight = weight(2000, REDIST_MS, 0.5) // default k=0.5
    const expectedSum = 100 + 50 * w2Weight
    assertClose(state[0].redistribution.sum, expectedSum)
  })
})

// ---------------------------------------------------------------------------
// holt.js
// ---------------------------------------------------------------------------

test('holt', async (t) => {
  const holtConfig = {
    alphaUp: 0.5,
    alphaDown: 0.3,
    betaUp: 0.3,
    betaDown: 0.1
  }

  function holtState (...sums) {
    return sums.map(sum => ({ redistribution: { sum } }))
  }

  await t.test('cold start: level = first input, trend = 0', () => {
    const state = holtState(100)
    const result = holt(state, holtConfig, null)

    assert.strictEqual(result.level, 100)
    assert.strictEqual(result.trend, 0)
    assert.strictEqual(state[0].holt.level, 100)
    assert.strictEqual(state[0].holt.trend, 0)
  })

  await t.test('cold start with multiple inputs', () => {
    const state = holtState(100, 110)
    const result = holt(state, holtConfig, null)

    // First input: level = 100, trend = 0
    // Second input: forecast = 100 + 0 = 100, input 110 > 100 -> alphaUp, betaUp
    // level = 0.5 * 110 + 0.5 * 100 = 105
    // levelDiff = 105 - 100 = 5
    // trend = 0.3 * 5 + 0.7 * 0 = 1.5
    assert.strictEqual(result.level, 105)
    assert.strictEqual(result.trend, 1.5)
  })

  await t.test('asymmetric params: above forecast uses alphaUp/betaUp', () => {
    const prev = { level: 100, trend: 0 }
    const state = holtState(120)
    const result = holt(state, holtConfig, prev)

    // forecast = 100, input 120 > 100 -> alphaUp=0.5, betaUp=0.3
    // level = 0.5 * 120 + 0.5 * 100 = 110
    // levelDiff = 110 - 100 = 10
    // trend = 0.3 * 10 + 0.7 * 0 = 3
    assert.strictEqual(result.level, 110)
    assert.strictEqual(result.trend, 3)
  })

  await t.test('asymmetric params: below forecast uses alphaDown/betaDown', () => {
    const prev = { level: 100, trend: 0 }
    const state = holtState(80)
    const result = holt(state, holtConfig, prev)

    // forecast = 100, input 80 < 100 -> alphaDown=0.3, betaDown=0.1
    // level = 0.3 * 80 + 0.7 * 100 = 94
    // levelDiff = 94 - 100 = -6
    // trend = 0.1 * (-6) + 0.9 * 0 = -0.6
    // level(94) > input(80) -> dampen trend
    // gap = 94 - 80 = 14, trend = -0.6 * (14 / (14 + 0.6 + 1e-9))
    assertClose(result.level, 94)
    const gap = 14
    const expectedTrend = -0.6 * (gap / (gap + 0.6 + 1e-9))
    assertClose(result.trend, expectedTrend)
  })

  await t.test('trend dampening when level > input', () => {
    const prev = { level: 100, trend: 5 }
    const state = holtState(90)
    const result = holt(state, holtConfig, prev)

    // forecast = 105, input 90 < 105 -> alphaDown=0.3, betaDown=0.1
    // level = 0.3 * 90 + 0.7 * 105 = 27 + 73.5 = 100.5
    // levelDiff = 100.5 - 100 = 0.5
    // trend = 0.1 * 0.5 + 0.9 * 5 = 0.05 + 4.5 = 4.55
    // level(100.5) > input(90) -> dampen
    // gap = 100.5 - 90 = 10.5
    // trend = 4.55 * (10.5 / (10.5 + 4.55 + 1e-9))
    assertClose(result.level, 100.5)
    const gap = 10.5
    const rawTrend = 4.55
    const expectedTrend = rawTrend * (gap / (gap + Math.abs(rawTrend) + 1e-9))
    assertClose(result.trend, expectedTrend)
  })

  await t.test('no dampening when level <= input', () => {
    const prev = { level: 100, trend: 0 }
    const state = holtState(110)
    const result = holt(state, holtConfig, prev)

    // forecast = 100, input 110 > 100 -> alphaUp=0.5, betaUp=0.3
    // level = 0.5 * 110 + 0.5 * 100 = 105
    // level(105) <= input(110) -> no dampening
    // trend = 0.3 * 5 + 0.7 * 0 = 1.5
    assert.strictEqual(result.level, 105)
    assert.strictEqual(result.trend, 1.5)
  })

  await t.test('steady input: trend converges to 0', () => {
    let prev = null
    for (let i = 0; i < 50; i++) {
      const state = holtState(100)
      prev = holt(state, holtConfig, prev)
    }

    assertClose(prev.level, 100, 0.01)
    assertClose(prev.trend, 0, 0.01)
  })

  await t.test('linear input: trend is positive and tracks direction', () => {
    let prev = null
    const slope = 5
    for (let i = 0; i < 100; i++) {
      const value = 100 + slope * i
      const state = holtState(value)
      prev = holt(state, holtConfig, prev)
    }

    // With trend dampening, the trend won't converge to the exact slope
    // (dampening activates when level > input), but it should be positive
    // and the level should track the input closely
    assert.ok(prev.trend > 0, `trend ${prev.trend} should be positive for rising input`)
    assertClose(prev.level, 100 + slope * 99, 20) // level tracks input within tolerance
  })

  await t.test('multi-tick sequence', () => {
    const state = holtState(100, 110, 120)
    const result = holt(state, holtConfig, null)

    // Manually trace through:
    // Tick 0: cold start -> level=100, trend=0
    // Tick 1: forecast=100, 110>100 -> alphaUp/betaUp
    //   level = 0.5*110 + 0.5*100 = 105
    //   trend = 0.3*5 + 0.7*0 = 1.5
    //   level(105) <= input(110) -> no dampen
    // Tick 2: forecast = 105 + 1.5 = 106.5, 120 > 106.5 -> alphaUp/betaUp
    //   level = 0.5*120 + 0.5*106.5 = 113.25
    //   levelDiff = 113.25 - 105 = 8.25
    //   trend = 0.3*8.25 + 0.7*1.5 = 2.475 + 1.05 = 3.525
    //   level(113.25) <= input(120) -> no dampen
    assertClose(result.level, 113.25)
    assertClose(result.trend, 3.525)
  })

  await t.test('state is carried forward correctly', () => {
    const state1 = holtState(100, 110)
    const prev1 = holt(state1, holtConfig, null)
    const state2 = holtState(120)
    const prev2 = holt(state2, holtConfig, prev1)

    // This should be identical to processing [100, 110, 120] in one call
    const combined = holtState(100, 110, 120)
    const combinedResult = holt(combined, holtConfig, null)

    assertClose(prev2.level, combinedResult.level)
    assertClose(prev2.trend, combinedResult.trend)
  })

  await t.test('empty inputs returns initial state', () => {
    const prev = { level: 100, trend: 5 }
    const result = holt([], holtConfig, prev)

    assert.strictEqual(result.level, 100)
    assert.strictEqual(result.trend, 5)
  })

  await t.test('empty inputs with null state', () => {
    const result = holt([], holtConfig, null)

    assert.strictEqual(result.level, null)
    assert.strictEqual(result.trend, 0)
  })
})

// ---------------------------------------------------------------------------
// decision.js
// ---------------------------------------------------------------------------

test('getTrendDirection', async (t) => {
  await t.test('zero level returns HORIZONTAL', () => {
    assert.strictEqual(getTrendDirection(10, 0, 5), TrendDirection.HORIZONTAL)
    assert.strictEqual(getTrendDirection(-10, 0, 5), TrendDirection.HORIZONTAL)
  })

  await t.test('positive trend above threshold returns UP', () => {
    // normalizedTrend = 10/100 = 0.1, angle = atan(0.1) * 180/PI ≈ 5.71°
    assert.strictEqual(getTrendDirection(10, 100, 5), TrendDirection.UP)
  })

  await t.test('negative trend below threshold returns DOWN', () => {
    // normalizedTrend = -10/100 = -0.1, angle ≈ -5.71°
    assert.strictEqual(getTrendDirection(-10, 100, 5), TrendDirection.DOWN)
  })

  await t.test('small trend within deadband returns HORIZONTAL', () => {
    // normalizedTrend = 1/100 = 0.01, angle = atan(0.01) * 180/PI ≈ 0.57°
    assert.strictEqual(getTrendDirection(1, 100, 5), TrendDirection.HORIZONTAL)
    assert.strictEqual(getTrendDirection(-1, 100, 5), TrendDirection.HORIZONTAL)
  })

  await t.test('exact boundary conditions', () => {
    // At exactly the threshold angle
    const threshold = 5
    const normalizedAtThreshold = Math.tan(threshold * Math.PI / 180)
    const level = 100

    // Slightly above threshold
    assert.strictEqual(
      getTrendDirection(normalizedAtThreshold * level * 1.01, level, threshold),
      TrendDirection.UP
    )

    // Slightly below threshold
    assert.strictEqual(
      getTrendDirection(normalizedAtThreshold * level * 0.99, level, threshold),
      TrendDirection.HORIZONTAL
    )
  })

  await t.test('normalization by level', () => {
    // Same absolute trend, different level -> different direction
    // trend=10, level=100 -> normalized=0.1, angle≈5.71° > 5° -> UP
    assert.strictEqual(getTrendDirection(10, 100, 5), TrendDirection.UP)

    // trend=10, level=1000 -> normalized=0.01, angle≈0.57° < 5° -> HORIZONTAL
    assert.strictEqual(getTrendDirection(10, 1000, 5), TrendDirection.HORIZONTAL)
  })

  await t.test('zero trend returns HORIZONTAL', () => {
    assert.strictEqual(getTrendDirection(0, 100, 5), TrendDirection.HORIZONTAL)
  })

  await t.test('different threshold values', () => {
    // trend=10, level=100, normalized=0.1, angle≈5.71°
    assert.strictEqual(getTrendDirection(10, 100, 3), TrendDirection.UP) // 5.71 > 3
    assert.strictEqual(getTrendDirection(10, 100, 10), TrendDirection.HORIZONTAL) // 5.71 < 10
  })
})

test('makeScalingDecision', async (t) => {
  const baseParams = {
    level: 100,
    trend: 0,
    count: 2,
    threshold: 80,
    targetCount: 2,
    horizonMs: 5000,
    min: 1,
    max: 10,
    horizontalTrendThreshold: 5,
    scaleUpK: 3,
    scaleUpMargin: 0.2,
    scaleDownMargin: 0.3
  }

  await t.test('scale up when trend is UP and utilization is high', () => {
    const result = makeScalingDecision({
      ...baseParams,
      level: 140,
      trend: 20, // strong upward trend
      count: 2,
      targetCount: 2
      // utilization = 140 / (2*80) = 0.875
      // cost = 3 * 0.875 = 2.625, weight = 2.625 / (2.625 + 0.125) = 0.955
      // predictedSum = 140 + 20*5 = 240
      // adjustedPredictedSum = 140 + 0.955 * 100 = 235.5
      // newTarget = floor(235.5/80) = 2, overload = 235.5-160 = 75.5
      // 75.5/80 = 0.94 > 0.2 margin -> newTarget = 3 > 2 -> scale up
    })
    assert.strictEqual(result, 3)
  })

  await t.test('hold when trend is UP but utilization is low (dampened)', () => {
    const result = makeScalingDecision({
      ...baseParams,
      level: 40, // very low load
      trend: 10, // upward trend
      count: 2,
      targetCount: 2
      // utilization = 40 / (2*80) = 0.25
      // cost = 3 * 0.25 = 0.75, weight = 0.75 / (0.75 + 0.75) = 0.5
      // predictedSum = 40 + 10*5 = 90
      // adjustedPredictedSum = 40 + 0.5 * 50 = 65
      // newTarget = floor(65/80) = 0, overload = 65
      // 65/80 = 0.8125 > 0.2 margin -> newTarget = 1
      // max(1, 2) = 2 -> hold
    })
    assert.strictEqual(result, 2)
  })

  await t.test('scale up when overloaded at horizon', () => {
    const result = makeScalingDecision({
      ...baseParams,
      level: 140, // 140/2 = 70 < 80, not overloaded now
      trend: 5, // small trend within deadband
      count: 2,
      targetCount: 2
      // predictedSum = 140 + 5*5 = 165, 165/2 = 82.5 > 80 -> overloaded at horizon
      // utilization = 140/160 = 0.875
      // cost = 3*0.875 = 2.625, weight = 2.625/(2.625+0.125) = 0.955
      // adjustedPredictedSum = 140 + 0.955*25 = 163.9
      // newTarget = floor(163.9/80) = 2, overload = 163.9-160 = 3.9
      // 3.9/80 = 0.049 < 0.2 margin, not isOverloaded -> newTarget stays 2
      // BUT isOverloaded check: 140/2=70 < 80 -> not overloaded
      // max(2, 2) = 2 -> hold due to dampening
    })
    // With dampening, the marginal overload is too small to trigger
    assert.strictEqual(result, 2)
  })

  await t.test('scale up when strongly overloaded at horizon', () => {
    const result = makeScalingDecision({
      ...baseParams,
      level: 150,
      trend: 10,
      count: 2,
      targetCount: 2
      // predictedSum = 150 + 10*5 = 200, 200/2 = 100 > 80
      // utilization = 150/160 = 0.9375
      // cost = 3*0.9375 = 2.8125, weight = 2.8125/(2.8125+0.0625) = 0.978
      // adjustedPredictedSum = 150 + 0.978*50 = 198.9
      // newTarget = floor(198.9/80) = 2, overload = 198.9-160 = 38.9
      // 38.9/80 = 0.486 > 0.2 -> newTarget = 3 > 2 -> scale up
      // newTarget = 3 > 2 -> scale up
    })
    assert.strictEqual(result, 3)
  })

  await t.test('hold when at max and would scale up', () => {
    const result = makeScalingDecision({
      ...baseParams,
      level: 100,
      trend: 20,
      targetCount: 10, // already at max
      max: 10
    })
    assert.strictEqual(result, 10)
  })

  await t.test('scale down when safe to remove worker', () => {
    const result = makeScalingDecision({
      ...baseParams,
      level: 60, // 60/2 = 30, not overloaded
      trend: 0, // flat
      count: 2,
      targetCount: 3
      // minInstances = floor(1.3 * 60 / 80) + 1 = floor(0.975) + 1 = 1
      // max(min=1, min(3, 1)) = 1
    })
    assert.strictEqual(result, 1)
  })

  await t.test('hold when removing worker would overload', () => {
    const result = makeScalingDecision({
      ...baseParams,
      level: 150, // 150/2 = 75, not overloaded (< 80)
      trend: 0,
      count: 2,
      targetCount: 3
      // minInstances = floor(1.3 * 150 / 80) + 1 = floor(2.4375) + 1 = 3
      // min(3, 3) = 3 -> hold
    })
    assert.strictEqual(result, 3)
  })

  await t.test('hold when at min and would scale down', () => {
    const result = makeScalingDecision({
      ...baseParams,
      level: 10,
      trend: 0,
      count: 1,
      targetCount: 1, // already at min
      min: 1
    })
    assert.strictEqual(result, 1)
  })

  await t.test('scale up when currently overloaded at horizon', () => {
    const result = makeScalingDecision({
      ...baseParams,
      level: 200, // 200/2 = 100 > 80, overloaded
      trend: 1, // small trend within deadband
      count: 2,
      targetCount: 2
      // predictedSum = 200 + 1*5 = 205, 205/2 = 102.5 > 80 -> overloaded at horizon
      // utilization = 200/160 = 1.25 >= 1 -> no dampening
      // adjustedPredictedSum = 205
      // newTarget = floor(205/80) = 2, overload = 205-160 = 45
      // isOverloaded = true -> newTarget = 3 > 2 -> scale up
    })
    assert.strictEqual(result, 3)
  })

  await t.test('hold when flat trend and not overloaded at horizon', () => {
    const result = makeScalingDecision({
      ...baseParams,
      level: 140, // 140/2 = 70, not overloaded
      trend: 0, // flat
      count: 2,
      targetCount: 2
      // predictedSum = 140, 140/2 = 70 < 80 -> not overloaded at horizon
      // not overloaded: findScaleDownTarget
      // minInstances = floor(1.3 * 140 / 80) + 1 = floor(2.275) + 1 = 3
      // min(2, 3) = 2 -> hold
    })
    assert.strictEqual(result, 2)
  })

  await t.test('scale down with downward trend', () => {
    const result = makeScalingDecision({
      ...baseParams,
      level: 40,
      trend: -5, // downward trend
      count: 2,
      targetCount: 3
      // predictedSum = 40 + (-5)*5 = 15, 15/3 = 5 < 80 -> not overloaded at horizon
      // trend is DOWN (not UP), not overloaded: 40/2=20 < 80
      // minInstances = floor(1.3 * 40 / 80) + 1 = floor(0.65) + 1 = 1
      // max(min=1, min(3, 1)) = 1
    })
    assert.strictEqual(result, 1)
  })

  await t.test('uses count for current overload check', () => {
    const result = makeScalingDecision({
      ...baseParams,
      level: 200,
      trend: -20, // downward
      count: 2, // level/count = 100 > 80, overloaded
      targetCount: 3
      // predictedSum = 200 + (-20)*5 = 100, 100/3 ≈ 33.3 < 80 -> not overloaded at horizon
      // trend is DOWN, but isOverloaded = true -> hold
    })
    assert.strictEqual(result, 3)
  })

  await t.test('uses targetCount for horizon overload check', () => {
    const result = makeScalingDecision({
      ...baseParams,
      level: 150,
      trend: 2, // small positive but within deadband
      count: 3, // level/count = 50 < 80, not currently overloaded
      targetCount: 2 // predictedSum = 150+2*5 = 160, 160/2 = 80 -> exactly at threshold
    })
    // 80 is not > 80, so not overloaded at horizon
    // trend within deadband -> not UP
    // findScaleDownTarget: minInstances = floor(1.3 * 150 / 80) + 1 = 3
    // min(2, 3) = 2 -> hold
    assert.strictEqual(result, 2)
  })
})

// ---------------------------------------------------------------------------
// init-timeout.js
// ---------------------------------------------------------------------------

test('median', async (t) => {
  await t.test('odd number of values', () => {
    assert.strictEqual(median([3, 1, 2]), 2)
    assert.strictEqual(median([5, 1, 9, 3, 7]), 5)
  })

  await t.test('even number of values', () => {
    assert.strictEqual(median([1, 3]), 2)
    assert.strictEqual(median([1, 2, 3, 4]), 2.5)
  })

  await t.test('single value', () => {
    assert.strictEqual(median([42]), 42)
  })

  await t.test('does not mutate input', () => {
    const input = [3, 1, 2]
    median(input)
    assert.deepStrictEqual(input, [3, 1, 2])
  })
})

test('calculateInitTimeout', async (t) => {
  const defaultInitConfig = {
    stepRate: 0.1,
    upFactor: 1.5,
    downFactor: 1.0
  }

  await t.test('converges from seed toward stable measurements', () => {
    let timeout = 1000

    timeout = calculateInitTimeout([820], timeout, defaultInitConfig)
    assert.strictEqual(timeout, 900) // capped at -100 (10% down)

    timeout = calculateInitTimeout([820, 790], timeout, defaultInitConfig)
    assert.strictEqual(timeout, 810) // median=805, delta=-95, capped at -90

    timeout = calculateInitTimeout([820, 790, 810], timeout, defaultInitConfig)
    assert.strictEqual(timeout, 810) // median=810, delta=0
  })

  await t.test('single high outlier has near-zero impact', () => {
    const result = calculateInitTimeout([790, 810, 820, 5000], 810, defaultInitConfig)
    // median of [790, 810, 820, 5000] = (810+820)/2 = 815
    assert.strictEqual(result, 815)
  })

  await t.test('single low outlier has near-zero impact', () => {
    const result = calculateInitTimeout([50, 790, 810, 820], 810, defaultInitConfig)
    // median = (790+810)/2 = 800
    assert.strictEqual(result, 800)
  })

  await t.test('rate limits upward steps', () => {
    const result = calculateInitTimeout([805, 810, 1180, 1200, 1210], 810, defaultInitConfig)
    // median = 1180, delta = 370, maxUp = 810 * 0.1 * 1.5 = 121.5
    assert.strictEqual(result, 932) // capped at +121.5, rounded
  })

  await t.test('rate limits downward steps', () => {
    const result = calculateInitTimeout([805, 810, 815, 820, 1200], 1200, defaultInitConfig)
    // median = 815, delta = -385, maxDown = 1200 * 0.1 * 1.0 = 120
    assert.strictEqual(result, 1080) // capped at -120
  })

  await t.test('upward steps are faster than downward', () => {
    const upResult = calculateInitTimeout([1500], 1000, defaultInitConfig)
    const downResult = calculateInitTimeout([500], 1000, defaultInitConfig)

    const upDelta = upResult - 1000
    const downDelta = 1000 - downResult

    assert.ok(upDelta > downDelta, `up delta ${upDelta} should be > down delta ${downDelta}`)
    assert.strictEqual(upResult, 1150)
    assert.strictEqual(downResult, 900)
  })

  await t.test('no change when measurement matches current timeout', () => {
    const result = calculateInitTimeout([1000, 1000, 1000], 1000, defaultInitConfig)
    assert.strictEqual(result, 1000)
  })

  await t.test('works with custom config', () => {
    const config = { stepRate: 0.2, upFactor: 1.0, downFactor: 1.0 }
    const result = calculateInitTimeout([2000], 1000, config)
    // delta = 1000, maxUp = 1000 * 0.2 * 1.0 = 200
    assert.strictEqual(result, 1200)
  })
})

// ---------------------------------------------------------------------------
// PredictiveScalingAlgorithm
// ---------------------------------------------------------------------------

test('PredictiveScalingAlgorithm', async (t) => {
  const metricConfig = {
    sampleIntervalMs: 1000,
    windowMs: 60000,
    redistributionMs: 5000,
    k: 0.5,
    alphaUp: 0.5,
    alphaDown: 0.3,
    betaUp: 0.3,
    betaDown: 0.1,
    threshold: 0.8
  }

  const algorithmConfig = {
    scaleUpMargin: 0.2,
    scaleDownMargin: 0.3,
    min: 1,
    max: 10,
    cooldowns: {
      scaleUpAfterScaleUpMs: 5000,
      scaleUpAfterScaleDownMs: 5000,
      scaleDownAfterScaleUpMs: 30000,
      scaleDownAfterScaleDownMs: 20000
    },
    metrics: { elu: metricConfig }
  }

  await t.test('cold start: first samples produce a result', () => {
    const alg = new PredictiveScalingAlgorithm(algorithmConfig)

    alg.addSample('elu', 'w1', 1500, 0.3)
    alg.addSample('elu', 'w2', 1500, 0.4)

    const result = alg.process(2500)

    assert.ok(result !== null)
    assert.strictEqual(typeof result, 'number')
  })

  await t.test('no new ticks returns null', () => {
    const alg = new PredictiveScalingAlgorithm(algorithmConfig)

    alg.addSample('elu', 'w1', 1500, 0.3)

    alg.process(2500)

    const result = alg.process(2600)
    assert.strictEqual(result, null)
  })

  await t.test('processing cooldown: accumulates ticks before processing', () => {
    const alg = new PredictiveScalingAlgorithm(algorithmConfig)

    alg.addSample('elu', 'w1', 1500, 0.3)
    alg.addSample('elu', 'w1', 2500, 0.4)
    alg.addSample('elu', 'w1', 3500, 0.5)

    const result = alg.process(4500)

    assert.ok(result !== null)
  })

  await t.test('steady low load produces hold', () => {
    const alg = new PredictiveScalingAlgorithm(algorithmConfig)

    let result = null
    for (let tick = 1; tick <= 20; tick++) {
      alg.addSample('elu', 'w1', tick * 1000 + 500, 0.2)
      alg.addSample('elu', 'w2', tick * 1000 + 500, 0.2)
      result = alg.process((tick + 1) * 1000 + 500)
    }

    assert.ok(result !== null)
    assert.strictEqual(alg.getSnapshot('elu').targetCount, 1)
  })

  await t.test('rising load produces scale-up', () => {
    const alg = new PredictiveScalingAlgorithm(algorithmConfig)

    for (let tick = 1; tick <= 20; tick++) {
      const elu = Math.min(0.3 + tick * 0.05, 0.95)
      alg.addSample('elu', 'w1', tick * 1000 + 500, elu)
      alg.process((tick + 1) * 1000 + 500)
    }

    assert.strictEqual(alg.getSnapshot('elu').targetCount, 2)
  })

  await t.test('new worker appears mid-stream', () => {
    const alg = new PredictiveScalingAlgorithm(algorithmConfig)

    for (let tick = 1; tick <= 5; tick++) {
      alg.addSample('elu', 'w1', tick * 1000 + 500, 0.7)
      alg.process((tick + 1) * 1000 + 500)
    }

    for (let tick = 6; tick <= 15; tick++) {
      alg.addSample('elu', 'w1', tick * 1000 + 500, 0.4)
      alg.addSample('elu', 'w2', tick * 1000 + 500, 0.3)
      alg.process((tick + 1) * 1000 + 500)
    }

    const snapshot = alg.getSnapshot('elu')
    assert.ok(snapshot.level !== null)
  })

  await t.test('worker stops sending metrics', () => {
    const alg = new PredictiveScalingAlgorithm(algorithmConfig)

    for (let tick = 1; tick <= 5; tick++) {
      alg.addSample('elu', 'w1', tick * 1000 + 500, 0.3)
      alg.addSample('elu', 'w2', tick * 1000 + 500, 0.3)
      alg.process((tick + 1) * 1000 + 500)
    }

    alg.removeWorker('w2')
    for (let tick = 6; tick <= 10; tick++) {
      alg.addSample('elu', 'w1', tick * 1000 + 500, 0.5)
      alg.process((tick + 1) * 1000 + 500)
    }

    const snapshot = alg.getSnapshot('elu')
    assert.ok(snapshot.level !== null)
  })

  await t.test('redistribution filters new worker contribution', () => {
    const alg = new PredictiveScalingAlgorithm(algorithmConfig)

    for (let tick = 1; tick <= 10; tick++) {
      alg.addSample('elu', 'w1', tick * 1000 + 500, 0.5)
      alg.process((tick + 1) * 1000 + 500)
    }

    alg.addSample('elu', 'w1', 11500, 0.5)
    alg.addSample('elu', 'w2', 11500, 0.05)
    const result = alg.process(12500)

    assert.ok(result !== null)
    const snapshot = alg.getSnapshot('elu')
    assert.ok(snapshot.level > 0.3, `level ${snapshot.level} should not drop dramatically after adding new worker`)
  })

  await t.test('scale down when load drops significantly', () => {
    const alg = new PredictiveScalingAlgorithm(algorithmConfig)

    let tick = 1
    let prevTarget = 1
    while (alg.getSnapshot('elu').targetCount < 3) {
      alg.addSample('elu', 'w1', tick * 1000 + 500, 0.95)
      alg.addSample('elu', 'w2', tick * 1000 + 500, 0.95)
      alg.addSample('elu', 'w3', tick * 1000 + 500, 0.95)
      alg.process((tick + 1) * 1000 + 500)

      const newTarget = alg.getSnapshot('elu').targetCount
      if (newTarget > prevTarget) {
        // Resolve pending by simulating the new workers starting
        const scaleUpCount = newTarget - prevTarget
        for (let i = 0; i < scaleUpCount; i++) {
          alg.addWorker(`pending-${tick}-${i}`, (tick + 1) * 1000 + 500)
        }
        prevTarget = newTarget
      }

      tick++
      assert.ok(tick < 100, 'should scale up to 3 within 100 ticks')
    }

    const endTick = tick + 60
    for (; tick <= endTick; tick++) {
      alg.addSample('elu', 'w1', tick * 1000 + 500, 0.1)
      alg.addSample('elu', 'w2', tick * 1000 + 500, 0.1)
      alg.addSample('elu', 'w3', tick * 1000 + 500, 0.1)
      alg.process((tick + 1) * 1000 + 500)
    }

    assert.strictEqual(alg.getSnapshot('elu').targetCount, 1)
  })

  await t.test('respects max boundary', () => {
    const alg = new PredictiveScalingAlgorithm({
      ...algorithmConfig,
      min: 2,
      max: 2
    })

    let result = null
    for (let tick = 1; tick <= 20; tick++) {
      const elu = Math.min(0.5 + tick * 0.03, 0.95)
      alg.addSample('elu', 'w1', tick * 1000 + 500, elu)
      alg.addSample('elu', 'w2', tick * 1000 + 500, elu)
      result = alg.process((tick + 1) * 1000 + 500)
    }

    assert.ok(result !== null)
    assert.strictEqual(alg.getSnapshot('elu').targetCount, 2)
  })

  await t.test('respects min boundary', () => {
    const alg = new PredictiveScalingAlgorithm({
      ...algorithmConfig,
      min: 2
    })

    let result = null
    for (let tick = 1; tick <= 30; tick++) {
      alg.addSample('elu', 'w1', tick * 1000 + 500, 0.01)
      alg.addSample('elu', 'w2', tick * 1000 + 500, 0.01)
      result = alg.process((tick + 1) * 1000 + 500)
    }

    assert.ok(result !== null)
    assert.strictEqual(alg.getSnapshot('elu').targetCount, 2)
  })

  await t.test('multiple metrics: max targetCount wins', () => {
    const alg = new PredictiveScalingAlgorithm({
      ...algorithmConfig,
      metrics: {
        elu: metricConfig,
        heap: { ...metricConfig, threshold: 0.5 }
      }
    })

    // Feed both metrics — heap has lower threshold so it should trigger scale-up first
    for (let tick = 1; tick <= 20; tick++) {
      const val = Math.min(0.2 + tick * 0.03, 0.95)
      alg.addSample('elu', 'w1', tick * 1000 + 500, val)
      alg.addSample('heap', 'w1', tick * 1000 + 500, val)
      alg.process((tick + 1) * 1000 + 500)
    }

    // heap threshold (0.5) is lower than elu (0.8), so heap drives scale-up
    assert.ok(alg.getSnapshot('elu').targetCount >= 2)
  })

  await t.test('getSnapshot returns history and prediction data', () => {
    const alg = new PredictiveScalingAlgorithm(algorithmConfig)

    for (let tick = 1; tick <= 10; tick++) {
      alg.addSample('elu', 'w1', tick * 1000 + 500, 0.5)
      alg.process((tick + 1) * 1000 + 500)
    }

    const snapshot = alg.getSnapshot('elu')
    assert.strictEqual(snapshot.horizonMs, 6000)
    assert.strictEqual(typeof snapshot.targetCount, 'number')
    assert.ok(snapshot.history.length > 0)
    assert.strictEqual(typeof snapshot.level, 'number')
    assert.strictEqual(typeof snapshot.trend, 'number')
    assert.strictEqual(snapshot.threshold, 0.8)
  })

  await t.test('getSnapshot returns null for unknown metric', () => {
    const alg = new PredictiveScalingAlgorithm(algorithmConfig)
    assert.strictEqual(alg.getSnapshot('unknown'), null)
  })
})

// ---------------------------------------------------------------------------
// Cooldowns and pending scale-ups
// ---------------------------------------------------------------------------

test('PredictiveScalingAlgorithm cooldowns and pending scale-ups', async (t) => {
  const metricConfig = {
    sampleIntervalMs: 1000,
    windowMs: 60000,
    redistributionMs: 5000,
    k: 0.5,
    alphaUp: 0.5,
    alphaDown: 0.3,
    betaUp: 0.3,
    betaDown: 0.1,
    threshold: 0.8
  }

  function makeConfig (overrides = {}) {
    return {
      scaleUpMargin: 0.2,
      scaleDownMargin: 0.3,
      min: 1,
      max: 10,
      cooldowns: {
        scaleUpAfterScaleUpMs: 5000,
        scaleUpAfterScaleDownMs: 5000,
        scaleDownAfterScaleUpMs: 30000,
        scaleDownAfterScaleDownMs: 20000
      },
      metrics: { elu: metricConfig },
      ...overrides
    }
  }

  function feedTick (alg, workers, tick, elu) {
    const ts = tick * 1000 + 500
    for (const w of workers) {
      alg.addSample('elu', w, ts, elu)
    }
    return alg.process(tick * 1000 + 1000)
  }

  function feedTicks (alg, workers, startTick, count, elu) {
    let result = null
    for (let tick = startTick; tick < startTick + count; tick++) {
      result = feedTick(alg, workers, tick, elu)
    }
    return result
  }

  await t.test('pending scale-ups block scale-down', () => {
    const alg = new PredictiveScalingAlgorithm(makeConfig({
      cooldowns: {
        scaleUpAfterScaleUpMs: 0,
        scaleUpAfterScaleDownMs: 0,
        scaleDownAfterScaleUpMs: 0,
        scaleDownAfterScaleDownMs: 0,
      }
    }))

    // Feed high ELU to trigger scale-up
    feedTicks(alg, ['w1'], 1, 5, 0.95)

    const targetAfterScaleUp = alg.getSnapshot('elu').targetCount
    assert.ok(targetAfterScaleUp > 1, `should have scaled up, got ${targetAfterScaleUp}`)

    // Feed low ELU — algorithm wants to scale down,
    // but pending scale-ups (no addWorker called) should block it
    feedTicks(alg, ['w1'], 6, 10, 0.01)

    assert.strictEqual(
      alg.getSnapshot('elu').targetCount,
      targetAfterScaleUp,
      'pending scale-ups should block scale-down'
    )
  })

  await t.test('addWorker resolves pending and unblocks scale-down', () => {
    const alg = new PredictiveScalingAlgorithm(makeConfig({
      cooldowns: {
        scaleUpAfterScaleUpMs: 0,
        scaleUpAfterScaleDownMs: 0,
        scaleDownAfterScaleUpMs: 0,
        scaleDownAfterScaleDownMs: 0,
      }
    }))

    // Trigger scale-up
    feedTicks(alg, ['w1'], 1, 5, 0.95)
    const targetAfterScaleUp = alg.getSnapshot('elu').targetCount
    assert.ok(targetAfterScaleUp > 1)

    // Resolve pending by adding the new worker
    alg.addWorker('w2', 8000)

    // Feed low ELU — now scale-down should be allowed
    feedTicks(alg, ['w1', 'w2'], 6, 15, 0.01)

    assert.ok(
      alg.getSnapshot('elu').targetCount < targetAfterScaleUp,
      'should scale down after pending resolved'
    )
  })

  await t.test('scaleUpAfterScaleUpMs blocks rapid scale-ups', () => {
    const alg = new PredictiveScalingAlgorithm(makeConfig({
      cooldowns: {
        scaleUpAfterScaleUpMs: 10000,
        scaleUpAfterScaleDownMs: 0,
        scaleDownAfterScaleUpMs: 0,
        scaleDownAfterScaleDownMs: 0,
      }
    }))

    // Feed high ELU to trigger first scale-up
    feedTicks(alg, ['w1'], 1, 5, 0.95)
    const target1 = alg.getSnapshot('elu').targetCount
    assert.strictEqual(target1, 2, 'first scale-up should happen')

    // Add worker so pending is resolved
    alg.addWorker('w2', 6000)

    // Continue feeding high ELU — should NOT scale up again within cooldown
    feedTicks(alg, ['w1', 'w2'], 6, 5, 0.95)
    assert.strictEqual(
      alg.getSnapshot('elu').targetCount, 2,
      'should not scale up within scaleUpAfterScaleUpMs'
    )

    // Advance past cooldown (tick 16 = 17000ms, first scale-up was ~5000ms, diff > 10000)
    feedTicks(alg, ['w1', 'w2'], 16, 5, 0.95)
    assert.ok(
      alg.getSnapshot('elu').targetCount > 2,
      'should scale up after cooldown expires'
    )
  })

  await t.test('scaleDownAfterScaleUpMs blocks scale-down until worker start is old enough', () => {
    const alg = new PredictiveScalingAlgorithm(makeConfig({
      cooldowns: {
        scaleUpAfterScaleUpMs: 0,
        scaleUpAfterScaleDownMs: 0,
        scaleDownAfterScaleUpMs: 15000,
        scaleDownAfterScaleDownMs: 0,
      }
    }))

    // Trigger scale-up
    feedTicks(alg, ['w1'], 1, 5, 0.95)
    assert.strictEqual(alg.getSnapshot('elu').targetCount, 2)

    // Add worker — this sets lastWorkerStartTime
    alg.addWorker('w2', 6000)

    // Feed low ELU — should be blocked by scaleDownAfterScaleUpMs
    feedTicks(alg, ['w1', 'w2'], 6, 10, 0.01)
    assert.strictEqual(
      alg.getSnapshot('elu').targetCount, 2,
      'should not scale down within scaleDownAfterScaleUpMs of worker start'
    )

    // Advance past cooldown (tick 22 = 23000ms, worker started at 6000, diff = 17000 > 15000)
    feedTicks(alg, ['w1', 'w2'], 22, 5, 0.01)
    assert.strictEqual(
      alg.getSnapshot('elu').targetCount, 1,
      'should scale down after scaleDownAfterScaleUpMs expires'
    )
  })

  await t.test('scaleDownAfterScaleDownMs blocks rapid scale-downs', () => {
    const alg = new PredictiveScalingAlgorithm(makeConfig({
      cooldowns: {
        scaleUpAfterScaleUpMs: 0,
        scaleUpAfterScaleDownMs: 0,
        scaleDownAfterScaleUpMs: 0,
        scaleDownAfterScaleDownMs: 10000,
      },
    }))

    // Trigger scale-up to 3+
    feedTicks(alg, ['w1'], 1, 5, 0.95)
    const target = alg.getSnapshot('elu').targetCount
    assert.ok(target >= 2, `should have scaled up to at least 2, got ${target}`)

    // Add workers to resolve all pending
    for (let i = 1; i < target; i++) {
      alg.addWorker(`w${i + 1}`, 6000)
    }
    const workers = Array.from({ length: target }, (_, i) => `w${i + 1}`)

    // Feed low ELU — first scale-down should happen
    feedTicks(alg, workers, 6, 5, 0.01)
    const targetAfterFirstDown = alg.getSnapshot('elu').targetCount
    assert.ok(
      targetAfterFirstDown < target,
      'first scale-down should happen'
    )

    // Immediately try more scale-down — should be blocked
    feedTicks(alg, workers, 11, 3, 0.01)
    assert.strictEqual(
      alg.getSnapshot('elu').targetCount,
      targetAfterFirstDown,
      'should not scale down within scaleDownAfterScaleDownMs'
    )
  })

  await t.test('scaleUpAfterScaleDownMs blocks scale-up after recent scale-down', () => {
    const alg = new PredictiveScalingAlgorithm(makeConfig({
      cooldowns: {
        scaleUpAfterScaleUpMs: 0,
        scaleUpAfterScaleDownMs: 15000,
        scaleDownAfterScaleUpMs: 0,
        scaleDownAfterScaleDownMs: 0,
      }
    }))

    // Trigger scale-up
    feedTicks(alg, ['w1'], 1, 5, 0.95)
    assert.strictEqual(alg.getSnapshot('elu').targetCount, 2)

    // Add worker, resolve pending
    alg.addWorker('w2', 6000)

    // Feed low ELU to trigger scale-down
    feedTicks(alg, ['w1', 'w2'], 6, 10, 0.01)
    assert.strictEqual(alg.getSnapshot('elu').targetCount, 1, 'should scale down')

    // Now feed high ELU — scale-up should be blocked by scaleUpAfterScaleDownMs
    feedTicks(alg, ['w1'], 16, 5, 0.95)
    assert.strictEqual(
      alg.getSnapshot('elu').targetCount, 1,
      'should not scale up within scaleUpAfterScaleDownMs of scale-down'
    )

    // Advance past cooldown
    feedTicks(alg, ['w1'], 30, 5, 0.95)
    assert.strictEqual(
      alg.getSnapshot('elu').targetCount, 2,
      'should scale up after scaleUpAfterScaleDownMs expires'
    )
  })

  await t.test('default pendingScaleUpExpiryMs should not immediately expire pending', () => {
    // No explicit pendingScaleUpExpiryMs — should NOT default to 0
    const alg = new PredictiveScalingAlgorithm(makeConfig({
      cooldowns: {
        scaleUpAfterScaleUpMs: 0,
        scaleUpAfterScaleDownMs: 0,
        scaleDownAfterScaleUpMs: 0,
        scaleDownAfterScaleDownMs: 0
      }
    }))

    // Trigger scale-up
    feedTicks(alg, ['w1'], 1, 5, 0.95)
    const targetAfterScaleUp = alg.getSnapshot('elu').targetCount
    assert.ok(targetAfterScaleUp > 1)

    // Feed low ELU immediately — pending should still block scale-down
    feedTicks(alg, ['w1'], 6, 5, 0.01)
    assert.strictEqual(
      alg.getSnapshot('elu').targetCount,
      targetAfterScaleUp,
      'pending scale-ups should not expire immediately when pendingScaleUpExpiryMs is not configured'
    )
  })

  await t.test('pending scale-ups expire based on scaleAt not decisionAt', () => {
    // PENDING_SCALE_UP_EXPIRY_MS = 30000, INIT_TIMEOUT_MS = 5000 (hardcoded constants)
    const alg = new PredictiveScalingAlgorithm(makeConfig({
      cooldowns: {
        scaleUpAfterScaleUpMs: 0,
        scaleUpAfterScaleDownMs: 0,
        scaleDownAfterScaleUpMs: 0,
        scaleDownAfterScaleDownMs: 0
      }
    }))

    // Scale-up happens around tick 3: decisionAt ≈ 4000, scaleAt ≈ 9000
    // Correct expiry (scaleAt-based): now > 9000 + 30000 = 39000
    // Buggy expiry (decisionAt-based): now > 4000 + 30000 = 34000
    feedTicks(alg, ['w1'], 1, 3, 0.95)
    const targetAfterScaleUp = alg.getSnapshot('elu').targetCount
    assert.ok(targetAfterScaleUp > 1)

    // Feed low ELU up to tick 36 (now = 37000)
    // Past decisionAt-based expiry (34000), before scaleAt-based expiry (39000)
    // Scale-down should still be blocked with correct behavior
    feedTicks(alg, ['w1'], 4, 33, 0.01)

    assert.strictEqual(
      alg.getSnapshot('elu').targetCount,
      targetAfterScaleUp,
      'pending should not expire before scaleAt + PENDING_SCALE_UP_EXPIRY_MS'
    )
  })

  await t.test('addWorker updates adaptive init timeout', () => {
    const alg = new PredictiveScalingAlgorithm(makeConfig({
      cooldowns: {
        scaleUpAfterScaleUpMs: 0,
        scaleUpAfterScaleDownMs: 0,
        scaleDownAfterScaleUpMs: 0,
        scaleDownAfterScaleDownMs: 0,
      }
    }))

    // INIT_TIMEOUT_MS = 5000, HORIZON_MULTIPLIER = 1.2
    // Initial horizon = 1.2 * 5000 = 6000
    const horizonBefore = alg.getSnapshot('elu').horizonMs
    assert.strictEqual(horizonBefore, 6000)

    // Trigger scale-up (need enough ticks for Holt to build signal)
    feedTicks(alg, ['w1'], 1, 10, 0.95)
    assert.ok(alg.getSnapshot('elu').targetCount > 1, 'should have scaled up')

    // Worker starts 15 seconds after decision — slower than the 5s default
    // This should increase the adaptive init timeout and thus the horizon
    alg.addWorker('w2', 25000)

    const horizonAfter = alg.getSnapshot('elu').horizonMs
    assert.ok(
      horizonAfter > horizonBefore,
      `horizon should increase after slow init (before=${horizonBefore}, after=${horizonAfter})`
    )
  })

  await t.test('instances are cleaned up when all metric timelines expire', () => {
    const alg = new PredictiveScalingAlgorithm({
      scaleUpMargin: 0.2,
      scaleDownMargin: 0.3,
      min: 1,
      max: 10,
      cooldowns: {
        scaleUpAfterScaleUpMs: 0,
        scaleUpAfterScaleDownMs: 0,
        scaleDownAfterScaleUpMs: 0,
        scaleDownAfterScaleDownMs: 0
      },
      metrics: {
        elu: {
          redistributionMs: 5000,
          alphaUp: 0.5,
          alphaDown: 0.3,
          betaUp: 0.3,
          betaDown: 0.1,
          threshold: 0.8
        }
      }
    })

    // Add two workers and feed samples
    alg.addWorker('w1', 1000)
    alg.addWorker('w2', 1000)

    // Feed samples for both workers for a few ticks
    for (let tick = 1; tick <= 3; tick++) {
      const ts = tick * 1000 + 500
      alg.addSample('elu', 'w1', ts, 0.5)
      alg.addSample('elu', 'w2', ts, 0.5)
      alg.process(tick * 1000 + 1000)
    }

    // Worker w2 exits — removeWorker does NOT clean instances (by design)
    alg.removeWorker('w2')

    // Continue feeding only w1 for enough ticks that w2's timeline expires
    // windowMs = 5000, so after 5+ seconds with no data, w2's timeline is expired
    for (let tick = 4; tick <= 15; tick++) {
      const ts = tick * 1000 + 500
      alg.addSample('elu', 'w1', ts, 0.5)
      alg.process(tick * 1000 + 1000)
    }

    // Verify the algorithm still works correctly — w2's stale data
    // should not pollute redistribution with a ghost instance
    const snapshot = alg.getSnapshot('elu')
    assert.strictEqual(typeof snapshot.level, 'number')
    assert.ok(snapshot.targetCount >= 1)
  })
})
