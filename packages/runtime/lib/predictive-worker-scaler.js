import { getMemoryInfo } from './metrics.js'
import { PredictiveApplicationScaler } from './predictive-scaling.js'
import { kWorkerStartTime, kWorkerStatus } from './worker/symbols.js'

export class PredictiveWorkersScaler {
  #runtime
  #config
  #appConfigs = new Map()
  #appScalers = new Map()
  #processTimer
  #started = false
  #isProcessing = false
  #maxTotalWorkers
  #maxTotalMemory
  #memoryInfo
  #onHealthMetrics
  #onWorkerStarted
  #onWorkerExited
  #onWorkersUpdated

  constructor (runtime, config) {
    this.#runtime = runtime
    this.#config = config
    this.#processTimer = null
    this.#maxTotalWorkers = config.total
    this.#maxTotalMemory = config.maxMemory

    this.#onHealthMetrics = this.#handleHealthMetrics.bind(this)
    this.#onWorkerStarted = this.#handleWorkerStarted.bind(this)
    this.#onWorkerExited = this.#handleWorkerExited.bind(this)
    this.#onWorkersUpdated = this.#handleWorkersUpdated.bind(this)
  }

  async start () {
    this.#memoryInfo = await getMemoryInfo()
    this.#maxTotalMemory ??= this.#memoryInfo.total * 0.9

    this.#runtime.on('application:worker:health:metrics', this.#onHealthMetrics)
    this.#runtime.on('application:worker:started', this.#onWorkerStarted)
    this.#runtime.on('application:worker:exited', this.#onWorkerExited)
    this.#runtime.on('application:resources:workers:updated', this.#onWorkersUpdated)

    // Initial workers start before the scaler subscribes. Read their lifetimes
    // from the runtime instead of inferring them from the first metric event.
    const workers = await this.#getLiveWorkers()
    for (const [id, { application, raw }] of workers) {
      if (
        raw[kWorkerStatus] !== 'started' &&
        raw[kWorkerStatus] !== 'stopping'
      ) continue

      const startTime = raw[kWorkerStartTime]
      // A worker stopped before completing startup has no running lifetime.
      if (startTime === undefined) continue

      const applicationScaler = this.#appScalers.get(application)
      applicationScaler?.addWorker(id, startTime)
    }

    this.#started = true

    this.#processTimer = setInterval(
      () => this.#process(),
      this.#config.processIntervalMs
    ).unref()
  }

  stop () {
    this.#started = false
    clearInterval(this.#processTimer)

    this.#runtime.off('application:worker:health:metrics', this.#onHealthMetrics)
    this.#runtime.off('application:worker:started', this.#onWorkerStarted)
    this.#runtime.off('application:worker:exited', this.#onWorkerExited)
    this.#runtime.off('application:resources:workers:updated', this.#onWorkersUpdated)
  }

  async add (application) {
    const appId = application.id

    if (application.workers.dynamic === false) {
      this.#runtime.logger.warn(
        `The "${appId}" application cannot be scaled because it has a fixed number of workers (${application.workers.static}).`
      )
      this.remove(appId)
      return
    }

    const { minimum, maximum } = application.workers
    const scalerConfig = this.#buildApplicationScalerConfig(application.workers)
    const applicationScaler = new PredictiveApplicationScaler(scalerConfig)
    this.#appConfigs.set(appId, { minimum, maximum })
    this.#appScalers.set(appId, applicationScaler)
  }

  #buildApplicationScalerConfig (workersConfig) {
    const config = this.#config
    const holtConfig = {
      alphaUp: config.alphaUp,
      alphaDown: config.alphaDown,
      betaUp: config.betaUp,
      betaDown: config.betaDown
    }

    const metrics = {
      elu: {
        threshold: workersConfig.eluThreshold,
        redistributionMs: config.redistributionMs,
        maxValue: 1,
        saturationZone: 0.02,
        ...holtConfig
      }
    }

    let heapThreshold = null
    if (workersConfig.heapThresholdMb != null) {
      heapThreshold = workersConfig.heapThresholdMb * 1024 * 1024
    }

    metrics.heap = {
      threshold: heapThreshold,
      redistributionMs: config.redistributionMs,
      ...holtConfig
    }

    return {
      minimum: workersConfig.minimum,
      maximum: workersConfig.maximum,
      cooldowns: config.cooldowns,
      metrics
    }
  }

  remove (appId) {
    this.#appConfigs.delete(appId)
    this.#appScalers.delete(appId)
  }

  #handleWorkersUpdated ({ application, workers }) {
    this.#appScalers.get(application)?.syncWorkersCount(workers)
  }

  #handleHealthMetrics ({ id, application, currentHealth }) {
    try {
      const applicationScaler = this.#appScalers.get(application)
      if (!applicationScaler || !currentHealth) return

      const now = Date.now()
      applicationScaler.addSample('elu', id, now, currentHealth.elu)

      if (currentHealth.heapUsed !== undefined) {
        applicationScaler.addSample('heap', id, now, currentHealth.heapUsed)
      }
    } catch (err) {
      this.#runtime.logger.error({ err }, 'Failed to handle health metrics')
    }
  }

  #handleWorkerStarted ({ application, worker }) {
    try {
      const applicationScaler = this.#appScalers.get(application)
      if (!applicationScaler) return

      const workerId = `${application}:${worker}`
      applicationScaler.addWorker(workerId, Date.now())
    } catch (err) {
      this.#runtime.logger.error({ err }, 'Failed to handle worker started')
    }
  }

  #handleWorkerExited ({ application, worker }) {
    try {
      const applicationScaler = this.#appScalers.get(application)
      if (!applicationScaler) return

      const workerId = `${application}:${worker}`
      applicationScaler.removeWorker(workerId, Date.now())
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
      this.#runtime.logger.error({ err }, 'Failed to process dynamic workers scaling')
    } finally {
      this.#isProcessing = false
    }
  }

  async #processApplications () {
    const workersCountByAppId = await this.#getWorkerCounts()
    if (!this.#started) return

    const appWorkersTargets = new Map()
    const now = Date.now()
    for (const [appId, appScaler] of this.#appScalers) {
      const target = appScaler.process(now)
      appWorkersTargets.set(appId, target)
    }

    const syncAndScaleDownUpdates = []
    const scaleUpCandidates = []

    let totalWorkersCount = 0
    for (const appId in workersCountByAppId) {
      let workersCount = workersCountByAppId[appId]
      const appConfig = this.#appConfigs.get(appId)
      const appScaler = this.#appScalers.get(appId)

      // Unmanaged workers still occupy capacity.
      if (!appScaler) {
        totalWorkersCount += workersCount
        continue
      }

      const minimum = appConfig.minimum
      const maximum = appConfig.maximum
      let target = appWorkersTargets.get(appId)

      if (workersCount < minimum || workersCount > maximum) {
        // Sync workers if they are outside min/max bounds
        if (workersCount < minimum) {
          workersCount = minimum
        }
        if (workersCount > maximum) {
          workersCount = Math.min(maximum, target ?? maximum)
        }
      }

      if (target === null) {
        target = workersCount
        appWorkersTargets.set(appId, target)
      }

      if (target < workersCount) {
        // Handle scale-downs first, so we have enough resources to scale up
        workersCount = target
        appScaler.setTargetCount(workersCount)
      }

      if (target > workersCount) {
        const ratio = (target - workersCount) / workersCount
        scaleUpCandidates.push({ appId, target, ratio })
      }

      if (workersCount !== workersCountByAppId[appId]) {
        syncAndScaleDownUpdates.push({
          application: appId,
          workers: workersCount
        })
        workersCountByAppId[appId] = workersCount
      }
      totalWorkersCount += workersCount
    }

    // Apply syncs and scale-downs first to free up resources for scale-ups.
    if (syncAndScaleDownUpdates.length > 0) {
      try {
        await this.#runtime.updateApplicationsResources(syncAndScaleDownUpdates)
      } catch (err) {
        this.#runtime.logger.error({ err }, 'Failed to apply worker corrections and scale-downs')
      }
      if (!this.#started) return
    }

    if (scaleUpCandidates.length === 0) return

    scaleUpCandidates.sort((a, b) => b.ratio - a.ratio)

    if (totalWorkersCount >= this.#maxTotalWorkers) {
      let totalDesiredWorkers = totalWorkersCount
      const scaleUpRequests = []
      for (const { appId, target } of scaleUpCandidates) {
        const workersCount = workersCountByAppId[appId]
        totalDesiredWorkers += target - workersCount
        scaleUpRequests.push(`"${appId}": ${workersCount} -> ${target}`)
      }
      this.#runtime.logger.warn(
        `The maximum number of workers "${this.#maxTotalWorkers}" has been reached. ` +
        `Applications requesting scale-up: ${scaleUpRequests.join(', ')}. Total desired workers: ${totalDesiredWorkers}.`
      )
      return
    }

    const availableMemory = await this.#getAvailableMemory()
    if (!this.#started) return

    for (const { appId, target } of scaleUpCandidates) {
      const appScaler = this.#appScalers.get(appId)
      if (!appScaler) continue

      const workersCount = workersCountByAppId[appId]
      if (target <= workersCount) continue

      const heapPerWorker = appScaler.getHeapPerWorker()
      if (heapPerWorker === null) {
        this.#runtime.logger.warn(`Cannot scale up the "${appId}" app until heap measurements are available.`)
        continue
      }

      const workersWithinMemory = Math.floor(availableMemory / heapPerWorker)
      if (workersWithinMemory === 0) {
        this.#runtime.logger.warn(`Not enough available memory to scale up the "${appId}" app.`)
        continue
      }

      const scaleUpCount = Math.min(
        target - workersCount,
        this.#config.maxScaleUpStep,
        this.#maxTotalWorkers - totalWorkersCount,
        workersWithinMemory
      )

      const constrainedTarget = workersCount + scaleUpCount
      this.#runtime.logger.info(
        `Scaling up the "${appId}" app to ${constrainedTarget} workers`
      )
      appScaler.setTargetCount(constrainedTarget)

      try {
        await this.#runtime.updateApplicationsResources([{ application: appId, workers: constrainedTarget }])
      } catch (err) {
        this.#runtime.logger.error({ err }, 'Failed to scale up application workers')
      }
      break
    }
  }

  async #getLiveWorkers () {
    const workers = await this.#runtime.getWorkers(true)
    // The copied status can be stale after awaiting the snapshot. Prefer the
    // live worker status, and retain starting/stopping workers for budgeting.
    return Object.entries(workers).filter(([, { raw, status }]) => {
      return (raw?.[kWorkerStatus] ?? status) !== 'exited'
    })
  }

  async #getWorkerCounts () {
    const workers = await this.#getLiveWorkers()

    const actualCountsByAppId = Object.create(null)
    for (const [, { application }] of workers) {
      actualCountsByAppId[application] ??= 0
      actualCountsByAppId[application] += 1
    }

    for (const appId of this.#appScalers.keys()) {
      actualCountsByAppId[appId] ??= 0
    }

    return actualCountsByAppId
  }

  async #getAvailableMemory () {
    const mem = await getMemoryInfo({ scope: this.#memoryInfo.scope })
    return Math.max(0, this.#maxTotalMemory - mem.used)
  }
}
