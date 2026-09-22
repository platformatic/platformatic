import { deepmerge, features } from '@platformatic/foundation'
import { availableParallelism } from 'node:os'
import { getMemoryInfo } from './metrics.js'
import { PredictiveScalingAlgorithm } from './predictive-scaling.js'
import { kWorkerStartTime, kWorkerStatus } from './worker/symbols.js'

// Ajv does not apply defaults inside anyOf branches, so the schema defaults
// defined in foundation/lib/schema.js are only used for validation. Defaults
// must be applied here in code. Keep these in sync with the schema.
const V2_DEFAULTS = {
  eluThreshold: 0.8,
  processIntervalMs: 10000,
  maxScaleUpStep: 1,
  scaleUpMargin: 0.1,
  scaleDownMargin: 0.3,
  redistributionMs: 10000,
  alphaUp: 0.2,
  alphaDown: 0.1,
  betaUp: 0.1,
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
  #started = false
  #initialUpdates = new Map()
  #isProcessing = false
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

    // Initial workers start before the scaler subscribes. Read their lifetimes
    // from the runtime instead of inferring them from the first metric event.
    const workers = await this.#runtime.getWorkers(true)
    for (const [id, { application, raw }] of Object.entries(workers)) {
      if (raw[kWorkerStatus] !== 'started' && raw[kWorkerStatus] !== 'stopping') continue
      const startTime = raw[kWorkerStartTime]
      if (startTime === undefined) continue
      this.#apps.get(application)?.algorithm.addWorker(id, startTime)
    }

    const initialApplications = [...this.#initialUpdates.keys()]
    this.#started = true
    for (const id of initialApplications) {
      await this.applyPendingUpdate(id)
    }

    this.#processTimer = setInterval(
      () => this.#process(),
      this.#config.processIntervalMs
    )
  }

  stop () {
    this.#started = false
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

    this.#apps.set(appId, { algorithm })
    this.#initialUpdates.delete(appId)
    if (min > (application.workers.static ?? 1)) {
      this.#initialUpdates.set(appId, { workers: min, promise: null })
    }
  }

  async applyPendingUpdate (applicationId) {
    if (!this.#started) return
    const update = this.#initialUpdates.get(applicationId)
    if (!update) return

    // Startup provisioning is separate from predictive scaling. Share an
    // in-flight request so repeated startup notifications cannot apply it twice.
    update.promise ??= Promise.resolve().then(async () => {
      if (this.#initialUpdates.get(applicationId) !== update) return
      await this.#runtime.updateApplicationsResources([{ application: applicationId, workers: update.workers }])
      if (this.#initialUpdates.get(applicationId) === update) {
        this.#initialUpdates.delete(applicationId)
      }
    }).finally(() => { update.promise = null })
    await update.promise
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
    this.#initialUpdates.delete(appId)
  }

  getDiagnostics () {
    const now = Date.now()
    return {
      now,
      processIntervalMs: this.#config.processIntervalMs,
      maxScaleUpStep: this.#config.maxScaleUpStep,
      maxTotalWorkers: this.#maxTotalWorkers,
      applications: [...this.#apps].map(([id, { algorithm }]) => ({ id, ...algorithm.getDiagnostics(now) }))
    }
  }

  async getMemoryDiagnostics () {
    // Read only when the diagnostics page requests it, using the same scope
    // and limit as the coordinator. Do not retain another memory sample.
    if (!this.#memoryInfo) return null
    const { used } = await getMemoryInfo({ scope: this.#memoryInfo.scope })
    return { used, limit: this.#maxTotalMemory }
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
      app.algorithm.removeWorker(workerId, Date.now())
    } catch (err) {
      this.#runtime.logger.error({ err }, 'Failed to handle worker exited')
    }
  }

  async #process () {
    if (this.#isProcessing) return
    this.#isProcessing = true

    try {
      await this.#processApplications()
    } catch (err) {
      this.#runtime.logger.error({ err }, 'Failed to process predictive scaling')
    } finally {
      this.#isProcessing = false
    }
  }

  async #processApplications () {
    const now = Date.now()
    const updates = []
    let plannedWorkerCount = 0
    let scaleUpCandidate = null
    let scaleUpRatio = -1

    for (const [appId, app] of this.#apps) {
      // Reserve the configured minimum, but do not make a competing scaling
      // decision while the application's startup update is pending.
      if (this.#initialUpdates.has(appId)) {
        plannedWorkerCount += app.algorithm.targetCount
        continue
      }
      const desiredTarget = app.algorithm.process(now)
      const targetCount = app.algorithm.targetCount
      plannedWorkerCount += targetCount
      if (desiredTarget === null || desiredTarget === targetCount) continue

      if (desiredTarget < targetCount) {
        this.#runtime.logger.info(
          `Predictive scaling down the "${appId}" app to ${desiredTarget} workers`
        )
        plannedWorkerCount -= targetCount - desiredTarget
        updates.push({ application: appId, workers: desiredTarget })
      } else {
        const ratio = (desiredTarget - targetCount) / targetCount
        if (ratio > scaleUpRatio) {
          scaleUpRatio = ratio
          scaleUpCandidate = { appId, app, desiredTarget }
        }
      }
    }

    if (scaleUpCandidate) {
      const { appId, app, desiredTarget } = scaleUpCandidate
      const hasAvailableMemory = await this.#hasAvailableMemory()

      if (plannedWorkerCount >= this.#maxTotalWorkers) {
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
        const scaleUpCount = Math.min(
          desiredTarget - app.algorithm.targetCount,
          this.#config.maxScaleUpStep,
          this.#maxTotalWorkers - plannedWorkerCount
        )
        const newTarget = app.algorithm.targetCount + scaleUpCount
        this.#runtime.logger.info(
          `Predictive scaling up the "${appId}" app to ${newTarget} workers`
        )
        updates.push({ application: appId, workers: newTarget })
      }
    }

    for (const update of updates) {
      const app = this.#apps.get(update.application)
      if (!app) continue
      app.algorithm.setTarget(update.workers)
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
}
