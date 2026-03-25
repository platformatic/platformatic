// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const SCALE_UP_K = 2
export const PENDING_SCALE_UP_EXPIRY_MS = 30000
export const SAMPLE_INTERVAL_MS = 1000
export const WINDOW_MS = 60000
export const REDISTRIBUTION_K = 1
export const HORIZONTAL_TREND_THRESHOLD = 10
export const HORIZON_MULTIPLIER = 1.2
export const RECONNECT_TIMEOUT_MS = 5000
export const INIT_TIMEOUT_MS = 5000
export const INIT_TIMEOUT_CONFIG = {
  stepRate: 0.1,
  upFactor: 1.5,
  downFactor: 1.0,
  windowSize: 5
}

// ---------------------------------------------------------------------------
// Algorithm
// ---------------------------------------------------------------------------

/**
 * Per-application predictive scaling algorithm.
 *
 * Handles multiple metrics (e.g. ELU, heap), each with its own independent
 * alignment → redistribution → Holt smoothing pipeline. The final scaling
 * decision takes the max targetCount across all metrics.
 *
 * Workers are shared across metrics (same startTime). Each metric has its
 * own per-worker sliding window, Holt state, redistribution state, and history.
 */
export class PredictiveScalingAlgorithm {
  /** @type {WorkerIdMapper} */
  #workerIdMapper

  /** @type {Map<string, NodeJS.Timeout>} workerId -> reconnect timer */
  #reconnectTimers

  /** @type {Map<string, { startTime: number, [metricName]: MetricStore }>} instanceId -> instance */
  #instances

  /**
   * Per-metric state, keyed by metric name.
   * @type {Map<string, {
   *   holtState: { level: number, trend: number } | null,
   *   prevSum: number | null,
   *   lastProcessedTick: number,
   *   history: SlidingWindow,
   *   config: { sampleIntervalMs: number, windowMs: number, threshold: number,
   *     redistributionConfig: { redistributionMs: number, k: number },
   *     holtConfig: {
   *       alphaUp: number,
   *       alphaDown: number,
   *       betaUp: number,
   *       betaDown: number
   *       maxValue: number,
   *       saturationZone: number
   *     }
   *   }
   * }>}
   */
  #metrics

  /** @type {number} */
  #targetCount

  // Shared config
  #horizonMs
  #scaleUpMargin
  #scaleDownMargin
  #min
  #max
  #cooldowns

  // Cooldown state
  #lastScaleUpTime
  #lastScaleDownTime
  #lastWorkerStartTime
  #pendingScaleUps

  // Adaptive init timeout
  #initTimeoutMs
  #initTimeoutWindow

  /**
   * @param {object} config
   * @param {number} config.scaleUpMargin - fractional overload margin for adding a worker
   * @param {number} config.scaleDownMargin - hysteresis margin for scale-down safety
   * @param {number} config.min - minimum worker count
   * @param {number} config.max - maximum worker count
   * @param {object} config.cooldowns - cooldown timers
   * @param {Object<string, object>} config.metrics - per-metric config keyed by metric name
   */
  constructor (config) {
    this.#scaleUpMargin = config.scaleUpMargin
    this.#scaleDownMargin = config.scaleDownMargin

    this.#min = config.min
    this.#max = config.max
    this.#cooldowns = config.cooldowns
    this.#targetCount = config.min

    this.#lastScaleUpTime = 0
    this.#lastScaleDownTime = 0
    this.#lastWorkerStartTime = 0
    this.#pendingScaleUps = []

    this.#initTimeoutMs = INIT_TIMEOUT_MS
    this.#initTimeoutWindow = []
    this.#horizonMs = HORIZON_MULTIPLIER * this.#initTimeoutMs

    this.#workerIdMapper = new WorkerIdMapper()
    this.#reconnectTimers = new Map()
    this.#instances = new Map()

    this.#metrics = new Map()
    for (const name in config.metrics) {
      const mc = config.metrics[name]
      this.#metrics.set(name, {
        holtState: null,
        prevSum: null,
        lastProcessedTick: 0,
        history: new SlidingWindow(WINDOW_MS),
        config: {
          sampleIntervalMs: SAMPLE_INTERVAL_MS,
          windowMs: WINDOW_MS,
          threshold: mc.threshold,
          redistributionConfig: {
            redistributionMs: mc.redistributionMs,
            k: REDISTRIBUTION_K
          },
          holtConfig: {
            alphaUp: mc.alphaUp,
            alphaDown: mc.alphaDown,
            betaUp: mc.betaUp,
            betaDown: mc.betaDown,
            maxValue: mc.maxValue,
            saturationZone: mc.saturationZone
          }
        }
      })
    }
  }

  addWorker (workerId, startTime) {
    const timer = this.#reconnectTimers.get(workerId)
    if (timer) {
      clearTimeout(timer)
      this.#reconnectTimers.delete(workerId)
    }

    const instanceId = this.#workerIdMapper.add(workerId)
    this.#instances.set(instanceId, { startTime })
    this.#lastWorkerStartTime = startTime
    this.#resolvePendingScaleUp(startTime)
  }

  removeWorker (workerId) {
    const timer = setTimeout(() => {
      this.#workerIdMapper.remove(workerId)
      this.#reconnectTimers.delete(workerId)
    }, RECONNECT_TIMEOUT_MS).unref()
    this.#reconnectTimers.set(workerId, timer)
  }

  addSample (metricName, workerId, timestamp, value) {
    const metric = this.#metrics.get(metricName)
    if (!metric) return

    if (!this.#workerIdMapper.get(workerId)) {
      this.addWorker(workerId, timestamp)
    }

    const instanceId = this.#workerIdMapper.get(workerId)
    const instance = this.#instances.get(instanceId)

    let timeline = instance[metricName]
    if (!timeline) {
      timeline = new MetricStore(
        metric.config.sampleIntervalMs,
        metric.config.windowMs
      )
      instance[metricName] = timeline
    }
    timeline.push(timestamp, value)
  }

  getSnapshot (metricName) {
    const metric = this.#metrics.get(metricName)
    if (!metric) return null

    return {
      targetCount: this.#targetCount,
      horizonMs: this.#horizonMs,
      threshold: metric.config.threshold,
      history: metric.history.getEntries(),
      level: metric.holtState?.level ?? null,
      trend: metric.holtState?.trend ?? 0
    }
  }

  /**
   * Run the pipeline over all unprocessed ticks.
   * Each metric is processed independently; the final targetCount is the max.
   * Cooldowns are enforced after computing the target.
   *
   * @param {number} now - current timestamp
   * @returns {number | null} new targetCount, or null if no metrics had new ticks
   */
  process (now) {
    let maxTargetCount = 0
    let processed = false

    for (const metricName of this.#metrics.keys()) {
      const targetCount = this.#processMetric(metricName, now)
      if (targetCount !== null) {
        processed = true
        maxTargetCount = Math.max(maxTargetCount, targetCount)
      }
    }

    if (!processed) return null

    this.#cleanupExpired(now)

    if (maxTargetCount === this.#targetCount) return this.#targetCount

    if (maxTargetCount > this.#targetCount) {
      this.#checkScaleUp(maxTargetCount, now)
    } else {
      this.#checkScaleDown(maxTargetCount, now)
    }

    return this.#targetCount
  }

  #checkScaleUp (newTargetCount, now) {
    const {
      scaleUpAfterScaleUpMs = 5000,
      scaleUpAfterScaleDownMs = 5000
    } = this.#cooldowns

    if (this.#lastScaleUpTime && now - this.#lastScaleUpTime < scaleUpAfterScaleUpMs) {
      return
    }

    if (this.#lastScaleDownTime && now - this.#lastScaleDownTime < scaleUpAfterScaleDownMs) {
      return
    }

    const scaleUpCount = newTargetCount - this.#targetCount
    const scaleAt = now + this.#initTimeoutMs

    for (let i = 0; i < scaleUpCount; i++) {
      this.#pendingScaleUps.push({ scaleAt, decisionAt: now })
    }

    this.#lastScaleUpTime = now
    this.#targetCount = newTargetCount
  }

  #checkScaleDown (newTargetCount, now) {
    const {
      scaleDownAfterScaleUpMs = 30000,
      scaleDownAfterScaleDownMs = 20000
    } = this.#cooldowns

    this.#expirePendingScaleUps(now)

    if (this.#pendingScaleUps.length > 0) {
      return
    }

    if (this.#lastWorkerStartTime && now - this.#lastWorkerStartTime < scaleDownAfterScaleUpMs) {
      return
    }

    if (this.#lastScaleDownTime && now - this.#lastScaleDownTime < scaleDownAfterScaleDownMs) {
      return
    }

    this.#lastScaleDownTime = now
    this.#targetCount = newTargetCount
  }

  #expirePendingScaleUps (now) {
    const cutoff = now - PENDING_SCALE_UP_EXPIRY_MS
    while (this.#pendingScaleUps.length > 0 && this.#pendingScaleUps[0].scaleAt < cutoff) {
      this.#pendingScaleUps.shift()
    }
  }

  #resolvePendingScaleUp (startTime) {
    const pending = this.#pendingScaleUps.shift()
    if (pending) {
      const initTime = startTime - pending.decisionAt
      this.#initTimeoutWindow.push(initTime)
      if (this.#initTimeoutWindow.length > INIT_TIMEOUT_CONFIG.windowSize) {
        this.#initTimeoutWindow.shift()
      }
      this.#initTimeoutMs = Math.max(
        calculateInitTimeout(
          this.#initTimeoutWindow,
          this.#initTimeoutMs,
          INIT_TIMEOUT_CONFIG
        ),
        INIT_TIMEOUT_MS
      )
      this.#horizonMs = HORIZON_MULTIPLIER * this.#initTimeoutMs
    }
  }

  #processMetric (metricName, now) {
    const metric = this.#metrics.get(metricName)
    const { config } = metric
    const startTs = metric.lastProcessedTick + config.sampleIntervalMs

    const stateByTimestamp = this.#getAlignedMetrics(metricName, startTs, now)
    if (stateByTimestamp.length === 0) return null

    // Stage 1: Redistribution (mutates state entries in-place)
    metric.prevSum = redistributeValues(
      stateByTimestamp,
      this.#instances,
      config.redistributionConfig,
      metric.prevSum
    )

    // Stage 2: Holt smoothing (mutates state entries in-place)
    metric.holtState = holt(
      stateByTimestamp,
      config.holtConfig,
      metric.holtState
    )

    const lastEntry = stateByTimestamp[stateByTimestamp.length - 1]
    let { level, trend } = lastEntry.holt
    const { count } = lastEntry.redistribution
    metric.lastProcessedTick = lastEntry.timestamp

    // Convert trend from per-tick to per-second
    trend *= 1000 / config.sampleIntervalMs

    // Adjust level forward to now
    level += trend * (now - lastEntry.timestamp) / 1000

    // Append to history
    for (const entry of stateByTimestamp) {
      metric.history.push(
        entry.timestamp,
        entry.holt.level / entry.redistribution.count
      )
    }

    // Stage 3: Decision
    return makeScalingDecision({
      level,
      trend,
      count,
      threshold: config.threshold,
      targetCount: this.#targetCount,
      horizonMs: this.#horizonMs,
      min: this.#min,
      max: this.#max,
      horizontalTrendThreshold: HORIZONTAL_TREND_THRESHOLD,
      scaleUpK: SCALE_UP_K,
      scaleUpMargin: this.#scaleUpMargin,
      scaleDownMargin: this.#scaleDownMargin
    })
  }

  #getAlignedMetrics (metricName, fromTick, toTick) {
    const metric = this.#metrics.get(metricName)
    const result = []
    const workersMetrics = {}

    let firstTimestamp = Infinity
    for (const [instanceId, instance] of this.#instances) {
      const timeline = instance[metricName]
      if (!timeline) continue

      const workerMetrics = timeline.getEntries(fromTick)
      if (workerMetrics.length === 0) continue

      workersMetrics[instanceId] = workerMetrics
      firstTimestamp = Math.min(firstTimestamp, workerMetrics[0].timestamp)
    }

    fromTick = Math.max(fromTick, firstTimestamp)

    for (const workerId in workersMetrics) {
      const workerMetrics = workersMetrics[workerId]
      const firstTimestamp = workerMetrics[0].timestamp

      let i = (firstTimestamp - fromTick) / metric.config.sampleIntervalMs

      for (const { timestamp, value } of workerMetrics) {
        if (timestamp > toTick) break
        result[i] ??= { timestamp, workerValues: {} }
        result[i].workerValues[workerId] = value
        i++
      }
    }

    return result
  }

  #cleanupExpired (now) {
    for (const [instanceId, instance] of this.#instances) {
      let alive = false
      for (const metricName of this.#metrics.keys()) {
        const timeline = instance[metricName]
        if (timeline && !timeline.isExpired(now)) {
          alive = true
          break
        }
      }
      if (!alive) this.#instances.delete(instanceId)
    }
  }
}

// ---------------------------------------------------------------------------
// Worker ID Mapper
// ---------------------------------------------------------------------------

export class WorkerIdMapper {
  #map
  #counter

  constructor () {
    this.#map = new Map()
    this.#counter = 0
  }

  add (workerId) {
    const instanceId = workerId + '-' + this.#counter++
    this.#map.set(workerId, instanceId)
    return instanceId
  }

  remove (workerId) {
    this.#map.delete(workerId)
  }

  get (workerId) {
    return this.#map.get(workerId)
  }
}

// ---------------------------------------------------------------------------
// Sliding Window (generic timestamped entries with expiry)
// ---------------------------------------------------------------------------

export class SlidingWindow {
  #windowMs
  #entries

  constructor (windowMs) {
    this.#windowMs = windowMs
    this.#entries = []
  }

  push (timestamp, value) {
    this.#entries.push({ timestamp, value })
    this.#expire(timestamp)
  }

  isExpired (now) {
    if (this.#entries.length === 0) return true
    const lastTimestamp = this.#entries.at(-1).timestamp
    return lastTimestamp < now - this.#windowMs
  }

  getEntries () {
    return this.#entries
  }

  #expire (now) {
    const cutoff = now - this.#windowMs
    let i = 0
    while (i < this.#entries.length && this.#entries[i].timestamp < cutoff) {
      i++
    }
    if (i > 0) {
      this.#entries.splice(0, i)
    }
  }
}

// ---------------------------------------------------------------------------
// Worker Metrics Sliding Window (per-worker alignment with interpolation)
// ---------------------------------------------------------------------------

export class MetricStore extends SlidingWindow {
  #sampleIntervalMs
  #prevRawTs
  #prevRawValue
  #nextAlignedTs

  constructor (sampleIntervalMs, windowMs) {
    super(windowMs)
    this.#sampleIntervalMs = sampleIntervalMs
    this.#prevRawTs = null
    this.#prevRawValue = null
    this.#nextAlignedTs = null
  }

  push (timestamp, value) {
    if (this.#prevRawTs === null) {
      const alignedTs = this.#alignTimestamp(timestamp)
      super.push(alignedTs, value)
      this.#prevRawTs = timestamp
      this.#prevRawValue = value
      this.#nextAlignedTs = alignedTs + this.#sampleIntervalMs
      return
    }

    while (this.#nextAlignedTs <= timestamp) {
      const alignedValue = interpolate(
        this.#prevRawTs,
        this.#prevRawValue,
        timestamp,
        value,
        this.#nextAlignedTs
      )
      super.push(this.#nextAlignedTs, alignedValue)
      this.#nextAlignedTs += this.#sampleIntervalMs
    }
    this.#prevRawTs = timestamp
    this.#prevRawValue = value
  }

  getEntries (start = 0) {
    const entries = super.getEntries()

    let i = 0
    if (start > 0) {
      while (i < entries.length && entries[i].timestamp < start) i++
    }

    const result = entries.slice(i)
    const prev = result.at(-2)
    const last = result.at(-1)

    if (prev && last && last.timestamp < this.#nextAlignedTs) {
      const nextAlignedValue = interpolate(
        prev.timestamp,
        prev.value,
        last.timestamp,
        last.value,
        this.#nextAlignedTs
      )
      result.push({ timestamp: this.#nextAlignedTs, value: nextAlignedValue })
    }

    return result
  }

  #alignTimestamp (timestamp) {
    return Math.floor(timestamp / this.#sampleIntervalMs) * this.#sampleIntervalMs
  }
}

// ---------------------------------------------------------------------------
// Linear Projection
// ---------------------------------------------------------------------------

/**
 * Linear interpolation / extrapolation from two points.
 *
 * @param {number} ts1 - first timestamp
 * @param {number} val1 - first value
 * @param {number} ts2 - second timestamp
 * @param {number} val2 - second value
 * @param {number} targetTs - timestamp to interpolate/extrapolate to
 * @returns {number}
 */
export function interpolate (ts1, val1, ts2, val2, targetTs) {
  const timeDelta = ts2 - ts1
  if (timeDelta === 0) return val2

  const slope = (val2 - val1) / timeDelta
  return val2 + slope * (targetTs - ts2)
}

// ---------------------------------------------------------------------------
// Redistribution
// ---------------------------------------------------------------------------

/**
 * Calculate stabilization weight using exponential curve.
 * Weight goes from 0 (just added) to 1 (fully stable).
 *
 * @param {number} age - how long the worker has been running (ms)
 * @param {number} redistributionMs - expected time for full stabilization
 * @param {number} k - shape parameter (default 0.5)
 * @returns {number} weight in [0, 1]
 */
export function getStabilizationWeight (age, redistributionMs, k) {
  const t = age / redistributionMs
  return (Math.exp(k * t) - 1) / (Math.exp(k) - 1)
}

/**
 * Redistribute aggregated values to filter out scaling artifacts.
 *
 * Processes an array of ticks, carrying prevSum forward for drop absorption.
 * New workers (age < redistributionMs) contribute at partial weight.
 * The prevSum monotonicity guard prevents the sum from dropping during redistribution.
 *
 * @param {Array<{ timestamp: number, workerValues: Object<string, number> }>} state
 * @param {Map<string, { startTime: number }>} workers - worker registry
 * @param {{ redistributionMs: number, k?: number }} config
 * @param {number | null} prevSum - previous tick's redistributed sum
 * @returns {number | null} updated prevSum
 */
export function redistributeValues (state, workers, config, prevSum) {
  const { redistributionMs, k = 1 } = config

  for (let i = 0; i < state.length; i++) {
    const entry = state[i]
    const { timestamp, workerValues } = entry

    // Classify workers into stable and new, compute weights
    let stableSum = 0
    let stableCount = 0
    let newCount = 0
    let sumOfWeights = 0
    let total = 0

    for (const id in workerValues) {
      const value = workerValues[id]
      total += value

      const worker = workers.get(id)
      const startTime = worker?.startTime
      if (startTime !== undefined && startTime <= timestamp) {
        const age = timestamp - startTime
        if (age < redistributionMs) {
          newCount++
          sumOfWeights += getStabilizationWeight(age, redistributionMs, k)
          continue
        }
      }

      stableSum += value
      stableCount++
    }

    let sum, count
    if (newCount === 0) {
      sum = stableSum
      count = stableCount
    } else {
      const newVal = total - stableSum
      const baseShare = sumOfWeights / newCount

      count = stableCount + sumOfWeights
      sum = stableSum + newVal * baseShare

      if (prevSum !== null && prevSum > sum) {
        sum = Math.min(total, prevSum)
      }
    }

    prevSum = sum
    const workerCount = Object.keys(workerValues).length
    entry.redistribution = { sum, count, rawSum: total, workerCount }
  }

  return prevSum
}

// ---------------------------------------------------------------------------
// Holt smoothing
// ---------------------------------------------------------------------------

/**
 * Double Exponential Smoothing (Holt's Method)
 *
 * Reads from entry.redistribution.sum, writes entry.holt = { level, trend }.
 * Uses asymmetric smoothing parameters (faster reaction to upward movement).
 * Includes trend dampening to prevent downward overshoot.
 *
 * @param {Array<{ redistribution: { sum: number } }>} state - entries with redistribution data
 * @param {{ alphaUp: number, alphaDown: number, betaUp: number, betaDown: number }} config
 * @param {{ level: number, trend: number } | null} prev - previous state, null for cold start
 * @returns {{ level: number, trend: number }}
 */
export function holt (state, config, prev) {
  const { alphaUp, alphaDown, betaUp, betaDown, maxValue, saturationZone } = config

  let level = prev?.level ?? null
  let trend = prev?.trend ?? 0

  for (let i = 0; i < state.length; i++) {
    const entry = state[i]
    const input = entry.redistribution.sum

    if (level === null) {
      level = input
      trend = 0
      entry.holt = { level, trend }
      continue
    }

    const forecast = level + trend
    const isAboveForecast = input > forecast

    const alpha = isAboveForecast ? alphaUp : alphaDown
    const beta = isAboveForecast ? betaUp : betaDown

    const prevLevel = level
    const prevTrend = trend

    level = alpha * input + (1 - alpha) * forecast

    const levelDiff = level - prevLevel
    trend = beta * levelDiff + (1 - beta) * trend

    // Check if metric is saturated — only allow trend to increase, not decrease
    if (maxValue !== undefined) {
      const rawSum = entry.redistribution.rawSum
      const rawCount = entry.redistribution.workerCount
      const maxSum = rawCount * maxValue
      const threshold = maxSum * (1 - saturationZone)

      if (rawSum >= threshold) {
        trend = Math.max(trend, prevTrend)
        level = Math.min(level, maxSum)
        entry.holt = { level, trend }
        continue
      }
    }

    // Dampen trend when smoothed is above real value to prevent undershoot
    if (level > input) {
      const gap = level - input
      trend *= gap / (gap + Math.abs(trend) + 1e-9)
    }

    entry.holt = { level, trend }
  }

  return { level, trend }
}

// ---------------------------------------------------------------------------
// Decision
// ---------------------------------------------------------------------------

export const TrendDirection = {
  UP: 'up',
  HORIZONTAL: 'horizontal',
  DOWN: 'down'
}

/**
 * Classify the current trend direction based on the normalized growth rate.
 * The trend is normalized by level so classification is independent of absolute load.
 *
 * @param {number} trend - current Holt trend
 * @param {number} level - current Holt level
 * @param {number} horizontalTrendThreshold - deadband angle in degrees
 * @returns {'up' | 'horizontal' | 'down'}
 */
export function getTrendDirection (trend, level, horizontalTrendThreshold) {
  if (level === 0) return TrendDirection.HORIZONTAL
  const normalizedTrend = trend / level
  const angleDegrees = Math.atan(normalizedTrend) * (180 / Math.PI)
  if (angleDegrees > horizontalTrendThreshold) return TrendDirection.UP
  if (angleDegrees < -horizontalTrendThreshold) return TrendDirection.DOWN
  return TrendDirection.HORIZONTAL
}

/**
 * Make a scaling decision: compute the target worker count.
 *
 * The full target is computed without step clamping — the orchestrator
 * is responsible for global rate limiting across apps.
 *
 * @param {object} params
 * @param {number} params.level - current smoothed aggregated value (Holt level)
 * @param {number} params.trend - current Holt trend
 * @param {number} params.count - contribution-weighted worker count from redistribution
 * @param {number} params.threshold - per-worker overload threshold
 * @param {number} params.targetCount - current target worker count
 * @param {number} params.horizonMs - prediction horizon in ms
 * @param {number} params.min - minimum worker count
 * @param {number} params.max - maximum worker count
 * @param {number} params.horizontalTrendThreshold - deadband angle in degrees
 * @param {number} params.scaleUpK - consequence-asymmetric weight steepness
 * @param {number} params.scaleUpMargin - fractional overload margin for adding a worker
 * @param {number} params.scaleDownMargin - hysteresis margin for scale-down safety
 * @returns {number} target worker count
 */
export function makeScalingDecision ({
  level,
  trend,
  count,
  threshold,
  targetCount,
  horizonMs,
  min,
  max,
  horizontalTrendThreshold,
  scaleUpK,
  scaleUpMargin,
  scaleDownMargin
}) {
  const horizonSeconds = horizonMs / 1000
  const predictedSum = level + trend * horizonSeconds

  const trendDirection = getTrendDirection(trend, level, horizontalTrendThreshold)
  const isOverloaded = level / count > threshold
  const isOverloadedAtHorizon = predictedSum / targetCount > threshold

  if (trendDirection === TrendDirection.UP || isOverloadedAtHorizon) {
    return findScaleUpTarget({
      level,
      predictedSum,
      isOverloaded,
      threshold,
      max,
      targetCount,
      scaleUpK,
      scaleUpMargin
    })
  }

  if (!isOverloaded) {
    return findScaleDownTarget({
      level,
      threshold,
      min,
      targetCount,
      scaleDownMargin
    })
  }

  return targetCount
}

function findScaleUpTarget ({
  level,
  predictedSum,
  isOverloaded,
  threshold,
  max,
  targetCount,
  scaleUpK,
  scaleUpMargin
}) {
  const capacity = targetCount * threshold
  const utilization = level / capacity

  let predictedSumIncrease = predictedSum - level
  if (utilization < 1) {
    const cost = scaleUpK * utilization
    const weight = cost / (cost + (1 - utilization))
    predictedSumIncrease = weight * predictedSumIncrease
  }

  const adjustedPredictedSum = level + predictedSumIncrease

  let newTarget = Math.floor(adjustedPredictedSum / threshold)
  const targetOverload = adjustedPredictedSum - newTarget * threshold
  if (targetOverload > 0 && (isOverloaded || targetOverload / threshold > scaleUpMargin)) {
    newTarget++
  }

  newTarget = Math.max(newTarget, targetCount)
  newTarget = Math.min(newTarget, max)
  return newTarget
}

function findScaleDownTarget ({
  level,
  threshold,
  min,
  targetCount,
  scaleDownMargin
}) {
  const minInstances = Math.floor((1 + scaleDownMargin) * level / threshold) + 1
  return Math.max(min, Math.min(targetCount, minInstances))
}

// ---------------------------------------------------------------------------
// Init timeout
// ---------------------------------------------------------------------------

export function median (values) {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2
  }
  return sorted[mid]
}

export function calculateInitTimeout (window, currentTimeout, config) {
  const { stepRate, upFactor, downFactor } = config
  const target = median(window)

  const delta = target - currentTimeout
  const maxUp = currentTimeout * stepRate * upFactor
  const maxDown = currentTimeout * stepRate * downFactor
  const clampedDelta = Math.min(Math.max(delta, -maxDown), maxUp)

  return Math.round(currentTimeout + clampedDelta)
}
