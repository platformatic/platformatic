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
  const maxWorkers = 2
  const scalingAlgorithm = new ScalingAlgorithm({ maxWorkers })

  const applicationId = 'app-1'
  const workersCount = maxWorkers

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

test('ScalingAlgorithm - should scale up the worth application and sclale down the best', async () => {
  const scaleUpELU = 0.8
  const scaleDownELU = 0.2
  const maxWorkers = 8

  const scalingAlgorithm = new ScalingAlgorithm({
    scaleUpELU,
    scaleDownELU,
    maxWorkers
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
  assert.strictEqual(recommendations.length, 2)

  const scaleDownRecommendation = recommendations[0]
  assert.strictEqual(scaleDownRecommendation.applicationId, 'app-4')
  assert.strictEqual(scaleDownRecommendation.workersCount, 1)
  assert.strictEqual(scaleDownRecommendation.direction, 'down')

  const scaleUpRecommendation = recommendations[1]
  assert.strictEqual(scaleUpRecommendation.applicationId, 'app-1')
  assert.strictEqual(scaleUpRecommendation.workersCount, 3)
  assert.strictEqual(scaleUpRecommendation.direction, 'up')
})

test('ScalingAlgorithm - should scale down app with more pods if elu are equal', async () => {
  const scaleUpELU = 0.8
  const scaleDownELU = 0.2
  const maxWorkers = 8

  const scalingAlgorithm = new ScalingAlgorithm({
    scaleUpELU,
    scaleDownELU,
    maxWorkers
  })

  const { appsWorkersInfo, healthInfo } = generateMetadata([
    { applicationId: 'app-1', elu: 0.99, workersCount: 7 },
    { applicationId: 'app-2', elu: 0.99, workersCount: 1 },
  ])

  for (const health of healthInfo) {
    scalingAlgorithm.addWorkerHealthInfo(health)
  }

  const recommendations = scalingAlgorithm.getRecommendations(appsWorkersInfo)
  assert.strictEqual(recommendations.length, 2)

  const scaleDownRecommendation = recommendations[0]
  assert.strictEqual(scaleDownRecommendation.applicationId, 'app-1')
  assert.strictEqual(scaleDownRecommendation.workersCount, 6)
  assert.strictEqual(scaleDownRecommendation.direction, 'down')

  const scaleUpRecommendation = recommendations[1]
  assert.strictEqual(scaleUpRecommendation.applicationId, 'app-2')
  assert.strictEqual(scaleUpRecommendation.workersCount, 2)
  assert.strictEqual(scaleUpRecommendation.direction, 'up')
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
    id: options.id ?? 'worker-1',
    application: options.applicationId ?? 'app-1',
    currentHealth: {
      elu: options.elu ?? 0.1,
      heapUsed: 1024,
      heapTotal: 2048
    },
    unhealthy: false,
    healthConfig: {
      enabled: true,
      interval: 1000,
      gracePeriod: 1000,
      maxUnhealthyChecks: 10,
      maxELU: 0.99,
      maxHeapUsed: 0.99,
      maxHeapTotal: 4294967296
    }
  }
}
