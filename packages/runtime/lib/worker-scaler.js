import { features } from '@platformatic/foundation'
import { availableParallelism } from 'node:os'
import { getMemoryInfo } from './metrics.js'
import { ScalingAlgorithm, scaleUpELUThreshold } from './scaling-algorithm.js'
import { kApplicationId, kId, kLastWorkerScalerELU, kWorkerStartTime, kWorkerStatus } from './worker/symbols.js'

const healthCheckInterval = 1000
export const kOriginalWorkers = Symbol('plt.runtime.application.dynamicWorkersScalerOriginalWorkers')

const defaultCooldown = 20_000
const defaultGracePeriod = 30_000
const scaleIntervalPeriod = 60_000

export class DynamicWorkersScaler {
  #status
  #runtime
  #algorithm

  #maxTotalMemory
  #maxTotalWorkers
  #maxWorkers
  #minWorkers
  #cooldown
  #gracePeriod

  #initialUpdates
  #memoryInfo
  #healthCheckTimeout
  #checkScalingInterval
  #isScaling
  #lastScaling

  constructor (runtime, config) {
    this.#runtime = runtime

    this.#maxTotalMemory = config.maxMemory // This is defaulted in start()
    this.#maxTotalWorkers = config.total ?? availableParallelism()
    this.#maxWorkers = config.maximum ?? this.#maxTotalWorkers
    this.#minWorkers = config.minimum ?? 1
    this.#cooldown = config.cooldown ?? defaultCooldown
    this.#gracePeriod = config.gracePeriod ?? defaultGracePeriod

    this.#algorithm = new ScalingAlgorithm({ maxTotalWorkers: this.#maxTotalWorkers })

    this.#isScaling = false
    this.#lastScaling = 0
    this.#initialUpdates = []
    this.#status = 'init'
  }

  getConfig () {
    return {
      maxTotalMemory: this.#maxTotalMemory,
      maxTotalWorkers: this.#maxTotalWorkers,
      maxWorkers: this.#maxWorkers,
      minWorkers: this.#minWorkers,
      cooldown: this.#cooldown,
      gracePeriod: this.#gracePeriod
    }
  }

  async start () {
    this.#memoryInfo = await getMemoryInfo()
    this.#maxTotalMemory ??= this.#memoryInfo.total * 0.9

    this.#checkScalingInterval = setInterval(this.#checkScaling.bind(this), scaleIntervalPeriod)
    this.#healthCheckTimeout = setTimeout(this.#chechHealth.bind(this), healthCheckInterval)

    if (this.#initialUpdates.length > 0) {
      await this.#runtime.updateApplicationsResources(this.#initialUpdates)
      this.#initialUpdates = []
    }

    this.#status = 'started'
  }

  stop () {
    clearTimeout(this.#healthCheckTimeout)
    clearInterval(this.#checkScalingInterval)
    this.#status = 'stopped'
  }

  async add (application) {
    const config = {}

    if (application.entrypoint && !features.node.reusePort) {
      this.#runtime.logger.warn(
        `The "${application.id}" application cannot be scaled because it is an entrypoint and the "reusePort" feature is not available in your OS.`
      )

      config.minWorkers = 1
      config.maxWorkers = 1
    } else if (application.workers.dynamic === false) {
      this.#runtime.logger.warn(
        `The "${application.id}" application cannot be scaled because it has a fixed number of workers (${application.workers.static}).`
      )

      config.minWorkers = application.workers.static
      config.maxWorkers = application.workers.static
    } else {
      config.minWorkers = application.workers.minimum
      config.maxWorkers = application.workers.maximum
    }

    config.minWorkers ??= this.#minWorkers
    config.maxWorkers ??= this.#maxWorkers

    if (config.minWorkers > 1) {
      const update = { application: application.id, workers: config.minWorkers }

      if (!this.#status === 'started') {
        await this.#runtime.updateApplicationsResources([update])
      } else {
        this.#initialUpdates.push(update)
      }
    }

    this.#algorithm.addApplication(application.id, config)
  }

  remove (application) {
    this.#algorithm.removeApplication(application.id)
  }

  async #chechHealth () {
    let shouldCheckForScaling = false

    const now = Date.now()

    const workers = await this.#runtime.getWorkers(true)

    for (const { raw: worker } of Object.values(workers)) {
      if (worker[kWorkerStatus] !== 'started' || worker[kWorkerStartTime] + this.#gracePeriod > now) {
        continue
      }

      try {
        const health = await this.#runtime.getWorkerHealth(worker, { previousELU: worker[kLastWorkerScalerELU] })

        if (!health) {
          continue
        }

        worker[kLastWorkerScalerELU] = health.currentELU

        this.#algorithm.addWorkerHealthInfo({
          workerId: worker[kId],
          applicationId: worker[kApplicationId],
          elu: health.elu,
          heapUsed: health.heapUsed,
          heapTotal: health.heapTotal
        })

        if (health.elu > scaleUpELUThreshold) {
          shouldCheckForScaling = true
        }
      } catch (err) {
        this.logger.error({ err }, 'Failed to get health for worker')
      }
    }

    if (shouldCheckForScaling) {
      await this.#checkScaling()
    }

    this.#healthCheckTimeout.refresh()
  }

  async #checkScaling () {
    const isInCooldown = Date.now() < this.#lastScaling + this.#cooldown
    if (this.#isScaling || isInCooldown) {
      return
    }

    this.#isScaling = true

    try {
      const workersInfo = await this.#runtime.getWorkers()
      const mem = await getMemoryInfo({ scope: this.#memoryInfo.scope })

      const appsWorkersInfo = {}
      for (const worker of Object.values(workersInfo)) {
        if (worker.status === 'exited') {
          continue
        }

        const applicationId = worker.application
        appsWorkersInfo[applicationId] ??= 0
        appsWorkersInfo[applicationId]++
      }

      const availableMemory = this.#maxTotalMemory - mem.used
      const recommendations = this.#algorithm.getRecommendations(appsWorkersInfo, { availableMemory })

      if (recommendations.length > 0) {
        await this.#applyRecommendations(recommendations)
        this.#lastScaling = Date.now()
      }
    } catch (err) {
      this.#runtime.logger.error({ err }, 'Failed to scale applications')
    } finally {
      this.#isScaling = false
    }
  }

  async #applyRecommendations (recommendations) {
    const resourcesUpdates = []

    for (const recommendation of recommendations) {
      const { applicationId, workersCount, direction } = recommendation
      this.#runtime.logger.info(`Scaling ${direction} the "${applicationId}" app to ${workersCount} workers`)

      resourcesUpdates.push({ application: applicationId, workers: workersCount })
    }

    return this.#runtime.updateApplicationsResources(resourcesUpdates)
  }
}
