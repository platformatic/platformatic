class ScalingAlgorithm {
  #scaleUpELU
  #scaleDownELU
  #maxTotalWorkers
  #timeWindowSec
  #appsELUs
  #minELUDiff
  #appsConfigs

  constructor (options = {}) {
    this.#scaleUpELU = options.scaleUpELU ?? 0.8
    this.#scaleDownELU = options.scaleDownELU ?? 0.2
    this.#maxTotalWorkers = options.maxTotalWorkers
    this.#minELUDiff = options.minELUDiff ?? 0.2
    this.#timeWindowSec = options.timeWindowSec ?? 60
    this.#appsConfigs = options.applications ?? {}

    this.#appsELUs = {}
  }

  addWorkerHealthInfo (healthInfo) {
    const { workerId, applicationId, elu } = healthInfo
    const timestamp = Date.now()

    if (!this.#appsELUs[applicationId]) {
      this.#appsELUs[applicationId] = {}
    }
    if (!this.#appsELUs[applicationId][workerId]) {
      this.#appsELUs[applicationId][workerId] = []
    }
    this.#appsELUs[applicationId][workerId].push({ elu, timestamp })
    this.#removeOutdatedAppELUs(applicationId)
  }

  getRecommendations (appsWorkersInfo) {
    let totalWorkersCount = 0
    let appsInfo = []

    for (const applicationId in appsWorkersInfo) {
      const workersCount = appsWorkersInfo[applicationId]
      const elu = this.#calculateAppAvgELU(applicationId)
      appsInfo.push({ applicationId, workersCount, elu })
      totalWorkersCount += workersCount
    }

    appsInfo = appsInfo.sort(
      (app1, app2) => {
        if (app1.elu > app2.elu) return 1
        if (app1.elu < app2.elu) return -1
        if (app1.workersCount < app2.workersCount) return 1
        if (app1.workersCount > app2.workersCount) return -1
        return 0
      }
    )

    const recommendations = []

    for (const { applicationId, elu, workersCount } of appsInfo) {
      const appMinWorkers = this.#appsConfigs[applicationId]?.minWorkers ?? 1
      const appMaxWorkers = this.#appsConfigs[applicationId]?.maxWorkers ?? this.#maxTotalWorkers

      if (workersCount < appMinWorkers) {
        recommendations.push({
          applicationId,
          workersCount: appMinWorkers,
          direction: 'up'
        })
        totalWorkersCount += appMinWorkers - workersCount
        continue
      }

      if (workersCount > appMaxWorkers) {
        recommendations.push({
          applicationId,
          workersCount: appMaxWorkers,
          direction: 'down'
        })
        totalWorkersCount -= workersCount - appMaxWorkers
        continue
      }

      if (elu < this.#scaleDownELU && workersCount > appMinWorkers) {
        recommendations.push({
          applicationId,
          workersCount: workersCount - 1,
          direction: 'down'
        })
        totalWorkersCount--
      }
    }

    for (const scaleUpCandidate of appsInfo.toReversed()) {
      if (scaleUpCandidate.elu < this.#scaleUpELU) break

      const { applicationId, workersCount } = scaleUpCandidate

      const isScaled = recommendations.some(
        r => r.applicationId === applicationId
          && r.direction === 'up'
      )
      if (isScaled) continue

      const appMaxWorkers = this.#appsConfigs[applicationId]?.maxWorkers ?? this.#maxTotalWorkers
      if (workersCount >= appMaxWorkers) continue

      if (totalWorkersCount >= this.#maxTotalWorkers) {
        let scaleDownCandidate = null
        for (const app of appsInfo) {
          const appMinWorkers = this.#appsConfigs[app.applicationId]?.minWorkers ?? 1
          if (app.workersCount > appMinWorkers) {
            scaleDownCandidate = app
            break
          }
        }

        if (scaleDownCandidate) {
          const eluDiff = scaleUpCandidate.elu - scaleDownCandidate.elu
          const workersDiff = scaleDownCandidate.workersCount - scaleUpCandidate.workersCount

          if (eluDiff >= this.#minELUDiff || workersDiff >= 2) {
            recommendations.push({
              applicationId: scaleDownCandidate.applicationId,
              workersCount: scaleDownCandidate.workersCount - 1,
              direction: 'down'
            })
            recommendations.push({
              applicationId,
              workersCount: workersCount + 1,
              direction: 'up'
            })
          }
        }
      } else {
        recommendations.push({
          applicationId,
          workersCount: workersCount + 1,
          direction: 'up'
        })
        totalWorkersCount++
      }
      break
    }

    return recommendations
  }

  #calculateAppAvgELU (applicationId) {
    this.#removeOutdatedAppELUs(applicationId)

    const appELUs = this.#appsELUs[applicationId]
    if (!appELUs) return 0

    let eluSum = 0
    let eluCount = 0

    for (const workerId in appELUs) {
      const workerELUs = appELUs[workerId]
      const workerELUSum = workerELUs.reduce(
        (sum, workerELU) => sum + workerELU.elu, 0
      )
      eluSum += workerELUSum / workerELUs.length
      eluCount++
    }

    if (eluCount === 0) return 0

    return Math.round(eluSum / eluCount * 100) / 100
  }

  #removeOutdatedAppELUs (applicationId) {
    const appELUs = this.#appsELUs[applicationId]
    if (!appELUs) return

    const now = Date.now()

    for (const workerId in appELUs) {
      const workerELUs = appELUs[workerId]

      let firstValidIndex = -1
      for (let i = 0; i < workerELUs.length; i++) {
        const timestamp = workerELUs[i].timestamp
        if (timestamp >= now - this.#timeWindowSec * 1000) {
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
}

export default ScalingAlgorithm
