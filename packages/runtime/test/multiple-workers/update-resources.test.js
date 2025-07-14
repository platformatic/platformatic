'use strict'

const { strict: assert, deepStrictEqual } = require('node:assert')
const { test } = require('node:test')
const path = require('node:path')
const { create } = require('../..')
const { setLogFile } = require('../helpers')
const { waitForEvents } = require('./helper')

test.beforeEach(setLogFile)

async function prepareRuntime (t, servicesId, fixture) {
  const appPath = path.join(__dirname, '..', '..', 'fixtures', fixture)
  const runtime = await create(path.join(appPath, 'platformatic.json'))
  t.after(async () => {
    await runtime.close(true)
  })

  await runtime.start()

  const resourcesInfo = {}
  for (const serviceId of servicesId) {
    resourcesInfo[serviceId] = await runtime.getServiceResourcesInfo(serviceId)
  }

  return { runtime, resourcesInfo }
}

test('should throw error for invalid parameters of updateServicesResources', async t => {
  const serviceId = 'node'
  const appPath = path.join(__dirname, '..', '..', 'fixtures', 'update-service-workers')
  const runtime = await create(path.join(appPath, 'platformatic.json'))
  t.after(async () => {
    await runtime.close()
  })

  await runtime.start()

  try {
    await runtime.updateServicesResources([
      {
        service: 'non-existent-service',
        workers: 2
      }
    ])
    assert.fail('Expected error was not thrown')
  } catch (err) {
    assert.equal(err.message, 'Service non-existent-service not found. Available services are: node, service, composer')
  }

  try {
    await runtime.updateServicesResources([
      {
        service: serviceId,
        workers: 0
      }
    ])
    assert.fail('Expected error was not thrown for negative workers')
  } catch (err) {
    assert.equal(err.message, 'Invalid argument: "workers" must be greater than 0')
  }

  try {
    await runtime.updateServicesResources([
      {
        service: serviceId,
        workers: 'invalid'
      }
    ])
    assert.fail('Expected error was not thrown for non-numeric workers')
  } catch (err) {
    assert.equal(err.message, 'Invalid argument: "workers" must be a number')
  }

  try {
    await runtime.updateServicesResources([])
    assert.fail('Expected error was not thrown for empty array')
  } catch (err) {
    assert.equal(err.message, 'Invalid argument: "updates" must have at least one element')
  }

  try {
    await runtime.updateServicesResources([
      {
        workers: 2
      }
    ])
    assert.fail('Expected error was not thrown for missing service')
  } catch (err) {
    assert.equal(err.message, 'Invalid argument: "service" must be a string')
  }

  try {
    await runtime.updateServicesResources([
      {
        service: serviceId,
        health: { maxHeapTotal: -1 }
      }
    ])
    assert.fail('Expected error was not thrown for invalid maxHeapTotal')
  } catch (err) {
    assert.equal(err.message, 'Invalid argument: "maxHeapTotal" must be greater than 0')
  }

  try {
    await runtime.updateServicesResources([
      {
        service: serviceId,
        health: { maxHeapTotal: 'not-a-memory-size' }
      }
    ])
    assert.fail('Expected error was not thrown for invalid maxHeapTotal')
  } catch (err) {
    assert.equal(err.message, 'Invalid argument: "maxHeapTotal" must be a valid memory size')
  }

  try {
    await runtime.updateServicesResources([
      {
        service: serviceId,
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
    await runtime.updateServicesResources([
      {
        service: serviceId,
        health: { maxYoungGeneration: -1 }
      }
    ])
    assert.fail('Expected error was not thrown for invalid maxYoungGeneration')
  } catch (err) {
    assert.equal(err.message, 'Invalid argument: "maxYoungGeneration" must be greater than 0')
  }

  try {
    await runtime.updateServicesResources([
      {
        service: serviceId,
        health: { maxYoungGeneration: 'not-a-memory-size' }
      }
    ])
    assert.fail('Expected error was not thrown for invalid maxYoungGeneration')
  } catch (err) {
    assert.equal(err.message, 'Invalid argument: "maxYoungGeneration" must be a valid memory size')
  }

  try {
    await runtime.updateServicesResources([
      {
        service: serviceId,
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
  test(`should ${variation > 0 ? 'increase' : 'decrease'} multiple services workers by ${Math.abs(variation)}`, async t => {
    const servicesId = ['node', 'service']
    const { runtime, resourcesInfo } = await prepareRuntime(t, servicesId, 'update-service-workers')

    const currentConfig = runtime.getRuntimeConfig()

    const current = {}
    const update = {}
    for (const serviceId of servicesId) {
      current[serviceId] = currentConfig.services.find(s => s.id === serviceId)
      update[serviceId] = current[serviceId].workers + variation
    }

    for (const serviceId of servicesId) {
      assert.equal(
        resourcesInfo[serviceId].workers,
        current[serviceId].workers,
        `Service "${serviceId}" should have ${current[serviceId].workers} workers on start`
      )
    }

    const servicesEvents = []
    runtime.on('service:started', event => {
      servicesEvents.push(event)
    })

    const eventsPromise = waitForEvents(
      runtime,
      ...servicesId.map(serviceId => {
        if (variation > 0) {
          return { event: 'service:worker:started', service: serviceId, worker: update[serviceId] - 1 }
        } else {
          return { event: 'service:worker:stopped', service: serviceId, worker: update[serviceId] }
        }
      })
    )

    await runtime.updateServicesResources([
      ...servicesId.map(serviceId => ({
        service: serviceId,
        workers: update[serviceId]
      }))
    ])

    await eventsPromise

    for (const serviceId of servicesId) {
      const info = await runtime.getServiceResourcesInfo(serviceId)
      assert.equal(
        info.workers,
        update[serviceId],
        `Service "${serviceId}" should have ${update[serviceId]} workers after update`
      )
    }

    deepStrictEqual(servicesEvents, [])
  })
}

const heapCases = [
  { maxHeapTotal: 512 * 1024 * 1024, maxYoungGeneration: 128 * 1024 * 1024 },
  { maxHeapTotal: '512MB', maxYoungGeneration: '128MB' },
  { maxHeapTotal: '512MB' },
  { maxYoungGeneration: '128MB' }
]

const expectedNewHeap = 512 * 1024 * 1024
const expectedNewYoungGeneration = 128 * 1024 * 1024

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

  test(`should update services ${testLabel(newHeapTotal, newYoungGeneration)}`, async t => {
    const servicesId = ['node', 'service']
    const { runtime, resourcesInfo } = await prepareRuntime(t, servicesId, 'update-service-heap')

    const expectedEvents = []
    for (const serviceId of servicesId) {
      for (let i = 0; i < resourcesInfo[serviceId].workers; i++) {
        expectedEvents.push({ event: 'service:worker:started', service: serviceId, worker: i })
      }
    }

    const eventsPromise = waitForEvents(runtime, expectedEvents)

    await runtime.updateServicesResources([
      ...servicesId.map(serviceId => ({
        service: serviceId,
        health: { maxHeapTotal: newHeapTotal, maxYoungGeneration: newYoungGeneration }
      }))
    ])

    await eventsPromise

    for (const serviceId of servicesId) {
      const info = await runtime.getServiceResourcesInfo(serviceId)
      assert.equal(
        info.workers,
        resourcesInfo[serviceId].workers,
        `Service "${serviceId}" should have same number of workers before and after update`
      )
      if (newHeapTotal) {
        assert.equal(
          info.health.maxHeapTotal,
          expectedNewHeap,
          `Service "${serviceId}" should have ${expectedNewHeap} maxHeapTotal after update`
        )
      }
      if (newYoungGeneration) {
        assert.equal(
          info.health.maxYoungGeneration,
          expectedNewYoungGeneration,
          `Service "${serviceId}" should have ${expectedNewYoungGeneration} maxYoungGeneration after update`
        )
      }
    }
  })

  const variations = [1, -1, 2, -2]
  for (const variation of variations) {
    test(`should update services ${testLabel(newHeapTotal, newYoungGeneration)} and ${variation > 0 ? 'increase' : 'decrease'} workers by ${Math.abs(variation)} at the same time`, async t => {
      const servicesId = ['node', 'service']
      const { runtime, resourcesInfo } = await prepareRuntime(t, servicesId, 'update-service-heap')

      const currentResources = {}
      const updateResources = {}
      for (const serviceId of servicesId) {
        currentResources[serviceId] = resourcesInfo[serviceId]
        updateResources[serviceId] = {
          workers: currentResources[serviceId].workers + variation,
          health: {
            maxHeapTotal: newHeapTotal,
            maxYoungGeneration: newYoungGeneration
          }
        }
      }
      const expectedReport = servicesId.map(serviceId => {
        let workerOp, workerValues, updated

        if (variation > 0) {
          workerOp = 'started'
          workerValues = new Array(variation).fill(0).map((_, i) => currentResources[serviceId].workers + i)
          updated = new Array(currentResources[serviceId].workers).fill(0).map((_, i) => i)
        } else {
          workerOp = 'stopped'
          workerValues = new Array(Math.abs(variation))
            .fill(0)
            .map((_, i) => currentResources[serviceId].workers - i - 1)
          updated = new Array(updateResources[serviceId].workers).fill(0).map((_, i) => i)
        }

        const expectedHealth = {}
        if (newHeapTotal) {
          expectedHealth.maxHeapTotal = expectedNewHeap
        }
        if (newYoungGeneration) {
          expectedHealth.maxYoungGeneration = expectedNewYoungGeneration
        }

        return {
          service: serviceId,
          workers: {
            current: currentResources[serviceId].workers,
            new: updateResources[serviceId].workers,
            [workerOp]: workerValues,
            success: true
          },
          health: {
            current: currentResources[serviceId].health,
            new: expectedHealth,
            updated,
            success: true
          }
        }
      })

      const expectedEvents = []
      for (const serviceId of servicesId) {
        if (variation > 0) {
          expectedEvents.push({
            event: 'service:worker:started',
            service: serviceId,
            worker: updateResources[serviceId].workers - 1
          })
        } else {
          expectedEvents.push({
            event: 'service:worker:stopped',
            service: serviceId,
            worker: updateResources[serviceId].workers
          })
        }
      }

      const eventsPromise = waitForEvents(runtime, expectedEvents)

      const report = await runtime.updateServicesResources([
        ...servicesId.map(serviceId => ({
          service: serviceId,
          workers: updateResources[serviceId].workers,
          health: updateResources[serviceId].health
        }))
      ])

      await eventsPromise

      assert.deepEqual(report, expectedReport, 'Report should be equal to expected report')

      for (const serviceId of servicesId) {
        const info = await runtime.getServiceResourcesInfo(serviceId)
        assert.equal(
          info.workers,
          updateResources[serviceId].workers,
          `Service "${serviceId}" should have ${updateResources[serviceId].workers} workers after update`
        )
        if (newHeapTotal) {
          assert.equal(
            info.health.maxHeapTotal,
            expectedNewHeap,
            `Service "${serviceId}" should have ${expectedNewHeap} maxHeapTotal after update`
          )
        }
        if (newYoungGeneration) {
          assert.equal(
            info.health.maxYoungGeneration,
            expectedNewYoungGeneration,
            `Service "${serviceId}" should have ${expectedNewYoungGeneration} maxYoungGeneration after update`
          )
        }
      }
    })
  }

  test(`should update only ${testLabel(newHeapTotal, newYoungGeneration)} because workers are the same as current ones`, async t => {
    const servicesId = ['node', 'service']
    const { runtime, resourcesInfo } = await prepareRuntime(t, servicesId, 'update-service-heap')

    const currentResources = {}
    const updateResources = {}
    for (const serviceId of servicesId) {
      currentResources[serviceId] = resourcesInfo[serviceId]
      updateResources[serviceId] = {
        health: {
          maxHeapTotal: newHeapTotal,
          maxYoungGeneration: newYoungGeneration
        }
      }
    }

    const servicesEvents = []
    runtime.on('service:started', event => {
      servicesEvents.push(event)
    })

    const events = []
    for (const serviceId of servicesId) {
      events.push({ event: 'service:worker:started', service: serviceId, worker: 0 })
    }
    const eventsPromise = waitForEvents(runtime, events)

    await runtime.updateServicesResources([
      ...servicesId.map(serviceId => ({
        service: serviceId,
        workers: currentResources[serviceId].workers,
        health: updateResources[serviceId].health
      }))
    ])

    await eventsPromise

    for (const serviceId of servicesId) {
      const info = await runtime.getServiceResourcesInfo(serviceId)
      assert.equal(
        info.workers,
        currentResources[serviceId].workers,
        `Service "${serviceId}" should have ${currentResources[serviceId].workers} workers after update`
      )

      if (newHeapTotal) {
        assert.equal(
          info.health.maxHeapTotal,
          expectedNewHeap,
          `Service "${serviceId}" should have ${expectedNewHeap} maxHeapTotal after update`
        )
      }
      if (newYoungGeneration) {
        assert.equal(
          info.health.maxYoungGeneration,
          expectedNewYoungGeneration,
          `Service "${serviceId}" should have ${expectedNewYoungGeneration} maxYoungGeneration after update`
        )
      }
    }

    deepStrictEqual(servicesEvents, [])
  })
}

test('should report on failures', async t => {
  const { runtime } = await prepareRuntime(t, ['node'], 'update-service-failure')

  const report = await runtime.updateServicesResources([
    {
      service: 'node',
      workers: 3,
      health: {
        maxHeapTotal: '512MB'
      }
    }
  ])

  assert.deepEqual(report, [
    {
      service: 'node',
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
          maxHeapTotal: 536870912
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
