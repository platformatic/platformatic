import { deepmerge, features } from '@platformatic/foundation'
import { availableParallelism } from 'node:os'
import { getMemoryInfo } from './metrics.js'
import { PredictiveScalingAlgorithm } from './predictive-scaling.js'

// Ajv does not apply defaults inside anyOf branches, so the schema defaults
// defined in foundation/lib/schema.js are only used for validation. Defaults
// must be applied here in code. Keep these in sync with the schema.
const V2_DEFAULTS = {
  eluThreshold: 0.8,
  processIntervalMs: 10000,
  scaleUpMargin: 0.1,
  scaleDownMargin: 0.3,
  redistributionMs: 30000,
  alphaUp: 0.2,
  alphaDown: 0.1,
  betaUp: 0.2,
  betaDown: 0.1,
  cooldowns: {
    scaleUpAfterScaleUpMs: 5000,
    scaleUpAfterScaleDownMs: 5000,
    scaleDownAfterScaleUpMs: 30000,
    scaleDownAfterScaleDownMs: 20000
  }
}

export class PredictiveWorkersScaler {
  #runtime
  #config
  #apps
  #processTimer
  #maxTotalWorkers
  #maxTotalMemory
  #memoryInfo
  #onHealthMetrics
  #onWorkerStarted
  #onWorkerExited

  constructor (runtime, config) {
    this.#runtime = runtime
    this.#config = deepmerge(V2_DEFAULTS, config)
    this.#apps = new Map()
    this.#processTimer = null
    this.#maxTotalWorkers = config.total ?? availableParallelism()
    this.#maxTotalMemory = config.maxMemory

    this.#onHealthMetrics = this.#handleHealthMetrics.bind(this)
    this.#onWorkerStarted = this.#handleWorkerStarted.bind(this)
    this.#onWorkerExited = this.#handleWorkerExited.bind(this)
  }

  async start () {
    this.#memoryInfo = await getMemoryInfo()
    this.#maxTotalMemory ??= this.#memoryInfo.total * 0.9

    this.#runtime.on('application:worker:health:metrics', this.#onHealthMetrics)
    this.#runtime.on('application:worker:started', this.#onWorkerStarted)
    this.#runtime.on('application:worker:exited', this.#onWorkerExited)

    this.#processTimer = setInterval(
      () => this.#process(),
      this.#config.processIntervalMs
    )
  }

  stop () {
    clearInterval(this.#processTimer)

    this.#runtime.off('application:worker:health:metrics', this.#onHealthMetrics)
    this.#runtime.off('application:worker:started', this.#onWorkerStarted)
    this.#runtime.off('application:worker:exited', this.#onWorkerExited)
  }

  async add (application) {
    const appId = application.id

    let min, max, appConfig
    if (application.entrypoint && !features.node.reusePort) {
      this.#runtime.logger.warn(
        `The "${appId}" application cannot be scaled because it is an entrypoint and the "reusePort" feature is not available in your OS.`
      )
      min = 1
      max = 1
      appConfig = {}
    } else if (application.workers.dynamic === false) {
      this.#runtime.logger.warn(
        `The "${appId}" application cannot be scaled because it has a fixed number of workers (${application.workers.static}).`
      )
      min = application.workers.static
      max = application.workers.static
      appConfig = {}
    } else {
      appConfig = application.workers
      min = appConfig.minimum ?? this.#config.minimum ?? 1
      max = appConfig.maximum ?? this.#config.maximum ?? availableParallelism()
    }

    const merged = deepmerge(this.#config, appConfig)
    const algorithmConfig = this.#buildAlgorithmConfig(min, max, merged)
    const algorithm = new PredictiveScalingAlgorithm(algorithmConfig)

    this.#apps.set(appId, { algorithm, targetCount: min })
  }

  #buildAlgorithmConfig (min, max, config) {
    const holtConfig = {
      alphaUp: config.alphaUp,
      alphaDown: config.alphaDown,
      betaUp: config.betaUp,
      betaDown: config.betaDown
    }

    const metrics = {
      elu: {
        threshold: config.eluThreshold,
        redistributionMs: config.redistributionMs,
        maxValue: 1,
        saturationZone: 0.02,
        ...holtConfig
      }
    }

    if (config.heapThresholdMb != null) {
      metrics.heap = {
        threshold: config.heapThresholdMb * 1024 * 1024,
        redistributionMs: config.redistributionMs,
        ...holtConfig
      }
    }

    return {
      min,
      max,
      scaleUpMargin: config.scaleUpMargin,
      scaleDownMargin: config.scaleDownMargin,
      cooldowns: config.cooldowns,
      metrics
    }
  }

  remove (application) {
    const appId = typeof application === 'string' ? application : application.id
    this.#apps.delete(appId)
  }

  #handleHealthMetrics ({ id, application, currentHealth }) {
    try {
      const app = this.#apps.get(application)
      if (!app || !currentHealth) return

      const now = Date.now()
      app.algorithm.addSample('elu', id, now, currentHealth.elu)

      if (currentHealth.heapUsed !== undefined) {
        app.algorithm.addSample('heap', id, now, currentHealth.heapUsed)
      }
    } catch (err) {
      this.#runtime.logger.error({ err }, 'Failed to handle health metrics')
    }
  }

  #handleWorkerStarted ({ application, worker }) {
    try {
      const app = this.#apps.get(application)
      if (!app) return

      const workerId = `${application}:${worker}`
      app.algorithm.addWorker(workerId, Date.now())
    } catch (err) {
      this.#runtime.logger.error({ err }, 'Failed to handle worker started')
    }
  }

  #handleWorkerExited ({ application, worker }) {
    try {
      const app = this.#apps.get(application)
      if (!app) return

      const workerId = `${application}:${worker}`
      app.algorithm.removeWorker(workerId)
    } catch (err) {
      this.#runtime.logger.error({ err }, 'Failed to handle worker exited')
    }
  }

  async #process () {
    const now = Date.now()
    const updates = []
    let scaleUpCandidate = null
    let scaleUpRatio = -1

    for (const [appId, app] of this.#apps) {
      const desiredTarget = app.algorithm.process(now)
      if (desiredTarget === null || desiredTarget === app.targetCount) continue

      if (desiredTarget < app.targetCount) {
        this.#runtime.logger.info(
          `Predictive scaling down the "${appId}" app to ${desiredTarget} workers`
        )
        app.targetCount = desiredTarget
        updates.push({ application: appId, workers: desiredTarget })
      } else {
        const ratio = (desiredTarget - app.targetCount) / app.targetCount
        if (ratio > scaleUpRatio) {
          scaleUpRatio = ratio
          scaleUpCandidate = { appId, app }
        }
      }
    }

    if (scaleUpCandidate) {
      const { appId, app } = scaleUpCandidate
      const totalWorkerCount = this.#getTotalWorkerCount()
      const hasAvailableMemory = await this.#hasAvailableMemory()

      if (totalWorkerCount >= this.#maxTotalWorkers) {
        this.#runtime.logger.warn(
          `Cannot scale up the "${appId}" app. ` +
          `The maximum number of workers "${this.#maxTotalWorkers}" has been reached.`
        )
      } else if (!hasAvailableMemory) {
        this.#runtime.logger.warn(
          `Cannot scale up the "${appId}" app. ` +
          `The memory limit "${this.#maxTotalMemory}" has been reached.`
        )
      } else {
        const newTarget = app.targetCount + 1
        this.#runtime.logger.info(
          `Predictive scaling up the "${appId}" app to ${newTarget} workers`
        )
        app.targetCount = newTarget
        updates.push({ application: appId, workers: newTarget })
      }
    }

    if (updates.length > 0) {
      try {
        await this.#runtime.updateApplicationsResources(updates)
      } catch (err) {
        this.#runtime.logger.error({ err }, 'Failed to apply predictive scaling')
      }
    }
  }

  async #hasAvailableMemory () {
    const mem = await getMemoryInfo({ scope: this.#memoryInfo.scope })
    return mem.used < this.#maxTotalMemory
  }

  #getTotalWorkerCount () {
    let total = 0
    for (const app of this.#apps.values()) {
      total += app.targetCount
    }
    return total
  }
}
