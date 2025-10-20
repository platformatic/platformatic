import { features } from '@platformatic/foundation'
import { availableParallelism } from 'node:os'
import { getMemoryInfo } from './metrics.js'
import ScalingAlgorithm from './scaling-algorithm.js'
import { kApplicationId, kId, kLastVerticalScalerELU, kWorkerStartTime, kWorkerStatus } from './worker/symbols.js'

const healthCheckInterval = 1000
export const kOriginalWorkers = Symbol('plt.runtime.application.verticalScalerOriginalWorkers')

export class VerticalScaler {
  #runtime
  #algorithm

  #maxTotalMemory
  #maxTotalWorkers
  #maxWorkers
  #minWorkers
  #cooldown
  #scaleUpELU
  #scaleDownELU
  #scaleIntervalSec
  #scaleUpTimeWindowSec
  #scaleDownTimeWindowSec
  #gracePeriod
  #applications

  #memoryInfo
  #healthCheckTimeout
  #checkScalingInterval
  #isScaling
  #lastScaling

  constructor (runtime, config) {
    this.#runtime = runtime

    this.#maxTotalMemory = config.maxTotalMemory // This is defaulted in start()
    this.#maxTotalWorkers = config.maxTotalWorkers ?? availableParallelism()
    this.#maxWorkers = config.maxWorkers ?? this.#maxTotalWorkers
    this.#minWorkers = config.minWorkers ?? 1
    this.#cooldown = config.cooldownSec ?? 60
    this.#scaleUpELU = config.scaleUpELU ?? 0.8
    this.#scaleDownELU = config.scaleDownELU ?? 0.2
    this.#scaleIntervalSec = config.scaleIntervalSec ?? 60
    this.#scaleUpTimeWindowSec = config.timeWindowSec ?? 10
    this.#scaleDownTimeWindowSec = config.scaleDownTimeWindowSec ?? 60
    this.#gracePeriod = config.gracePeriod ?? 30 * 1000
    this.#applications = config.applications ?? {}

    this.#algorithm = new ScalingAlgorithm({
      maxTotalWorkers: this.#maxTotalWorkers,
      scaleUpELU: this.#scaleUpELU,
      scaleDownELU: this.#scaleDownELU,
      scaleUpTimeWindowSec: this.#scaleUpTimeWindowSec,
      scaleDownTimeWindowSec: this.#scaleDownTimeWindowSec
    })

    this.#isScaling = false
    this.#lastScaling = 0
  }

  getConfig () {
    return {
      maxTotalMemory: this.#maxTotalMemory,
      maxTotalWorkers: this.#maxTotalWorkers,
      maxWorkers: this.#maxWorkers,
      minWorkers: this.#minWorkers,
      cooldown: this.#cooldown,
      scaleUpELU: this.#scaleUpELU,
      scaleDownELU: this.#scaleDownELU,
      scaleIntervalSec: this.#scaleIntervalSec,
      scaleUpTimeWindowSec: this.#scaleUpTimeWindowSec,
      scaleDownTimeWindowSec: this.#scaleDownTimeWindowSec,
      gracePeriod: this.#gracePeriod,
      applications: this.#applications
    }
  }

  async start () {
    this.#memoryInfo = await getMemoryInfo()
    this.#maxTotalMemory ??= this.#memoryInfo.total * 0.9

    this.#checkScalingInterval = setInterval(this.#checkScaling.bind(this), this.#scaleIntervalSec * 1000)
    this.#healthCheckTimeout = setTimeout(this.#chechHealth.bind(this), healthCheckInterval)
  }

  stop () {
    clearTimeout(this.#healthCheckTimeout)
    clearInterval(this.#checkScalingInterval)
  }

  async add (application) {
    const config = {}

    if (application.entrypoint && !features.node.reusePort) {
      this.#runtime.logger.warn(
        `The "${application.id}" application cannot be scaled because it is an entrypoint and the "reusePort" feature is not available in your OS.`
      )

      config.minWorkers = 1
      config.maxWorkers = 1
    } else if (typeof application[kOriginalWorkers] !== 'undefined') {
      this.#runtime.logger.warn(
        `The "${application.id}" application cannot be scaled because it has a fixed number of workers (${application.workers}).`
      )

      config.minWorkers = application.workers
      config.maxWorkers = application.workers
    } else {
      config.minWorkers = this.#applications[application.id]?.minWorkers
      config.maxWorkers = this.#applications[application.id]?.maxWorkers
    }

    config.minWorkers ??= this.#minWorkers
    config.maxWorkers ??= this.#maxWorkers

    if (config.minWorkers > 0) {
      await this.#runtime.updateApplicationsResources([{ application: application.id, workers: config.minWorkers }])
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
        const health = await this.#runtime.getWorkerHealth(worker, { previousELU: worker[kLastVerticalScalerELU] })

        if (!health) {
          continue
        }

        worker[kLastVerticalScalerELU] = health.currentELU

        this.#algorithm.addWorkerHealthInfo({
          workerId: worker[kId],
          applicationId: worker[kApplicationId],
          elu: health.elu,
          heapUsed: health.heapUsed,
          heapTotal: health.heapTotal
        })

        if (health.elu > this.#scaleUpELU) {
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
    const isInCooldown = Date.now() < this.#lastScaling + this.#cooldown * 1000
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
      const recommendations = this.#algorithm.getRecommendations(appsWorkersInfo, {
        availableMemory
      })

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
