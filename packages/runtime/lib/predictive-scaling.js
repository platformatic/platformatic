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
export const MIN_HORIZON_MS = 7000
export const MAX_HORIZON_MS = 30000
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

  /** @type {Map<string, { startTime: number, endTime: number | null, [metricName]: MetricStore }>} instanceId -> instance */
  #instances

  /**
   * Per-metric state, keyed by metric name.
   * @type {Map<string, {
   *   holtState: { level: number, trend: number } | null,
   *   redistributionState: {
   *     prevSum: number,
   *     prevSumOfWeight: number,
   *     prevNewAvgValue: number,
   *     prevNewCount: number
   *   } | null,
   *   lastProcessedTick: number,
   *   history: SlidingWindow,
   *   config: { sampleIntervalMs: number, windowMs: number, threshold: number | null,
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
    this.#horizonMs = this.#calculateHorizon()

    this.#workerIdMapper = new WorkerIdMapper()
    this.#instances = new Map()

    this.#metrics = new Map()
    for (const name in config.metrics) {
      const mc = config.metrics[name]
      this.#metrics.set(name, {
        holtState: null,
        redistributionState: null,
        lastProcessedTick: 0,
        history: new SlidingWindow(WINDOW_MS),
        config: {
          sampleIntervalMs: SAMPLE_INTERVAL_MS,
          windowMs: WINDOW_MS,
          threshold: mc.threshold ?? null,
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
    if (this.#workerIdMapper.get(workerId)) return

    const instanceId = this.#workerIdMapper.add(workerId)
    this.#instances.set(instanceId, { startTime, endTime: null })
    this.#lastWorkerStartTime = Math.max(this.#lastWorkerStartTime, startTime)
    this.#resolvePendingScaleUp(startTime)
  }

  removeWorker (workerId, endTime) {
    const instanceId = this.#workerIdMapper.get(workerId)
    if (!instanceId) return

    this.#instances.get(instanceId).endTime = endTime
    this.#workerIdMapper.remove(workerId)
  }

  addSample (metricName, workerId, timestamp, value) {
    // Invalid readings are missing samples; preserve the last valid value.
    if (!Number.isFinite(value)) return

    const metric = this.#metrics.get(metricName)
    if (!metric) return

    const instanceId = this.#workerIdMapper.get(workerId)
    // Only lifecycle events register workers. A late metric must not revive one.
    if (!instanceId) return
    const instance = this.#instances.get(instanceId)
    if (timestamp < instance.startTime) return

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

  get targetCount () {
    return this.#targetCount
  }

  getMetricStats (metricName) {
    const metric = this.#metrics.get(metricName)
    if (!metric) return null

    return {
      level: metric.holtState?.level ?? null,
      trend: metric.holtState?.trend ?? 0,
      count: this.#workerIdMapper.size
    }
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

  // Request-only diagnostics. Never process ticks, expire requests or retain a
  // second copy of algorithm state for the UI.
  getDiagnostics (now = Date.now()) {
    const metrics = {}
    for (const [name, metric] of this.#metrics) {
      metrics[name] = {
        ...this.getSnapshot(name),
        lastProcessedTick: metric.lastProcessedTick,
        sampleIntervalMs: metric.config.sampleIntervalMs,
        redistributionMs: metric.config.redistributionConfig.redistributionMs,
        history: metric.history.getEntries().filter(entry => entry.timestamp >= now - WINDOW_MS)
      }
    }

    const workers = []
    for (const [id, instance] of this.#instances) {
      if (instance.endTime !== null) continue
      const workerMetrics = {}
      for (const name of this.#metrics.keys()) {
        const timeline = instance[name]
        if (!timeline) continue
        workerMetrics[name] = timeline.getDiagnostics(Math.max(instance.startTime, now - WINDOW_MS))
      }
      workers.push({ id, startTime: instance.startTime, metrics: workerMetrics })
    }

    return structuredClone({
      targetCount: this.#targetCount,
      liveCount: this.#workerIdMapper.size,
      min: this.#min,
      max: this.#max,
      initTimeoutMs: this.#initTimeoutMs,
      horizonMs: this.#horizonMs,
      pending: this.#pendingScaleUps.map(pending => ({
        ...pending,
        expiresAt: pending.scaleAt + PENDING_SCALE_UP_EXPIRY_MS
      })),
      scaleUpAllowed: this.#checkScaleUp(now),
      scaleDownAllowed: this.#checkScaleDown(now),
      metrics,
      workers
    })
  }

  /**
   * Run the pipeline over all unprocessed ticks.
   * Each metric is processed independently; the final targetCount is the max.
   * Cooldowns are enforced after computing the target.
   *
   * @param {number} now - current timestamp
   * @returns {number | null} suggested targetCount, or null if no metrics had new ticks
   */
  process (now) {
    this.#expirePendingScaleUps(now)
    let maxTargetCount = 0
    let processed = false

    for (const metricName of this.#metrics.keys()) {
      const targetCount = this.#processMetric(metricName, now)
      if (targetCount !== null) {
        processed = true
        maxTargetCount = Math.max(maxTargetCount, targetCount)
      }
    }

    this.#cleanupExpired(now)

    if (!processed) return null

    if (maxTargetCount === this.#targetCount) return this.#targetCount

    if (maxTargetCount > this.#targetCount) {
      return this.#checkScaleUp(now) ? maxTargetCount : this.#targetCount
    }

    return this.#checkScaleDown(now) ? maxTargetCount : this.#targetCount
  }

  /** Record the coordinator's approved target before requesting workers. */
  setTarget (targetCount) {
    if (targetCount === this.#targetCount) return

    const now = Date.now()

    if (targetCount > this.#targetCount) {
      const scaleAt = now + this.#initTimeoutMs
      for (let i = this.#targetCount; i < targetCount; i++) {
        this.#pendingScaleUps.push({ scaleAt, decisionAt: now, expectedCount: i + 1 })
      }
      this.#lastScaleUpTime = now
    } else {
      this.#lastScaleDownTime = now
    }

    this.#targetCount = targetCount
  }

  #checkScaleUp (now) {
    const {
      scaleUpAfterScaleUpMs = 5000,
      scaleUpAfterScaleDownMs = 5000
    } = this.#cooldowns

    if (this.#lastScaleUpTime && now - this.#lastScaleUpTime < scaleUpAfterScaleUpMs) {
      return false
    }

    if (this.#lastScaleDownTime && now - this.#lastScaleDownTime < scaleUpAfterScaleDownMs) {
      return false
    }

    return true
  }

  #checkScaleDown (now) {
    const {
      scaleDownAfterScaleUpMs = 30000,
      scaleDownAfterScaleDownMs = 20000
    } = this.#cooldowns

    if (this.#pendingScaleUps.length > 0) {
      return false
    }

    if (this.#lastWorkerStartTime && now - this.#lastWorkerStartTime < scaleDownAfterScaleUpMs) {
      return false
    }

    if (this.#lastScaleDownTime && now - this.#lastScaleDownTime < scaleDownAfterScaleDownMs) {
      return false
    }

    return true
  }

  #expirePendingScaleUps (now) {
    const cutoff = now - PENDING_SCALE_UP_EXPIRY_MS
    let remaining = 0
    for (const pending of this.#pendingScaleUps) {
      if (pending.scaleAt >= cutoff) {
        this.#pendingScaleUps[remaining++] = pending
      }
    }
    if (remaining === this.#pendingScaleUps.length) return

    this.#pendingScaleUps.length = remaining
    const liveCount = this.#workerIdMapper.size
    this.#targetCount = liveCount + remaining

    // Remaining requests still represent one extra worker each. Remove the
    // expired capacity from their expected counts as well as from the target.
    for (let i = 0; i < remaining; i++) {
      this.#pendingScaleUps[i].expectedCount = liveCount + i + 1
    }
  }

  #calculateHorizon () {
    return Math.min(Math.max(HORIZON_MULTIPLIER * this.#initTimeoutMs, MIN_HORIZON_MS), MAX_HORIZON_MS)
  }

  #resolvePendingScaleUp (startTime) {
    // A replacement that only restores the previous count does not fulfil a
    // scale-up. Measure when the requested number of live workers is reached.
    while (this.#pendingScaleUps.length > 0) {
      const pending = this.#pendingScaleUps[0]
      if (this.#workerIdMapper.size < pending.expectedCount) break

      this.#pendingScaleUps.shift()
      const initTime = startTime - pending.decisionAt
      this.#initTimeoutWindow.push(initTime)
      if (this.#initTimeoutWindow.length > INIT_TIMEOUT_CONFIG.windowSize) {
        this.#initTimeoutWindow.shift()
      }
      this.#initTimeoutMs = calculateInitTimeout(
        this.#initTimeoutWindow,
        this.#initTimeoutMs,
        INIT_TIMEOUT_CONFIG
      )
      this.#horizonMs = this.#calculateHorizon()
    }
  }

  #processMetric (metricName, now) {
    const metric = this.#metrics.get(metricName)
    const { config } = metric
    const startTs = metric.lastProcessedTick + config.sampleIntervalMs

    const stateByTimestamp = this.#getAlignedMetrics(metricName, startTs, now)
    if (stateByTimestamp.length === 0) return null

    // Stage 1: Redistribution (mutates state entries in-place)
    metric.redistributionState = redistributeValues(
      stateByTimestamp,
      this.#instances,
      config.redistributionConfig,
      metric.redistributionState
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

    // Metrics without a threshold are still processed for diagnostics and
    // resource checks, but cannot recommend either direction of scaling.
    if (config.threshold === null) return null

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
    const ticks = new Map()

    for (const [instanceId, instance] of this.#instances) {
      const timeline = instance[metricName]
      if (!timeline) continue

      const end = instance.endTime === null ? toTick : Math.min(toTick, instance.endTime - 1)
      for (const { timestamp, value } of timeline.getEntries(fromTick, end)) {
        if (timestamp < instance.startTime) continue

        let tick = ticks.get(timestamp)
        if (!tick) {
          tick = { timestamp, workerValues: {} }
          ticks.set(timestamp, tick)
        }
        tick.workerValues[instanceId] = value
      }
    }

    return [...ticks.values()].sort((a, b) => a.timestamp - b.timestamp)
  }

  #cleanupExpired (now) {
    for (const [instanceId, instance] of this.#instances) {
      // Silence is not an exit. Keep the active lifetime even without samples.
      if (instance.endTime === null) continue

      let hasPendingTicks = false
      for (const [metricName, metric] of this.#metrics) {
        const timeline = instance[metricName]
        if (!timeline || timeline.isExpired(now)) continue

        const fromTick = metric.lastProcessedTick + metric.config.sampleIntervalMs
        if (timeline.getEntries(fromTick, instance.endTime - 1).some(({ timestamp }) =>
          timestamp >= instance.startTime && timestamp < instance.endTime
        )) {
          hasPendingTicks = true
          break
        }
      }
      if (!hasPendingTicks) this.#instances.delete(instanceId)
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

  get size () {
    return this.#map.size
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

  getEntries (startTs = 0, endTs = Infinity) {
    const entries = super.getEntries()

    let i = 0
    let j = entries.length

    if (startTs > 0) {
      while (i < entries.length && entries[i].timestamp < startTs) i++
    }
    if (Number.isFinite(endTs)) {
      j = i
      while (j < entries.length && entries[j].timestamp <= endTs) j++
    }
    const result = entries.slice(i, j)

    if (this.#prevRawTs === null) return result
    if (!Number.isFinite(endTs)) return result

    const intervalMs = this.#sampleIntervalMs
    const alignedStart = Math.ceil(startTs / intervalMs) * intervalMs

    let timestamp = Math.max(this.#nextAlignedTs, alignedStart)
    while (timestamp <= endTs) {
      result.push({ timestamp, value: this.#prevRawValue })
      timestamp += intervalMs
    }

    return result
  }

  getDiagnostics (startTs) {
    return {
      lastSampleAt: this.#prevRawTs,
      value: this.#prevRawValue,
      history: super.getEntries().filter(entry => entry.timestamp >= startTs)
    }
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
 * Processes ticks using the previous sum and startup weights as current state.
 * New workers (age < redistributionMs) contribute at partial weight.
 * The prevSum monotonicity guard prevents the sum from dropping during redistribution.
 * newSumDelta reports weight-driven growth separately for Holt compensation.
 *
 * @param {Array<{ timestamp: number, workerValues: Object<string, number> }>} state
 * @param {Map<string, { startTime: number }>} workers - worker registry
 * @param {{ redistributionMs: number, k?: number }} config
 * @param {{ prevSum: number, prevSumOfWeight: number, prevNewAvgValue: number, prevNewCount: number } | null} prev
 * @returns {{ prevSum: number, prevSumOfWeight: number, prevNewAvgValue: number, prevNewCount: number } | null}
 */
export function redistributeValues (state, workers, config, prev) {
  if (state.length === 0) return prev

  const { redistributionMs, k = 1 } = config
  let prevSum = prev?.prevSum ?? null
  let prevSumOfWeight = prev?.prevSumOfWeight ?? 0
  let prevNewAvgValue = prev?.prevNewAvgValue ?? 0
  let prevNewCount = prev?.prevNewCount ?? 0

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
    let newSumDelta = 0
    let newAvgValue = 0
    if (newCount === 0) {
      sum = stableSum
      count = stableCount
    } else {
      const newVal = total - stableSum
      // A graduating worker moves into stableSum. Add its full weight back
      // when measuring weight growth, as in the original pod algorithm.
      const graduatedCount = Math.max(0, prevNewCount - newCount)
      const weightGrowth = sumOfWeights - prevSumOfWeight + graduatedCount
      newSumDelta = weightGrowth * prevNewAvgValue
      newAvgValue = newVal / newCount
      const baseShare = sumOfWeights / newCount

      count = stableCount + sumOfWeights
      sum = stableSum + newVal * baseShare

      if (prevSum !== null && prevSum > sum) {
        sum = Math.min(total, prevSum)
        newSumDelta = 0
      }
    }

    prevSum = sum
    prevSumOfWeight = sumOfWeights
    prevNewAvgValue = newAvgValue
    prevNewCount = newCount
    const workerCount = Object.keys(workerValues).length
    entry.redistribution = { sum, count, rawSum: total, workerCount, newSumDelta }
  }

  return { prevSum, prevSumOfWeight, prevNewAvgValue, prevNewCount }
}

// ---------------------------------------------------------------------------
// Holt smoothing
// ---------------------------------------------------------------------------

/**
 * Double Exponential Smoothing (Holt's Method)
 *
 * Reads from entry.redistribution.sum, writes entry.holt = { level, trend }.
 * Uses asymmetric smoothing parameters (faster reaction to upward movement).
 * Accounts for newSumDelta in the forecast and removes it from the trend update.
 * Includes trend dampening to prevent downward overshoot.
 *
 * @param {Array<{ redistribution: { sum: number, newSumDelta?: number } }>} state - entries with redistribution data
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
    const newSumDelta = entry.redistribution.newSumDelta ?? 0

    if (level === null) {
      level = input
      trend = 0
      entry.holt = { level, trend }
      continue
    }

    const forecast = level + trend + newSumDelta
    const isAboveForecast = input > forecast

    const alpha = isAboveForecast ? alphaUp : alphaDown
    const beta = isAboveForecast ? betaUp : betaDown

    const prevLevel = level
    const prevTrend = trend

    level = alpha * input + (1 - alpha) * forecast

    // Weight growth changes the level, but must not appear as demand growth.
    const levelDiff = level - prevLevel - newSumDelta
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
  let predictedSumIncrease = predictedSum - level
  if (level > 0 && predictedSumIncrease > 0) {
    const growth = predictedSumIncrease / level
    const weight = scaleUpK / (scaleUpK + growth)
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
