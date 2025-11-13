import { strict as assert, deepStrictEqual } from 'node:assert'
import { join } from 'node:path'
import { test } from 'node:test'
import { createRuntime } from '../helpers.js'
import { waitForEvents } from './helper.js'

async function prepareRuntime (t, applicationsId, fixture) {
  const appPath = join(import.meta.dirname, '..', '..', 'fixtures', fixture)
  const runtime = await createRuntime(join(appPath, 'platformatic.json'))
  t.after(async () => {
    await runtime.close()
  })

  await runtime.start()

  const resourcesInfo = {}
  for (const applicationId of applicationsId) {
    resourcesInfo[applicationId] = await runtime.getApplicationResourcesInfo(applicationId)
  }

  return { runtime, resourcesInfo }
}

test('should throw error for invalid parameters of updateApplicationsResources', async t => {
  const appPath = join(import.meta.dirname, '..', '..', 'fixtures', 'update-service-workers')
  const runtime = await createRuntime(join(appPath, 'platformatic.json'))
  t.after(async () => {
    await runtime.close()
  })

  await runtime.start()

  await runtime.updateApplicationsResources([{ application: 'service', workers: 2 }])
  await runtime.updateApplicationsResources([{ application: 'service', workers: 1 }])

  await runtime.getApplicationDetails('service', false)
})

test('should throw error for invalid parameters of updateApplicationsResources', async t => {
  const applicationId = 'node'
  const appPath = join(import.meta.dirname, '..', '..', 'fixtures', 'update-service-workers')
  const runtime = await createRuntime(join(appPath, 'platformatic.json'))
  t.after(async () => {
    await runtime.close()
  })

  await runtime.start()

  try {
    await runtime.updateApplicationsResources([
      {
        application: 'non-existent-service',
        workers: 2
      }
    ])
    assert.fail('Expected error was not thrown')
  } catch (err) {
    assert.equal(
      err.message,
      'Application non-existent-service not found. Available applications are: node, service, composer'
    )
  }

  try {
    await runtime.updateApplicationsResources([
      {
        application: applicationId,
        workers: 0
      }
    ])
    assert.fail('Expected error was not thrown for negative workers')
  } catch (err) {
    assert.equal(err.message, 'Invalid argument: "workers" must be greater than 0')
  }

  try {
    await runtime.updateApplicationsResources([
      {
        application: applicationId,
        workers: 'invalid'
      }
    ])
    assert.fail('Expected error was not thrown for non-numeric workers')
  } catch (err) {
    assert.equal(err.message, 'Invalid argument: "workers" must be a number')
  }

  try {
    await runtime.updateApplicationsResources([])
    assert.fail('Expected error was not thrown for empty array')
  } catch (err) {
    assert.equal(err.message, 'Invalid argument: "updates" must have at least one element')
  }

  try {
    await runtime.updateApplicationsResources([
      {
        workers: 2
      }
    ])
    assert.fail('Expected error was not thrown for missing application')
  } catch (err) {
    assert.equal(err.message, 'Invalid argument: "application" must be a string')
  }

  try {
    await runtime.updateApplicationsResources([
      {
        application: applicationId,
        health: { maxHeapTotal: -1 }
      }
    ])
    assert.fail('Expected error was not thrown for invalid maxHeapTotal')
  } catch (err) {
    assert.equal(err.message, 'Invalid argument: "maxHeapTotal" must be greater than 0')
  }

  try {
    await runtime.updateApplicationsResources([
      {
        application: applicationId,
        health: { maxHeapTotal: 'not-a-memory-size' }
      }
    ])
    assert.fail('Expected error was not thrown for invalid maxHeapTotal')
  } catch (err) {
    assert.equal(err.message, 'Invalid argument: "maxHeapTotal" must be a valid memory size')
  }

  try {
    await runtime.updateApplicationsResources([
      {
        application: applicationId,
        health: {
          maxHeapTotal: false
        }
      }
    ])
    assert.fail('Expected error was not thrown for invalid maxHeapTotal')
  } catch (err) {
    assert.equal(
      err.message,
      'Invalid argument: "maxHeapTotal" must be a number or a string representing a memory size'
    )
  }

  try {
    await runtime.updateApplicationsResources([
      {
        application: applicationId,
        health: { maxYoungGeneration: -1 }
      }
    ])
    assert.fail('Expected error was not thrown for invalid maxYoungGeneration')
  } catch (err) {
    assert.equal(err.message, 'Invalid argument: "maxYoungGeneration" must be greater than 0')
  }

  try {
    await runtime.updateApplicationsResources([
      {
        application: applicationId,
        health: { maxYoungGeneration: 'not-a-memory-size' }
      }
    ])
    assert.fail('Expected error was not thrown for invalid maxYoungGeneration')
  } catch (err) {
    assert.equal(err.message, 'Invalid argument: "maxYoungGeneration" must be a valid memory size')
  }

  try {
    await runtime.updateApplicationsResources([
      {
        application: applicationId,
        health: {
          maxYoungGeneration: false
        }
      }
    ])
    assert.fail('Expected error was not thrown for invalid maxYoungGeneration')
  } catch (err) {
    assert.equal(
      err.message,
      'Invalid argument: "maxYoungGeneration" must be a number or a string representing a memory size'
    )
  }
})

const variations = [1, -1, 2, -2]
for (const variation of variations) {
  test(`should ${variation > 0 ? 'increase' : 'decrease'} multiple applications workers by ${Math.abs(variation)}`, async t => {
    const applicationsId = ['node', 'service']
    const { runtime, resourcesInfo } = await prepareRuntime(t, applicationsId, 'update-service-workers')

    const currentConfig = runtime.getRuntimeConfig()

    const current = {}
    const update = {}
    for (const applicationId of applicationsId) {
      current[applicationId] = currentConfig.applications.find(s => s.id === applicationId)
      update[applicationId] = current[applicationId].workers.static + variation
    }

    for (const applicationId of applicationsId) {
      assert.equal(
        resourcesInfo[applicationId].workers,
        current[applicationId].workers.static,
        `Application "${applicationId}" should have ${current[applicationId].workers} workers on start`
      )
    }

    const applicationsEvents = []
    runtime.on('application:started', event => {
      applicationsEvents.push(event)
    })

    const eventsPromise = waitForEvents(
      runtime,
      ...applicationsId.map(applicationId => {
        if (variation > 0) {
          return { event: 'application:worker:started', application: applicationId, worker: update[applicationId] - 1 }
        } else {
          return { event: 'application:worker:stopped', application: applicationId, worker: update[applicationId] }
        }
      })
    )

    await runtime.updateApplicationsResources([
      ...applicationsId.map(applicationId => ({
        application: applicationId,
        workers: update[applicationId]
      }))
    ])

    await eventsPromise

    for (const applicationId of applicationsId) {
      const info = await runtime.getApplicationResourcesInfo(applicationId)
      assert.equal(
        info.workers,
        update[applicationId],
        `Application "${applicationId}" should have ${update[applicationId]} workers after update`
      )
    }

    deepStrictEqual(applicationsEvents, [])
  })
}

const heapCases = [
  { maxHeapTotal: 512 * 1024 * 1024, maxYoungGeneration: 64 * 1024 * 1024 },
  { maxHeapTotal: '512MB', maxYoungGeneration: '64MB' },
  { maxHeapTotal: '512MB' },
  { maxYoungGeneration: '64MB' }
]

const expectedNewHeap = 512 * 1024 * 1024
const expectedNewYoungGeneration = 64 * 1024 * 1024

function testLabel (newHeapTotal, newYoungGeneration) {
  const label = []
  if (newHeapTotal) {
    label.push(`maxHeapTotal to ${newHeapTotal}`)
  }
  if (newYoungGeneration) {
    label.push(`maxYoungGeneration to ${newYoungGeneration}`)
  }
  return label.join(' and ')
}

for (const heap of heapCases) {
  const newHeapTotal = heap.maxHeapTotal
  const newYoungGeneration = heap.maxYoungGeneration

  test(`should update applications ${testLabel(newHeapTotal, newYoungGeneration)}`, async t => {
    const applicationsId = ['node', 'service']
    const { runtime, resourcesInfo } = await prepareRuntime(t, applicationsId, 'update-service-heap')

    const expectedEvents = []
    for (const applicationId of applicationsId) {
      for (let i = 0; i < resourcesInfo[applicationId].workers; i++) {
        expectedEvents.push({ event: 'application:worker:started', application: applicationId, worker: i })
      }
    }

    const eventsPromise = waitForEvents(runtime, expectedEvents)

    await runtime.updateApplicationsResources([
      ...applicationsId.map(applicationId => ({
        application: applicationId,
        health: { maxHeapTotal: newHeapTotal, maxYoungGeneration: newYoungGeneration }
      }))
    ])

    await eventsPromise

    for (const applicationId of applicationsId) {
      const info = await runtime.getApplicationResourcesInfo(applicationId)
      assert.equal(
        info.workers,
        resourcesInfo[applicationId].workers,
        `Application "${applicationId}" should have same number of workers before and after update`
      )
      if (newHeapTotal) {
        assert.equal(
          info.health.maxHeapTotal,
          expectedNewHeap,
          `Application "${applicationId}" should have ${expectedNewHeap} maxHeapTotal after update`
        )
      }
      if (newYoungGeneration) {
        assert.equal(
          info.health.maxYoungGeneration,
          expectedNewYoungGeneration,
          `Application "${applicationId}" should have ${expectedNewYoungGeneration} maxYoungGeneration after update`
        )
      }
    }
  })

  const variations = [1, -1, 2, -2]
  for (const variation of variations) {
    test(`should update applications ${testLabel(newHeapTotal, newYoungGeneration)} and ${variation > 0 ? 'increase' : 'decrease'} workers by ${Math.abs(variation)} at the same time`, async t => {
      const applicationsId = ['node', 'service']
      const { runtime, resourcesInfo } = await prepareRuntime(t, applicationsId, 'update-service-heap')

      const currentResources = {}
      const updateResources = {}
      for (const applicationId of applicationsId) {
        currentResources[applicationId] = resourcesInfo[applicationId]
        updateResources[applicationId] = {
          workers: currentResources[applicationId].workers + variation,
          health: {
            maxHeapTotal: newHeapTotal,
            maxYoungGeneration: newYoungGeneration
          }
        }
      }
      const expectedReport = applicationsId.map(applicationId => {
        let workerOp, workerValues, updated

        if (variation > 0) {
          workerOp = 'started'
          workerValues = new Array(variation).fill(0).map((_, i) => currentResources[applicationId].workers + i)
          updated = new Array(currentResources[applicationId].workers).fill(0).map((_, i) => i)
        } else {
          workerOp = 'stopped'
          workerValues = new Array(Math.abs(variation))
            .fill(0)
            .map((_, i) => currentResources[applicationId].workers - i - 1)
          updated = new Array(updateResources[applicationId].workers).fill(0).map((_, i) => i)
        }

        const expectedHealth = {}
        if (newHeapTotal) {
          expectedHealth.maxHeapTotal = expectedNewHeap
        }
        if (newYoungGeneration) {
          expectedHealth.maxYoungGeneration = expectedNewYoungGeneration
        }

        return {
          application: applicationId,
          workers: {
            current: currentResources[applicationId].workers,
            new: updateResources[applicationId].workers,
            [workerOp]: workerValues,
            success: true
          },
          health: {
            current: currentResources[applicationId].health,
            new: expectedHealth,
            updated,
            success: true
          }
        }
      })

      const expectedEvents = []
      for (const applicationId of applicationsId) {
        if (variation > 0) {
          expectedEvents.push({
            event: 'application:worker:started',
            application: applicationId,
            worker: updateResources[applicationId].workers - 1
          })
        } else {
          expectedEvents.push({
            event: 'application:worker:stopped',
            application: applicationId,
            worker: updateResources[applicationId].workers
          })
        }
      }

      const eventsPromise = waitForEvents(runtime, expectedEvents)

      const report = await runtime.updateApplicationsResources([
        ...applicationsId.map(applicationId => ({
          application: applicationId,
          workers: updateResources[applicationId].workers,
          health: updateResources[applicationId].health
        }))
      ])

      await eventsPromise

      assert.deepEqual(report, expectedReport, 'Report should be equal to expected report')

      for (const applicationId of applicationsId) {
        const info = await runtime.getApplicationResourcesInfo(applicationId)
        assert.equal(
          info.workers,
          updateResources[applicationId].workers,
          `Application "${applicationId}" should have ${updateResources[applicationId].workers} workers after update`
        )
        if (newHeapTotal) {
          assert.equal(
            info.health.maxHeapTotal,
            expectedNewHeap,
            `Application "${applicationId}" should have ${expectedNewHeap} maxHeapTotal after update`
          )
        }
        if (newYoungGeneration) {
          assert.equal(
            info.health.maxYoungGeneration,
            expectedNewYoungGeneration,
            `Application "${applicationId}" should have ${expectedNewYoungGeneration} maxYoungGeneration after update`
          )
        }
      }
    })
  }

  test(`should update only ${testLabel(newHeapTotal, newYoungGeneration)} because workers are the same as current ones`, async t => {
    const applicationsId = ['node', 'service']
    const { runtime, resourcesInfo } = await prepareRuntime(t, applicationsId, 'update-service-heap')

    const currentResources = {}
    const updateResources = {}
    for (const applicationId of applicationsId) {
      currentResources[applicationId] = resourcesInfo[applicationId]
      updateResources[applicationId] = {
        health: {
          maxHeapTotal: newHeapTotal,
          maxYoungGeneration: newYoungGeneration
        }
      }
    }

    const applicationsEvents = []
    runtime.on('application:started', event => {
      applicationsEvents.push(event)
    })

    const events = []
    for (const applicationId of applicationsId) {
      events.push({ event: 'application:worker:started', application: applicationId, worker: 0 })
    }
    const eventsPromise = waitForEvents(runtime, events)

    await runtime.updateApplicationsResources([
      ...applicationsId.map(applicationId => ({
        application: applicationId,
        workers: currentResources[applicationId].workers,
        health: updateResources[applicationId].health
      }))
    ])

    await eventsPromise

    for (const applicationId of applicationsId) {
      const info = await runtime.getApplicationResourcesInfo(applicationId)
      assert.equal(
        info.workers,
        currentResources[applicationId].workers,
        `Application "${applicationId}" should have ${currentResources[applicationId].workers} workers after update`
      )

      if (newHeapTotal) {
        assert.equal(
          info.health.maxHeapTotal,
          expectedNewHeap,
          `Application "${applicationId}" should have ${expectedNewHeap} maxHeapTotal after update`
        )
      }
      if (newYoungGeneration) {
        assert.equal(
          info.health.maxYoungGeneration,
          expectedNewYoungGeneration,
          `Application "${applicationId}" should have ${expectedNewYoungGeneration} maxYoungGeneration after update`
        )
      }
    }

    deepStrictEqual(applicationsEvents, [])
  })
}

test('should report on failures', async t => {
  const { runtime } = await prepareRuntime(t, ['node'], 'update-service-failure')

  const report = await runtime.updateApplicationsResources([
    {
      application: 'node',
      workers: 3,
      health: {
        maxHeapTotal: '512MB'
      }
    }
  ])

  assert.deepEqual(report, [
    {
      application: 'node',
      workers: {
        current: 1,
        new: 3,
        started: [1],
        success: false
      },
      health: {
        current: {
          enabled: true,
          interval: 30000,
          gracePeriod: 30000,
          maxUnhealthyChecks: 10,
          maxELU: 0.99,
          maxHeapUsed: 0.99,
          maxHeapTotal: 536870912,
          maxYoungGeneration: 134217728
        },
        new: {
          maxHeapTotal: 536870912
        },
        updated: [0],
        success: true
      }
    }
  ])
})
