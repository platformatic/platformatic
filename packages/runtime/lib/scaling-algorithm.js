export const scaleUpTimeWindow = 10_000
export const scaleDownTimeWindow = 60_000

export class ScalingAlgorithm {
  #maxTotalWorkers
  #appsMetrics
  #appsConfigs
  #scaleUpELU
  #scaleDownELU

  constructor (options = {}) {
    this.#maxTotalWorkers = options.maxTotalWorkers ?? Infinity
    this.#appsConfigs = options.applications ?? {}
    this.#appsMetrics = {}

    this.#scaleUpELU = options.scaleUpELU ?? 0.8
    this.#scaleDownELU = options.scaleDownELU ?? 0.2
  }

  get scaleUpELU () {
    return this.#scaleUpELU
  }

  addApplication (id, config) {
    this.#appsConfigs[id] = config
  }

  removeApplication (id) {
    delete this.#appsConfigs[id]
    delete this.#appsMetrics[id]
  }

  addWorkerHealthInfo (healthInfo) {
    const { workerId, applicationId, elu, heapUsed } = healthInfo
    const timestamp = Date.now()

    if (!this.#appsMetrics[applicationId]) {
      this.#appsMetrics[applicationId] = {}
    }
    if (!this.#appsMetrics[applicationId][workerId]) {
      this.#appsMetrics[applicationId][workerId] = []
    }
    this.#appsMetrics[applicationId][workerId].push({
      elu,
      timestamp,
      heapUsed
    })
    this.#removeOutdatedAppELUs(applicationId)
  }

  getRecommendations (appsWorkersInfo, options = {}) {
    let totalWorkersCount = 0
    let totalAvailableMemory = options.availableMemory ?? Infinity

    const appsInfo = []

    for (const applicationId in appsWorkersInfo) {
      const workersCount = appsWorkersInfo[applicationId]

      const { heapUsed } = this.#calculateAppAvgMetrics(applicationId)

      appsInfo.push({
        applicationId,
        workersCount,
        avgHeapUsed: heapUsed
      })

      totalWorkersCount += workersCount
    }

    const recommendations = []

    for (const { applicationId, workersCount, avgHeapUsed } of appsInfo) {
      const appMinWorkers = this.#appsConfigs[applicationId]?.minWorkers ?? 1
      const appMaxWorkers = this.#appsConfigs[applicationId]?.maxWorkers ?? this.#maxTotalWorkers

      if (workersCount < appMinWorkers) {
        recommendations.push({
          applicationId,
          workersCount: appMinWorkers,
          direction: 'up'
        })

        const newWorkersCount = appMinWorkers - workersCount
        totalWorkersCount += newWorkersCount
        totalAvailableMemory += newWorkersCount * avgHeapUsed
        continue
      }

      if (workersCount > appMaxWorkers) {
        recommendations.push({
          applicationId,
          workersCount: appMaxWorkers,
          direction: 'down'
        })

        const removedWorkersCount = workersCount - appMaxWorkers
        totalWorkersCount -= removedWorkersCount
        totalAvailableMemory -= removedWorkersCount * avgHeapUsed
        continue
      }

      if (workersCount > appMinWorkers) {
        const recommendation = this.#getApplicationScaleRecommendation(applicationId)
        if (recommendation.recommendation === 'scaleDown') {
          recommendations.push({
            applicationId,
            workersCount: workersCount - 1,
            direction: 'down'
          })

          const removedWorkersCount = 1
          totalWorkersCount -= removedWorkersCount
          totalAvailableMemory -= removedWorkersCount * avgHeapUsed
        }
      }
    }

    if (totalWorkersCount < this.#maxTotalWorkers) {
      let scaleUpCandidate = null

      for (const { applicationId, workersCount, avgHeapUsed } of appsInfo) {
        const appMaxWorkers = this.#appsConfigs[applicationId]?.maxWorkers ?? this.#maxTotalWorkers
        if (workersCount >= appMaxWorkers) continue
        if (avgHeapUsed >= totalAvailableMemory) continue

        const isScaled = recommendations.some(r => r.applicationId === applicationId)
        if (isScaled) continue

        const recommendation = this.#getApplicationScaleRecommendation(applicationId)
        if (recommendation.recommendation !== 'scaleUp') continue

        if (
          !scaleUpCandidate ||
          recommendation.scaleUpELU > scaleUpCandidate.scaleUpELU ||
          (recommendation.scaleUpELU === scaleUpCandidate.scaleUpELU && workersCount < scaleUpCandidate.workersCount)
        ) {
          scaleUpCandidate = {
            applicationId,
            workersCount,
            heapUsed: recommendation.avgHeapUsage,
            elu: recommendation.scaleUpELU
          }
        }
      }

      if (scaleUpCandidate) {
        recommendations.push({
          applicationId: scaleUpCandidate.applicationId,
          workersCount: scaleUpCandidate.workersCount + 1,
          direction: 'up'
        })
        totalWorkersCount++
        totalAvailableMemory -= scaleUpCandidate.heapUsed
      }
    }

    return recommendations
  }

  #calculateAppAvgMetrics (applicationId, options = {}) {
    this.#removeOutdatedAppELUs(applicationId)

    const appMetrics = this.#appsMetrics[applicationId]
    if (!appMetrics) return { elu: 0, heapUsed: 0 }

    const defaultTimeWindow = this.#getMetricsTimeWindow()
    const timeWindow = options.timeWindow ?? defaultTimeWindow

    let eluSum = 0
    let heapUsedSum = 0
    let count = 0

    const now = Date.now()

    for (const workerId in appMetrics) {
      const workerMetrics = appMetrics[workerId]

      let workerELUSum = 0
      let workerHeapUsedSum = 0
      let metricCount = 0

      for (const metric of workerMetrics) {
        if (metric.timestamp < now - timeWindow) continue
        workerELUSum += metric.elu
        workerHeapUsedSum += metric.heapUsed
        metricCount++
      }

      if (metricCount === 0) continue

      eluSum += workerELUSum / metricCount
      heapUsedSum += workerHeapUsedSum / metricCount
      count++
    }

    const elu = Math.round((eluSum / count) * 100) / 100
    const heapUsed = Math.round((heapUsedSum / count) * 100) / 100
    return { elu, heapUsed }
  }

  #removeOutdatedAppELUs (applicationId) {
    const appELUs = this.#appsMetrics[applicationId]
    if (!appELUs) return

    const now = Date.now()
    const timeWindow = this.#getMetricsTimeWindow()

    for (const workerId in appELUs) {
      const workerELUs = appELUs[workerId]

      let firstValidIndex = -1
      for (let i = 0; i < workerELUs.length; i++) {
        const timestamp = workerELUs[i].timestamp
        if (timestamp >= now - timeWindow) {
          firstValidIndex = i
          break
        }
      }

      if (firstValidIndex > 0) {
        // Remove all outdated entries before the first valid one
        workerELUs.splice(0, firstValidIndex)
      } else if (firstValidIndex === -1) {
        // All entries are outdated, clear the array
        workerELUs.length = 0
      }

      // If there are no more workerELUs, remove the workerId
      if (workerELUs.length === 0) {
        delete appELUs[workerId]
      }
    }
  }

  #getMetricsTimeWindow () {
    return Math.max(scaleUpTimeWindow, scaleDownTimeWindow) * 1000
  }

  #getApplicationScaleRecommendation (applicationId) {
    const { elu: scaleUpELU } = this.#calculateAppAvgMetrics(applicationId, { timeWindow: scaleUpTimeWindow })
    const { elu: scaleDownELU } = this.#calculateAppAvgMetrics(applicationId, { timeWindow: scaleDownTimeWindow })
    const { heapUsed: avgHeapUsage } = this.#calculateAppAvgMetrics(applicationId)

    let recommendation = null
    if (scaleUpELU > this.#scaleUpELU) {
      recommendation = 'scaleUp'
    }
    if (scaleDownELU < this.#scaleDownELU) {
      recommendation = 'scaleDown'
    }

    return { recommendation, scaleUpELU, scaleDownELU, avgHeapUsage }
  }
}
