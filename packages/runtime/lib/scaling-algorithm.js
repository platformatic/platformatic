class ScalingAlgorithm {
  #scaleUpELU
  #scaleDownELU
  #maxWorkers
  #timeWindowSec
  #appsELUs
  #minELUDiff

  constructor (options = {}) {
    this.#scaleUpELU = options.scaleUpELU ?? 0.8
    this.#scaleDownELU = options.scaleDownELU ?? 0.2
    this.#maxWorkers = options.maxWorkers ?? 10
    this.#minELUDiff = options.minELUDiff ?? 0.2
    this.#timeWindowSec = options.timeWindowSec ?? 60

    this.#appsELUs = {}
  }

  addWorkerHealthInfo (healthInfo) {
    const workerId = healthInfo.id
    const applicationId = healthInfo.application
    const elu = healthInfo.currentHealth.elu
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
      const elu = this.#calculateAppELU(applicationId)
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

    for (let i = 0; i < appsInfo.length; i++) {
      const { applicationId, elu, workersCount } = appsInfo[i]

      if (elu < this.#scaleDownELU && workersCount > 1) {
        recommendations.push({
          applicationId,
          workersCount: workersCount - 1,
          direction: 'down'
        })
        totalWorkersCount--
      }
    }

    const scaleUpCandidate = appsInfo.at(-1)
    if (scaleUpCandidate.elu > this.#scaleUpELU) {
      const { applicationId, workersCount } = scaleUpCandidate

      if (totalWorkersCount >= this.#maxWorkers) {
        let scaleDownCandidate = null
        for (const app of appsInfo) {
          if (app.workersCount > 1) {
            scaleDownCandidate = app
            break
          }
        }

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
      } else {
        recommendations.push({
          applicationId,
          workersCount: workersCount + 1,
          direction: 'up'
        })
        totalWorkersCount++
      }
    }

    return recommendations
  }

  #calculateAppELU (applicationId) {
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

    return Math.round(eluSum / eluCount * 100) / 100
  }

  #removeOutdatedAppELUs (applicationId) {
    const appELUs = this.#appsELUs[applicationId]
    if (!appELUs) return

    const now = Date.now()

    for (const workerId in appELUs) {
      const workerELUs = appELUs[workerId]

      for (let i = 0; i < workerELUs.length; i++) {
        const timestamp = workerELUs[i].timestamp
        if (timestamp < now - this.#timeWindowSec * 1000) {
          workerELUs.splice(0, i)
          break
        }
      }

      // If there are no more workerELUs, remove the workerId
      if (workerELUs.length === 0) {
        delete appELUs[workerId]
      }
    }
  }
}

export default ScalingAlgorithm
