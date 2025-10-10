import assert from 'node:assert'
import { test } from 'node:test'
import ScalingAlgorithm from '../lib/scaling-algorithm.js'

test('ScalingAlgorithm - should scale down if app ELUs are lower the treshold', async () => {
  const scaleDownELU = 0.2
  const scalingAlgorithm = new ScalingAlgorithm()

  const applicationId = 'app-1'
  const workersCount = 2

  const { appsWorkersInfo, healthInfo } = generateMetadata([
    { applicationId, maxELU: scaleDownELU, workersCount }
  ])

  for (const health of healthInfo) {
    scalingAlgorithm.addWorkerHealthInfo(health)
  }

  const recommendations = scalingAlgorithm.getRecommendations(appsWorkersInfo)
  assert.strictEqual(recommendations.length, 1)

  const recommendation = recommendations[0]
  assert.strictEqual(recommendation.applicationId, applicationId)
  assert.strictEqual(recommendation.workersCount, 1)
  assert.strictEqual(recommendation.direction, 'down')
})

test('ScalingAlgorithm - should not scale down if there is 1 worker', async () => {
  const scaleDownELU = 0.2
  const scalingAlgorithm = new ScalingAlgorithm({ scaleDownELU })

  const applicationId = 'app-1'

  const { appsWorkersInfo, healthInfo } = generateMetadata([
    { applicationId, maxELU: scaleDownELU, workersCount: 1 }
  ])

  for (const health of healthInfo) {
    scalingAlgorithm.addWorkerHealthInfo(health)
  }

  const recommendations = scalingAlgorithm.getRecommendations(appsWorkersInfo)
  assert.strictEqual(recommendations.length, 0)
})

test('ScalingAlgorithm - should scale up if the max workers is reached', async () => {
  const maxTotalWorkers = 2
  const scalingAlgorithm = new ScalingAlgorithm({ maxTotalWorkers })

  const applicationId = 'app-1'
  const workersCount = maxTotalWorkers

  const { appsWorkersInfo, healthInfo } = generateMetadata([
    { applicationId, maxELU: 1, workersCount }
  ])

  for (const health of healthInfo) {
    scalingAlgorithm.addWorkerHealthInfo(health)
  }

  const recommendations = scalingAlgorithm.getRecommendations(appsWorkersInfo)
  assert.strictEqual(recommendations.length, 0)
})

test('ScalingAlgorithm - should scale up if elu is higher than treshold', async () => {
  const scaleUpELU = 0.8
  const scalingAlgorithm = new ScalingAlgorithm({ scaleUpELU })

  const applicationId = 'app-1'

  const { appsWorkersInfo, healthInfo } = generateMetadata([
    { applicationId, minELU: scaleUpELU, workersCount: 1 }
  ])

  for (const health of healthInfo) {
    scalingAlgorithm.addWorkerHealthInfo(health)
  }

  const recommendations = scalingAlgorithm.getRecommendations(appsWorkersInfo)
  assert.strictEqual(recommendations.length, 1)

  const recommendation = recommendations[0]
  assert.strictEqual(recommendation.applicationId, applicationId)
  assert.strictEqual(recommendation.workersCount, 2)
  assert.strictEqual(recommendation.direction, 'up')
})

test('ScalingAlgorithm - should not scale if elu is between tresholds', async () => {
  const scaleDownELU = 0.2
  const scaleUpELU = 0.8
  const scalingAlgorithm = new ScalingAlgorithm({ scaleDownELU, scaleUpELU })

  const applicationId = 'app-1'

  const { appsWorkersInfo, healthInfo } = generateMetadata([
    {
      applicationId,
      minELU: scaleDownELU,
      maxELU: scaleUpELU,
      workersCount: 1
    }
  ])

  for (const health of healthInfo) {
    scalingAlgorithm.addWorkerHealthInfo(health)
  }

  const recommendations = scalingAlgorithm.getRecommendations(appsWorkersInfo)
  assert.strictEqual(recommendations.length, 0)
})

test('ScalingAlgorithm - should scale up only one app per recommendation', async () => {
  const scaleUpELU = 0.8
  const scalingAlgorithm = new ScalingAlgorithm({ scaleUpELU })

  const { appsWorkersInfo, healthInfo } = generateMetadata([
    { applicationId: 'app-1', minELU: scaleUpELU, workersCount: 1 },
    { applicationId: 'app-2', minELU: scaleUpELU, workersCount: 1 },
    { applicationId: 'app-3', minELU: scaleUpELU, workersCount: 1 },
  ])

  for (const health of healthInfo) {
    scalingAlgorithm.addWorkerHealthInfo(health)
  }

  const recommendations = scalingAlgorithm.getRecommendations(appsWorkersInfo)
  assert.strictEqual(recommendations.length, 1)

  const recommendation = recommendations[0]
  assert.strictEqual(recommendation.workersCount, 2)
  assert.strictEqual(recommendation.direction, 'up')
})

test('ScalingAlgorithm - should not scale up there is not enough workers', async () => {
  const scaleUpELU = 0.8
  const scaleDownELU = 0.2
  const maxTotalWorkers = 8

  const scalingAlgorithm = new ScalingAlgorithm({
    scaleUpELU,
    scaleDownELU,
    maxTotalWorkers
  })

  const { appsWorkersInfo, healthInfo } = generateMetadata([
    { applicationId: 'app-1', elu: 0.99, workersCount: 2 },
    { applicationId: 'app-2', elu: 0.95, workersCount: 2 },
    { applicationId: 'app-3', elu: 0.6, workersCount: 2 },
    { applicationId: 'app-4', elu: 0.4, workersCount: 2 },
  ])

  for (const health of healthInfo) {
    scalingAlgorithm.addWorkerHealthInfo(health)
  }

  const recommendations = scalingAlgorithm.getRecommendations(appsWorkersInfo)
  assert.strictEqual(recommendations.length, 0)
})

test('ScalingAlgorithm - should scale down many apps per recommendation', async () => {
  const scaleDownELU = 0.2
  const scalingAlgorithm = new ScalingAlgorithm({ scaleDownELU })

  const appsCount = 3
  const workersCount = 4

  const { appsWorkersInfo, healthInfo } = generateMetadata([
    { applicationId: 'app-1', maxELU: scaleDownELU, workersCount },
    { applicationId: 'app-2', maxELU: scaleDownELU, workersCount },
    { applicationId: 'app-3', maxELU: scaleDownELU, workersCount },
  ])

  for (const health of healthInfo) {
    scalingAlgorithm.addWorkerHealthInfo(health)
  }

  const recommendations = scalingAlgorithm.getRecommendations(appsWorkersInfo)
  assert.strictEqual(recommendations.length, appsCount)

  for (let i = 1; i <= appsCount; i++) {
    const recommendation = recommendations.find((r) => r.applicationId === `app-${i}`)
    assert.strictEqual(recommendation.workersCount, workersCount - 1)
    assert.strictEqual(recommendation.direction, 'down')
  }
})

test('ScalingAlgorithm - should not scale if the application max workers is reached', async () => {
  const scalingAlgorithm = new ScalingAlgorithm({
    maxTotalWorkers: 10,
    applications: {
      'app-1': {
        maxWorkers: 5
      }
    }
  })

  const { appsWorkersInfo, healthInfo } = generateMetadata([
    { applicationId: 'app-1', elu: 1, workersCount: 5 },
    { applicationId: 'app-2', elu: 0.95, workersCount: 3 }
  ])

  for (const health of healthInfo) {
    scalingAlgorithm.addWorkerHealthInfo(health)
  }

  const recommendations = scalingAlgorithm.getRecommendations(appsWorkersInfo)
  assert.strictEqual(recommendations.length, 1)

  const recommendation = recommendations[0]

  // The app-1 is not scaled because it has max workers
  // even if the elu is higher than the app-2
  // The app-2 is scaled instead
  assert.strictEqual(recommendation.applicationId, 'app-2')
  assert.strictEqual(recommendation.workersCount, 4)
  assert.strictEqual(recommendation.direction, 'up')
})

test('ScalingAlgorithm - should scale up apps to their min workers if the actual workers count is lower', async () => {
  const scalingAlgorithm = new ScalingAlgorithm({
    scaleUpELU: 0.8,
    minWorkers: 2,
    applications: {
      'app-1': { minWorkers: 2 },
      'app-2': { minWorkers: 3 },
      'app-3': { minWorkers: 4 }
    }
  })

  const { appsWorkersInfo, healthInfo } = generateMetadata([
    { applicationId: 'app-1', elu: 1, workersCount: 1 },
    { applicationId: 'app-2', elu: 1, workersCount: 1 },
    { applicationId: 'app-3', elu: 1, workersCount: 1 }
  ])

  for (const health of healthInfo) {
    scalingAlgorithm.addWorkerHealthInfo(health)
  }

  const recommendations = scalingAlgorithm.getRecommendations(appsWorkersInfo)
  assert.strictEqual(recommendations.length, 3)

  const scaleUpRecommendation = recommendations[0]
  assert.strictEqual(scaleUpRecommendation.applicationId, 'app-1')
  assert.strictEqual(scaleUpRecommendation.workersCount, 2)
  assert.strictEqual(scaleUpRecommendation.direction, 'up')

  const scaleUpRecommendation2 = recommendations[1]
  assert.strictEqual(scaleUpRecommendation2.applicationId, 'app-2')
  assert.strictEqual(scaleUpRecommendation2.workersCount, 3)
  assert.strictEqual(scaleUpRecommendation2.direction, 'up')

  const scaleUpRecommendation3 = recommendations[2]
  assert.strictEqual(scaleUpRecommendation3.applicationId, 'app-3')
  assert.strictEqual(scaleUpRecommendation3.workersCount, 4)
  assert.strictEqual(scaleUpRecommendation3.direction, 'up')
})

test('ScalingAlgorithm - should not scale if there is not enough memory', async () => {
  const scalingAlgorithm = new ScalingAlgorithm({ scaleUpELU: 0.8 })

  const { appsWorkersInfo, healthInfo } = generateMetadata([
    { applicationId: 'app-1', elu: 1, heapUsed: 1000, workersCount: 1 },
    { applicationId: 'app-2', elu: 1, heapUsed: 1000, workersCount: 1 },
    { applicationId: 'app-3', elu: 1, heapUsed: 1000, workersCount: 1 }
  ])

  for (const health of healthInfo) {
    scalingAlgorithm.addWorkerHealthInfo(health)
  }

  const recommendations = scalingAlgorithm.getRecommendations(appsWorkersInfo, {
    availableMemory: 500
  })
  assert.strictEqual(recommendations.length, 0)
})

test('ScalingAlgorithm - should scale an application that has enough memory', async () => {
  const scalingAlgorithm = new ScalingAlgorithm({ scaleUpELU: 0.8 })

  const { appsWorkersInfo, healthInfo } = generateMetadata([
    { applicationId: 'app-1', elu: 1, heapUsed: 2000, workersCount: 1 },
    { applicationId: 'app-2', elu: 1, heapUsed: 1000, workersCount: 1 },
    { applicationId: 'app-3', elu: 1, heapUsed: 3000, workersCount: 1 }
  ])

  for (const health of healthInfo) {
    scalingAlgorithm.addWorkerHealthInfo(health)
  }

  const recommendations = scalingAlgorithm.getRecommendations(appsWorkersInfo, {
    availableMemory: 1200
  })
  assert.strictEqual(recommendations.length, 1)

  const recommendation = recommendations[0]
  assert.strictEqual(recommendation.applicationId, 'app-2')
  assert.strictEqual(recommendation.workersCount, 2)
  assert.strictEqual(recommendation.direction, 'up')
})

function randomFloat (min, max) {
  return Math.random() * (max - min) + min
}

function generateMetadata (apps = []) {
  const healthInfo = []
  const appsWorkersInfo = {}

  for (const app of apps) {
    const elu = app.elu
    const minELU = app.minELU ?? 0
    const maxELU = app.maxELU ?? 1
    const heapUsed = app.heapUsed ?? 1000
    const applicationId = app.applicationId

    const workersCount = app.workersCount ?? 1
    for (let i = 0; i < workersCount; i++) {
      const workerId = `worker-${i}`

      for (let j = 0; j < 10; j++) {
        const workerELU = elu ?? randomFloat(minELU, maxELU)
        const workerHealthInfo = generateHealthInfo({
          id: workerId,
          applicationId,
          elu: workerELU,
          heapUsed
        })
        healthInfo.push(workerHealthInfo)
      }
    }

    appsWorkersInfo[applicationId] = workersCount
  }

  return { healthInfo, appsWorkersInfo }
}

function generateHealthInfo (options = {}) {
  return {
    workerId: options.id ?? 'worker-1',
    applicationId: options.applicationId ?? 'app-1',
    elu: options.elu ?? 0.1,
    heapUsed: options.heapUsed ?? 1000
  }
}
