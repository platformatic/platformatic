import { deepmerge } from '@platformatic/foundation'
import { availableParallelism } from 'node:os'
import { getMemoryInfo } from './metrics.js'
import { PredictiveScalingAlgorithm } from './predictive-scaling.js'
import { kWorkerStartTime, kWorkerStatus } from './worker/symbols.js'

// Ajv does not apply defaults inside anyOf branches, so the schema defaults
// defined in foundation/lib/schema.js are only used for validation. Defaults
// must be applied here in code. Keep these in sync with the schema.
const DEFAULTS = {
  eluThreshold: 0.8,
  processIntervalMs: 10000,
  maxScaleUpStep: 1,
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
    this.#config = deepmerge(DEFAULTS, config)
    this.#apps = new Map()
    this.#processTimer = null
    this.#maxTotalWorkers = config.total ?? availableParallelism()
    this.#maxTotalMemory = config.maxMemory

    this.#onHealthMetrics = this.#handleHealthMetrics.bind(this)
    this.#onWorkerStarted = this.#handleWorkerStarted.bind(this)
    this.#onWorkerExited = this.#handleWorkerExited.bind(this)
  }

  getConfig () {
    return structuredClone({
      ...this.#config,
      minimum: this.#config.minimum ?? 1,
      maximum: this.#config.maximum ?? this.#maxTotalWorkers,
      total: this.#maxTotalWorkers,
      maxMemory: this.#maxTotalMemory
    })
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
    if (application.workers.dynamic === false) {
      this.#runtime.logger.warn(
        `The "${appId}" application cannot be scaled because it has a fixed number of workers (${application.workers.static}).`
      )
      min = application.workers.static
      max = application.workers.static
      appConfig = {}
    } else {
      appConfig = application.workers
      min = appConfig.minimum ?? this.#config.minimum ?? 1
      max = appConfig.maximum ?? this.#config.maximum ?? this.#maxTotalWorkers
    }

    const merged = deepmerge(this.#config, appConfig)
    const algorithmConfig = this.#buildAlgorithmConfig(min, max, merged)
    const algorithm = new PredictiveScalingAlgorithm(algorithmConfig)

    this.#apps.set(appId, { algorithm })
    this.#initialUpdates.delete(appId)
    if (min !== (application.workers.static ?? 1)) {
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

    let heapThreshold = null
    if (config.heapThresholdMb != null) {
      heapThreshold = config.heapThresholdMb * 1024 * 1024
    }

    metrics.heap = {
      threshold: heapThreshold,
      redistributionMs: config.redistributionMs,
      ...holtConfig
    }

    return {
      min,
      max,
      cooldowns: config.cooldowns,
      metrics
    }
  }

  remove (application) {
    const appId = typeof application === 'string' ? application : application.id
    this.#apps.delete(appId)
    this.#initialUpdates.delete(appId)
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
    const scaleDowns = []
    const scaleUpCandidates = []

    for (const [appId, app] of this.#apps) {
      // Reserve the configured minimum, but do not make a competing scaling
      // decision while the application's startup update is pending.
      if (this.#initialUpdates.has(appId)) {
        continue
      }
      const desiredTarget = app.algorithm.process(now)
      const targetCount = app.algorithm.targetCount
      if (desiredTarget === null || desiredTarget === targetCount) continue

      if (desiredTarget < targetCount) {
        this.#runtime.logger.info(
          `Predictive scaling down the "${appId}" app to ${desiredTarget} workers`
        )
        scaleDowns.push({ appId, app, workers: desiredTarget })
      } else {
        const ratio = (desiredTarget - targetCount) / targetCount
        scaleUpCandidates.push({ appId, app, desiredTarget, ratio })
      }
    }

    await this.#applyScaleDowns(scaleDowns)
    if (!this.#started) return

    if (scaleUpCandidates.length > 0) {
      const targetWorkersCount = await this.#getTargetWorkersCount()
      if (targetWorkersCount >= this.#maxTotalWorkers) {
        this.#runtime.logger.warn(
          `The maximum number of workers "${this.#maxTotalWorkers}" has been reached.`
        )
      } else {
        scaleUpCandidates.sort((a, b) => b.ratio - a.ratio)

        for (const { appId, app, desiredTarget } of scaleUpCandidates) {
          if (this.#apps.get(appId) !== app) continue
          const heap = app.algorithm.getMetricStats('heap')
          let heapPerWorker = null
          if (heap?.level != null && heap.count > 0) {
            heapPerWorker = heap.level / heap.count
          }

          if (!Number.isFinite(heapPerWorker) || heapPerWorker <= 0) {
            this.#runtime.logger.warn(`Cannot scale up the "${appId}" app until heap measurements are available.`)
            continue
          }

          const availableMemory = await this.#getAvailableMemory()
          const workersWithinMemory = Math.floor(availableMemory / heapPerWorker)
          if (!(workersWithinMemory > 0)) {
            this.#runtime.logger.warn(`Not enough available memory to scale up the "${appId}" app.`)
            continue
          }

          const scaleUpCount = Math.min(
            desiredTarget - app.algorithm.targetCount,
            this.#config.maxScaleUpStep,
            this.#maxTotalWorkers - targetWorkersCount,
            workersWithinMemory
          )

          const newTarget = app.algorithm.targetCount + scaleUpCount
          this.#runtime.logger.info(
            `Predictive scaling up the "${appId}" app to ${newTarget} workers`
          )
          updates.push({ application: appId, workers: newTarget })
          break
        }
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

  async #getTargetWorkersCount () {
    const workers = await this.#runtime.getWorkers(true)

    const actualCounts = {}
    for (const { application, status, raw } of Object.values(workers)) {
      const workerStatus = raw?.[kWorkerStatus] ?? status
      if (workerStatus === 'exited') continue

      actualCounts[application] ??= 0
      actualCounts[application] += 1
    }

    let totalWorkersCount = 0

    for (const appId in actualCounts) {
      const actualCount = actualCounts[appId]
      const targetCount = this.#apps.get(appId)?.algorithm.targetCount ?? 0
      totalWorkersCount += Math.max(targetCount, actualCount)
    }

    return totalWorkersCount
  }

  async #applyScaleDowns (candidates) {
    const active = candidates.filter(({ appId, app }) => this.#apps.get(appId) === app)
    if (!active.length || !this.#started) return
    let reports
    try {
      reports = await this.#runtime.updateApplicationsResources(
        active.map(({ appId, workers }) => ({ application: appId, workers }))
      )
    } catch (err) {
      this.#runtime.logger.error({ err }, 'Failed to apply predictive scale-down')
    }
    for (const { appId, app } of active) {
      if (this.#apps.get(appId) !== app) continue
      const report = reports?.find(entry => entry.application === appId)?.workers
      // A failed or partial stop must not free capacity that is still occupied.
      // When the call throws, lifecycle events remain the source of truth.
      let count = app.algorithm.getMetricStats('elu').count
      if (report?.success) count = report.new
      else if (Number.isFinite(report?.current) && Array.isArray(report.stopped)) {
        count = report.current - report.stopped.length
      }
      if (count > 0 && count < app.algorithm.targetCount) app.algorithm.setTarget(count)
    }
  }

  async #getAvailableMemory () {
    const mem = await getMemoryInfo({ scope: this.#memoryInfo.scope })
    return this.#maxTotalMemory - mem.used
  }
}
