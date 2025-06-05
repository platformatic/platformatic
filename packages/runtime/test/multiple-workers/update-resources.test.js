'use strict'

const { strict: assert } = require('node:assert')
const { test, describe } = require('node:test')
const path = require('node:path')
const { buildServer } = require('../..')
const { openLogsWebsocket, waitForLogs } = require('../helpers')

async function prepareRuntime (t, servicesId, fixture) {
  const appPath = path.join(__dirname, '..', '..', 'fixtures', fixture)
  const runtime = await buildServer(path.join(appPath, 'platformatic.json'))
  t.after(async () => {
    await runtime.close(true)
    managementApiWebsocketStart.terminate()
  })

  await runtime.start()

  const managementApiWebsocketStart = await openLogsWebsocket(runtime)
  await waitForLogs(managementApiWebsocketStart,
    'Platformatic is now listening at '
  )

  const resourcesInfo = {}
  for (const serviceId of servicesId) {
    resourcesInfo[serviceId] = await runtime.getServiceResourcesInfo(serviceId)
  }

  return { runtime, resourcesInfo }
}

describe('runtime update resources', () => {
  test('should throw error for invalid parameters of updateServicesResources', async (t) => {
    const serviceId = 'node'
    const appPath = path.join(__dirname, '..', '..', 'fixtures', 'update-service-workers')
    const runtime = await buildServer(path.join(appPath, 'platformatic.json'))
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
      assert.equal(err.message, 'Invalid argument: "maxHeapTotal" must be a number or a string representing a memory size')
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
      assert.equal(err.message, 'Invalid argument: "maxYoungGeneration" must be a number or a string representing a memory size')
    }
  })

  const variations = [1, -1, 2, -2]
  for (const variation of variations) {
    test(`should ${variation > 0 ? 'increase' : 'decrease'} multiple services workers by ${Math.abs(variation)}`, async (t) => {
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
        assert.equal(resourcesInfo[serviceId].workers, current[serviceId].workers, `Service "${serviceId}" should have ${current[serviceId].workers} workers on start`)
      }

      await runtime.updateServicesResources([
        ...servicesId.map(serviceId => ({
          service: serviceId,
          workers: update[serviceId]
        }))
      ])

      const managementApiWebsocketUpdate = await openLogsWebsocket(runtime)
      t.after(() => { managementApiWebsocketUpdate.terminate() })
      const logs = await waitForLogs(managementApiWebsocketUpdate,
        ...servicesId.map(serviceId => {
          if (variation > 0) {
            return `Started the worker ${update[serviceId] - 1} of the service "${serviceId}"...`
          } else {
            return `Stopped the worker ${update[serviceId]} of the service "${serviceId}"...`
          }
        })
      )

      for (const serviceId of servicesId) {
        const info = await runtime.getServiceResourcesInfo(serviceId)
        assert.equal(info.workers, update[serviceId], `Service "${serviceId}" should have ${update[serviceId]} workers after update`)
      }

      assert.ok(!logs.find(log => log.msg.includes('Restarting service')), 'Service must not restart updating workers only')
    })
  }

  const heapCases = [
    { maxHeapTotal: 512 * 1024 * 1024, maxYoungGeneration: 128 * 1024 * 1024 },
    { maxHeapTotal: '512MB', maxYoungGeneration: '128MB' },
    { maxHeapTotal: '512MB' },
    { maxYoungGeneration: '128MB' },
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

    test(`should update services ${testLabel(newHeapTotal, newYoungGeneration)}`, async (t) => {
      const servicesId = ['node', 'service']
      const { runtime, resourcesInfo } = await prepareRuntime(t, servicesId, 'update-service-heap')

      await runtime.updateServicesResources([
        ...servicesId.map(serviceId => ({
          service: serviceId,
          health: { maxHeapTotal: newHeapTotal, maxYoungGeneration: newYoungGeneration }
        }))
      ])

      const managementApiWebsocketUpdate = await openLogsWebsocket(runtime)
      t.after(() => { managementApiWebsocketUpdate.terminate() })

      const expectedLogs = []
      for (const serviceId of servicesId) {
        expectedLogs.push(
          `Updating service "${serviceId}" config health heap to ${JSON.stringify({ maxHeapTotal: newHeapTotal ? expectedNewHeap : undefined, maxYoungGeneration: newYoungGeneration ? expectedNewYoungGeneration : undefined })}`
        )
        for (let i = 0; i < resourcesInfo[serviceId].workers; i++) {
          expectedLogs.push(
            `Restarting service "${serviceId}" worker ${i} to update config health heap...`,
            `Restarted service "${serviceId}" worker ${i}`
          )
        }
      }
      await waitForLogs(managementApiWebsocketUpdate, ...expectedLogs)

      for (const serviceId of servicesId) {
        const info = await runtime.getServiceResourcesInfo(serviceId)
        assert.equal(info.workers, resourcesInfo[serviceId].workers, `Service "${serviceId}" should have same number of workers before and after update`)
        if (newHeapTotal) {
          assert.equal(info.health.maxHeapTotal, expectedNewHeap, `Service "${serviceId}" should have ${expectedNewHeap} maxHeapTotal after update`)
        }
        if (newYoungGeneration) {
          assert.equal(info.health.maxYoungGeneration, expectedNewYoungGeneration, `Service "${serviceId}" should have ${expectedNewYoungGeneration} maxYoungGeneration after update`)
        }
      }
    })

    const variations = [1, -1, 2, -2]
    for (const variation of variations) {
      test(`should update services ${testLabel(newHeapTotal, newYoungGeneration)} and ${variation > 0 ? 'increase' : 'decrease'} workers by ${Math.abs(variation)} at the same time`, async (t) => {
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

        await runtime.updateServicesResources([
          ...servicesId.map(serviceId => ({
            service: serviceId,
            workers: updateResources[serviceId].workers,
            health: updateResources[serviceId].health
          }))
        ])

        const managementApiWebsocketUpdate = await openLogsWebsocket(runtime)
        t.after(() => { managementApiWebsocketUpdate.terminate() })

        const expectedLogs = []
        for (const serviceId of servicesId) {
          expectedLogs.push(
            `Updating service "${serviceId}" config health heap to ${JSON.stringify({ maxHeapTotal: newHeapTotal ? expectedNewHeap : undefined, maxYoungGeneration: newYoungGeneration ? expectedNewYoungGeneration : undefined })}`,
            `Updating service "${serviceId}" config workers to ${updateResources[serviceId].workers}`
          )
          if (variation > 0) {
            expectedLogs.push(
              `Started the worker ${updateResources[serviceId].workers - 1} of the service "${serviceId}"...`
            )
            for (let i = 0; i < currentResources[serviceId].workers; i++) {
              expectedLogs.push(
                `Restarting service "${serviceId}" worker ${i} to update config health heap...`,
                `Restarted service "${serviceId}" worker ${i}`
              )
            }
          } else {
            expectedLogs.push(
              `Stopped the worker ${updateResources[serviceId].workers} of the service "${serviceId}"...`
            )
            for (let i = 0; i < updateResources[serviceId].workers; i++) {
              expectedLogs.push(
                `Restarting service "${serviceId}" worker ${i} to update config health heap...`,
                `Restarted service "${serviceId}" worker ${i}`
              )
            }
          }
        }
        await waitForLogs(managementApiWebsocketUpdate, ...expectedLogs)

        for (const serviceId of servicesId) {
          const info = await runtime.getServiceResourcesInfo(serviceId)
          assert.equal(info.workers, updateResources[serviceId].workers, `Service "${serviceId}" should have ${updateResources[serviceId].workers} workers after update`)
          if (newHeapTotal) {
            assert.equal(info.health.maxHeapTotal, expectedNewHeap, `Service "${serviceId}" should have ${expectedNewHeap} maxHeapTotal after update`)
          }
          if (newYoungGeneration) {
            assert.equal(info.health.maxYoungGeneration, expectedNewYoungGeneration, `Service "${serviceId}" should have ${expectedNewYoungGeneration} maxYoungGeneration after update`)
          }
        }
      })
    }

    test(`should update only ${testLabel(newHeapTotal, newYoungGeneration)} because workers are the same as current ones`, async (t) => {
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

      await runtime.updateServicesResources([
        ...servicesId.map(serviceId => ({
          service: serviceId,
          workers: currentResources[serviceId].workers,
          health: updateResources[serviceId].health
        }))
      ])

      const managementApiWebsocketUpdate = await openLogsWebsocket(runtime)
      t.after(() => { managementApiWebsocketUpdate.terminate() })

      const expectedLogs = []
      for (const serviceId of servicesId) {
        expectedLogs.push(
          `Updating service "${serviceId}" config health heap to ${JSON.stringify({ maxHeapTotal: newHeapTotal ? expectedNewHeap : undefined, maxYoungGeneration: newYoungGeneration ? expectedNewYoungGeneration : undefined })}`
        )
      }
      const logs = await waitForLogs(managementApiWebsocketUpdate, ...expectedLogs)

      for (const serviceId of servicesId) {
        const info = await runtime.getServiceResourcesInfo(serviceId)
        assert.equal(info.workers, currentResources[serviceId].workers, `Service "${serviceId}" should have ${currentResources[serviceId].workers} workers after update`)

        if (newHeapTotal) {
          assert.equal(info.health.maxHeapTotal, expectedNewHeap, `Service "${serviceId}" should have ${expectedNewHeap} maxHeapTotal after update`)
        }
        if (newYoungGeneration) {
          assert.equal(info.health.maxYoungGeneration, expectedNewYoungGeneration, `Service "${serviceId}" should have ${expectedNewYoungGeneration} maxYoungGeneration after update`)
        }
      }

      assert.ok(!logs.find(log => log.msg.match(/Updating service ".*" config workers/)), 'Service must not update workers')
    })
  }
})
