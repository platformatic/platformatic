'use strict'

const { strict: assert } = require('node:assert')
const { test, describe } = require('node:test')
const path = require('node:path')
const { buildServer } = require('../..')
const { openLogsWebsocket, waitForLogs } = require('../helpers')

describe('runtime update resources', () => {
  for (let increase = 1; increase <= 3; increase++) {
    test(`should increase a service workers by ${increase}`, async (t) => {
      const serviceId = 'node'
      const appPath = path.join(__dirname, '..', '..', 'fixtures', 'update-service-workers')
      const runtime = await buildServer(path.join(appPath, 'platformatic.json'))
      t.after(async () => {
        await runtime.close(true)
        managementApiWebsocketStart.terminate()
        managementApiWebsocketUpdate.terminate()
      })
      const currentConfig = runtime.getRuntimeConfig()

      await runtime.start()

      const current = currentConfig.services.find(s => s.id === serviceId)
      const updateWorkers = current.workers + 1

      const managementApiWebsocketStart = await openLogsWebsocket(runtime)
      await waitForLogs(managementApiWebsocketStart,
        `Started the worker ${current.workers - 1} of the service "${serviceId}"...`,
        'Platformatic is now listening at '
      )

      {
        const info = await runtime.getServiceResourcesInfo(serviceId)
        assert.equal(info.workers, current.workers, `Service "${serviceId}" should have ${current.workers} workers on start`)
      }

      await runtime.updateServicesResources([
        {
          service: serviceId,
          workers: updateWorkers
        }
      ])

      const managementApiWebsocketUpdate = await openLogsWebsocket(runtime)
      await waitForLogs(managementApiWebsocketUpdate,
        `Started the worker ${updateWorkers - 1} of the service "${serviceId}"...`
      )

      {
        const info = await runtime.getServiceResourcesInfo(serviceId)
        assert.equal(info.workers, updateWorkers, `Service "${serviceId}" should have ${updateWorkers} workers after update`)
      }
    })

    test(`should increase multiple services workers by ${increase}`, async (t) => {
      const servicesId = ['node', 'service']
      const appPath = path.join(__dirname, '..', '..', 'fixtures', 'update-service-workers')
      const runtime = await buildServer(path.join(appPath, 'platformatic.json'))
      t.after(async () => {
        await runtime.close()
        managementApiWebsocketStart.terminate()
        managementApiWebsocketUpdate.terminate()
      })
      const currentConfig = runtime.getRuntimeConfig()

      await runtime.start()

      const current = {}
      const updateWorkers = {}
      for (const serviceId of servicesId) {
        current[serviceId] = currentConfig.services.find(s => s.id === serviceId)
        updateWorkers[serviceId] = current[serviceId].workers + 1
      }

      const managementApiWebsocketStart = await openLogsWebsocket(runtime)
      await waitForLogs(managementApiWebsocketStart,
        ...servicesId.map(serviceId => `Started the worker ${current[serviceId].workers - 1} of the service "${serviceId}"...`),
        'Platformatic is now listening at '
      )

      for (const serviceId of servicesId) {
        const info = await runtime.getServiceResourcesInfo(serviceId)
        assert.equal(info.workers, current[serviceId].workers, `Service "${serviceId}" should have ${current[serviceId].workers} workers on start`)
      }

      await runtime.updateServicesResources([
        ...servicesId.map(serviceId => ({
          service: serviceId,
          workers: updateWorkers[serviceId]
        }))
      ])

      const managementApiWebsocketUpdate = await openLogsWebsocket(runtime)
      await waitForLogs(managementApiWebsocketUpdate,
        ...servicesId.map(serviceId => `Started the worker ${updateWorkers[serviceId] - 1} of the service "${serviceId}"...`)
      )

      for (const serviceId of servicesId) {
        const info = await runtime.getServiceResourcesInfo(serviceId)
        assert.equal(info.workers, updateWorkers[serviceId], `Service "${serviceId}" should have ${updateWorkers[serviceId]} workers after update`)
      }
    })
  }

  for (let decrease = 1; decrease <= 3; decrease++) {
    test(`should decrease a service workers by ${decrease}`, async (t) => {
      const serviceId = 'node'
      const appPath = path.join(__dirname, '..', '..', 'fixtures', 'update-service-workers')
      const runtime = await buildServer(path.join(appPath, 'platformatic.json'))
      t.after(async () => {
        await runtime.close(true)
        managementApiWebsocketStart.terminate()
        managementApiWebsocketUpdate.terminate()
      })
      const currentConfig = runtime.getRuntimeConfig()

      await runtime.start()

      const current = currentConfig.services.find(s => s.id === serviceId)
      const updateWorkers = current.workers - decrease

      const managementApiWebsocketStart = await openLogsWebsocket(runtime)
      await waitForLogs(managementApiWebsocketStart,
        `Started the worker ${current.workers - 1} of the service "${serviceId}"...`,
        'Platformatic is now listening at '
      )

      {
        const info = await runtime.getServiceResourcesInfo(serviceId)
        assert.equal(info.workers, current.workers, `Service "${serviceId}" should have ${current.workers} workers on start`)
      }

      await runtime.updateServicesResources([
        {
          service: serviceId,
          workers: updateWorkers
        }
      ])

      const managementApiWebsocketUpdate = await openLogsWebsocket(runtime)
      await waitForLogs(managementApiWebsocketUpdate,
        `Stopped the worker ${updateWorkers} of the service "${serviceId}"...`
      )

      {
        const info = await runtime.getServiceResourcesInfo(serviceId)
        assert.equal(info.workers, updateWorkers, `Service "${serviceId}" should have ${updateWorkers} workers after decrease`)
      }
    })

    test(`should decrease multiple services workers by ${decrease}`, async (t) => {
      const servicesId = ['node', 'service']
      const appPath = path.join(__dirname, '..', '..', 'fixtures', 'update-service-workers')
      const runtime = await buildServer(path.join(appPath, 'platformatic.json'))
      t.after(async () => {
        await runtime.close()
        managementApiWebsocketStart.terminate()
        managementApiWebsocketUpdate.terminate()
      })
      const currentConfig = runtime.getRuntimeConfig()

      await runtime.start()

      const current = {}
      const updateWorkers = {}
      for (const serviceId of servicesId) {
        current[serviceId] = currentConfig.services.find(s => s.id === serviceId)
        updateWorkers[serviceId] = current[serviceId].workers - decrease
      }

      const managementApiWebsocketStart = await openLogsWebsocket(runtime)
      await waitForLogs(managementApiWebsocketStart,
        ...servicesId.map(serviceId => `Started the worker ${current[serviceId].workers - 1} of the service "${serviceId}"...`),
        'Platformatic is now listening at '
      )

      for (const serviceId of servicesId) {
        const info = await runtime.getServiceResourcesInfo(serviceId)
        assert.equal(info.workers, current[serviceId].workers, `Service "${serviceId}" should have ${current[serviceId].workers} workers on start`)
      }

      await runtime.updateServicesResources([
        ...servicesId.map(serviceId => ({
          service: serviceId,
          workers: updateWorkers[serviceId]
        }))
      ])

      const managementApiWebsocketUpdate = await openLogsWebsocket(runtime)
      await waitForLogs(managementApiWebsocketUpdate,
        ...servicesId.map(serviceId => `Stopped the worker ${updateWorkers[serviceId]} of the service "${serviceId}"...`)
      )

      for (const serviceId of servicesId) {
        const info = await runtime.getServiceResourcesInfo(serviceId)
        assert.equal(info.workers, updateWorkers[serviceId], `Service "${serviceId}" should have ${updateWorkers[serviceId]} workers after decrease`)
      }
    })
  }

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

    // Test missing service
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
          maxHeapTotal: -1
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
          maxHeapTotal: 'not-a-memory-size'
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
          maxHeapTotal: false
        }
      ])
      assert.fail('Expected error was not thrown for invalid maxHeapTotal')
    } catch (err) {
      assert.equal(err.message, 'Invalid argument: "maxHeapTotal" must be a number or a string representing a memory size')
    }
  })

  const newHeaps = [512 * 1024 * 1024, '512MB']
  for (const newHeapTotal of newHeaps) {
    const expectedNewHeap = newHeaps[0]
    test(`should update a service maxHeapTotal to ${newHeapTotal}`, async (t) => {
      const serviceId = 'node'
      const appPath = path.join(__dirname, '..', '..', 'fixtures', 'update-service-heap')
      const runtime = await buildServer(path.join(appPath, 'platformatic.json'))
      t.after(async () => {
        await runtime.close(true)
        managementApiWebsocketStart.terminate()
        managementApiWebsocketUpdate.terminate()
      })

      await runtime.start()

      const managementApiWebsocketStart = await openLogsWebsocket(runtime)
      await waitForLogs(managementApiWebsocketStart,
        'Platformatic is now listening at '
      )

      const info = await runtime.getServiceResourcesInfo(serviceId)
      const workers = info.workers

      await runtime.updateServicesResources([
        {
          service: serviceId,
          maxHeapTotal: newHeapTotal
        }
      ])

      const managementApiWebsocketUpdate = await openLogsWebsocket(runtime)
      await waitForLogs(managementApiWebsocketUpdate,
        `Started the worker ${workers - 1} of the service "${serviceId}"...`,
        `Restarting service "${serviceId}" worker ${workers - 1} to update maxHeapTotal...`
      )

      {
        const info = await runtime.getServiceResourcesInfo(serviceId)
        assert.equal(info.health.maxHeapTotal, expectedNewHeap, `Service "${serviceId}" should have ${expectedNewHeap} maxHeapTotal after update`)
      }
    })

    test(`should update multiple services maxHeapTotal to ${newHeapTotal}`, async (t) => {
      const servicesId = ['node', 'service']
      const appPath = path.join(__dirname, '..', '..', 'fixtures', 'update-service-heap')
      const runtime = await buildServer(path.join(appPath, 'platformatic.json'))
      t.after(async () => {
        await runtime.close(true)
        managementApiWebsocketStart.terminate()
        managementApiWebsocketUpdate.terminate()
      })

      await runtime.start()

      const managementApiWebsocketStart = await openLogsWebsocket(runtime)
      await waitForLogs(managementApiWebsocketStart,
        'Platformatic is now listening at '
      )

      const infoBefore = {}
      for (const serviceId of servicesId) {
        infoBefore[serviceId] = await runtime.getServiceResourcesInfo(serviceId)
      }

      await runtime.updateServicesResources([
        ...servicesId.map(serviceId => ({
          service: serviceId,
          maxHeapTotal: newHeapTotal
        }))
      ])

      const managementApiWebsocketUpdate = await openLogsWebsocket(runtime)
      await waitForLogs(managementApiWebsocketUpdate,
        ...servicesId.flatMap(serviceId => {
          const workers = infoBefore[serviceId].workers
          return Array.from({ length: workers }, (_, i) =>
            `Restarting service "${serviceId}" worker ${i} to update maxHeapTotal...`
          )
        })
      )

      for (const serviceId of servicesId) {
        const info = await runtime.getServiceResourcesInfo(serviceId)
        assert.equal(info.health.maxHeapTotal, expectedNewHeap, `Service "${serviceId}" should have ${expectedNewHeap} maxHeapTotal after update`)
      }
    })

    for (let increase = 1; increase <= 3; increase++) {
      test(`should update maxHeapTotal to ${newHeapTotal} and increase workers by ${increase} at the same time`, async (t) => {
        const serviceId = 'node'
        const appPath = path.join(__dirname, '..', '..', 'fixtures', 'update-service-heap')
        const runtime = await buildServer(path.join(appPath, 'platformatic.json'))
        t.after(async () => {
          await runtime.close(true)
          managementApiWebsocketStart.terminate()
          managementApiWebsocketUpdate.terminate()
        })

        await runtime.start()

        const managementApiWebsocketStart = await openLogsWebsocket(runtime)
        await waitForLogs(managementApiWebsocketStart,
          'Platformatic is now listening at '
        )

        const infoBefore = await runtime.getServiceResourcesInfo(serviceId)
        const currentWorkers = infoBefore.workers
        const updateWorkers = currentWorkers + increase

        await runtime.updateServicesResources([
          {
            service: serviceId,
            workers: updateWorkers,
            maxHeapTotal: newHeapTotal
          }
        ])

        const managementApiWebsocketUpdate = await openLogsWebsocket(runtime)

        const expectedLogs = [
        `Updating service "${serviceId}" config maxHeapTotal to ${expectedNewHeap}`,
        `Updating service "${serviceId}" config workers to ${updateWorkers}`
        ]
        for (let i = 0; i < increase; i++) {
          expectedLogs.push(
          `Started the worker ${currentWorkers + i} of the service "${serviceId}"...`
          )
        }
        for (let i = 0; i < currentWorkers; i++) {
          expectedLogs.push(
          `Restarting service "${serviceId}" worker ${i} to update maxHeapTotal...`,
          `Restarted service "${serviceId}" worker ${i}`
          )
        }
        await waitForLogs(managementApiWebsocketUpdate, ...expectedLogs)

        const infoAfter = await runtime.getServiceResourcesInfo(serviceId)
        assert.equal(infoAfter.workers, updateWorkers, `Service "${serviceId}" should have ${updateWorkers} workers after update`)
        assert.equal(infoAfter.health.maxHeapTotal, expectedNewHeap, `Service "${serviceId}" should have ${expectedNewHeap} maxHeapTotal after update`)
      })

      test(`should update multiple services maxHeapTotal to ${newHeapTotal} and increase workers by ${increase} at the same time`, async (t) => {
        const servicesId = ['node', 'service']
        const appPath = path.join(__dirname, '..', '..', 'fixtures', 'update-service-heap')
        const runtime = await buildServer(path.join(appPath, 'platformatic.json'))
        t.after(async () => {
          await runtime.close(true)
          managementApiWebsocketStart.terminate()
          managementApiWebsocketUpdate.terminate()
        })

        await runtime.start()

        const managementApiWebsocketStart = await openLogsWebsocket(runtime)
        await waitForLogs(managementApiWebsocketStart,
          'Platformatic is now listening at '
        )

        const currentResources = {}
        const updateResources = {}
        for (const serviceId of servicesId) {
          currentResources[serviceId] = await runtime.getServiceResourcesInfo(serviceId)
          updateResources[serviceId] = {
            workers: currentResources[serviceId].workers + increase,
            maxHeapTotal: newHeapTotal
          }
        }

        await runtime.updateServicesResources([
          ...servicesId.map(serviceId => ({
            service: serviceId,
            workers: updateResources[serviceId].workers,
            maxHeapTotal: updateResources[serviceId].maxHeapTotal
          }))
        ])

        const managementApiWebsocketUpdate = await openLogsWebsocket(runtime)

        const expectedLogs = []
        for (const serviceId of servicesId) {
          expectedLogs.push(
        `Updating service "${serviceId}" config maxHeapTotal to ${expectedNewHeap}`,
        `Updating service "${serviceId}" config workers to ${updateResources[serviceId].workers}`
          )
          for (let i = 0; i < increase; i++) {
            expectedLogs.push(
          `Started the worker ${currentResources[serviceId].workers + i} of the service "${serviceId}"...`
            )
          }
          for (let i = 0; i < currentResources[serviceId].workers; i++) {
            expectedLogs.push(
          `Restarting service "${serviceId}" worker ${i} to update maxHeapTotal...`,
          `Restarted service "${serviceId}" worker ${i}`
            )
          }
        }
        await waitForLogs(managementApiWebsocketUpdate, ...expectedLogs)

        for (const serviceId of servicesId) {
          const info = await runtime.getServiceResourcesInfo(serviceId)
          assert.equal(info.workers, updateResources[serviceId].workers, `Service "${serviceId}" should have ${updateResources[serviceId].workers} workers after update`)
          assert.equal(info.health.maxHeapTotal, expectedNewHeap, `Service "${serviceId}" should have ${expectedNewHeap} maxHeapTotal after update`)
        }
      })
    }

    for (let decrease = 2; decrease <= 2; decrease++) {
      test(`should update maxHeapTotal to ${newHeapTotal} and decrease workers by ${decrease} at the same time`, async (t) => {
        const serviceId = 'node'
        const appPath = path.join(__dirname, '..', '..', 'fixtures', 'update-service-heap')
        const runtime = await buildServer(path.join(appPath, 'platformatic.json'))
        t.after(async () => {
          await runtime.close(true)
          managementApiWebsocketStart.terminate()
          managementApiWebsocketUpdate.terminate()
        })

        await runtime.start()

        const managementApiWebsocketStart = await openLogsWebsocket(runtime)
        await waitForLogs(managementApiWebsocketStart,
          'Platformatic is now listening at '
        )

        const infoBefore = await runtime.getServiceResourcesInfo(serviceId)
        const currentWorkers = infoBefore.workers
        const updateWorkers = currentWorkers - decrease

        await runtime.updateServicesResources([
          {
            service: serviceId,
            workers: updateWorkers,
            maxHeapTotal: newHeapTotal
          }
        ])

        const managementApiWebsocketUpdate = await openLogsWebsocket(runtime)

        const expectedLogs = [
        `Updating service "${serviceId}" config workers to ${updateWorkers}`
        ]
        for (let i = 0; i < decrease; i++) {
          expectedLogs.push(
          `Stopped the worker ${currentWorkers - i - 1} of the service "${serviceId}"...`
          )
        }
        expectedLogs.push(
        `Updating service "${serviceId}" config maxHeapTotal to ${expectedNewHeap}`
        )
        for (let i = 0; i < updateWorkers; i++) {
          expectedLogs.push(
          `Restarting service "${serviceId}" worker ${i} to update maxHeapTotal...`,
          `Restarted service "${serviceId}" worker ${i}`
          )
        }
        await waitForLogs(managementApiWebsocketUpdate, ...expectedLogs)

        const infoAfter = await runtime.getServiceResourcesInfo(serviceId)
        assert.equal(infoAfter.workers, updateWorkers, `Service "${serviceId}" should have ${updateWorkers} workers after update`)
        assert.equal(infoAfter.health.maxHeapTotal, expectedNewHeap, `Service "${serviceId}" should have ${expectedNewHeap} maxHeapTotal after update`)
      })

      test(`should update multiple services maxHeapTotal to ${newHeapTotal} and decrease workers by ${decrease} at the same time`, async (t) => {
        const servicesId = ['node', 'service']
        const appPath = path.join(__dirname, '..', '..', 'fixtures', 'update-service-heap')
        const runtime = await buildServer(path.join(appPath, 'platformatic.json'))
        t.after(async () => {
          await runtime.close(true)
          managementApiWebsocketStart.terminate()
          managementApiWebsocketUpdate.terminate()
        })

        await runtime.start()

        const managementApiWebsocketStart = await openLogsWebsocket(runtime)
        await waitForLogs(managementApiWebsocketStart,
          'Platformatic is now listening at '
        )

        const currentResources = {}
        const updateResources = {}
        for (const serviceId of servicesId) {
          currentResources[serviceId] = await runtime.getServiceResourcesInfo(serviceId)
          updateResources[serviceId] = {
            workers: currentResources[serviceId].workers - decrease,
            maxHeapTotal: newHeapTotal
          }
        }

        await runtime.updateServicesResources([
          ...servicesId.map(serviceId => ({
            service: serviceId,
            workers: updateResources[serviceId].workers,
            maxHeapTotal: updateResources[serviceId].maxHeapTotal
          }))
        ])

        const managementApiWebsocketUpdate = await openLogsWebsocket(runtime)

        const expectedLogs = []
        for (const serviceId of servicesId) {
          expectedLogs.push(
          `Updating service "${serviceId}" config workers to ${updateResources[serviceId].workers}`
          )
          for (let i = 0; i < decrease; i++) {
            expectedLogs.push(
            `Stopped the worker ${currentResources[serviceId].workers - i - 1} of the service "${serviceId}"...`
            )
          }
          expectedLogs.push(
        `Updating service "${serviceId}" config maxHeapTotal to ${expectedNewHeap}`
          )
          for (let i = 0; i < updateResources[serviceId].workers; i++) {
            expectedLogs.push(
          `Restarting service "${serviceId}" worker ${i} to update maxHeapTotal...`,
          `Restarted service "${serviceId}" worker ${i}`
            )
          }
        }
        await waitForLogs(managementApiWebsocketUpdate, ...expectedLogs)

        for (const serviceId of servicesId) {
          const info = await runtime.getServiceResourcesInfo(serviceId)
          assert.equal(info.workers, updateResources[serviceId].workers, `Service "${serviceId}" should have ${updateResources[serviceId].workers} workers after update`)
          assert.equal(info.health.maxHeapTotal, expectedNewHeap, `Service "${serviceId}" should have ${expectedNewHeap} maxHeapTotal after update`)
        }
      })
    }

    test(`should update only maxHeapTotal to ${newHeapTotal} because workers are the same as current ones`, async (t) => {
      const serviceId = 'node'
      const appPath = path.join(__dirname, '..', '..', 'fixtures', 'update-service-heap')
      const runtime = await buildServer(path.join(appPath, 'platformatic.json'))
      t.after(async () => {
        await runtime.close(true)
        managementApiWebsocketStart.terminate()
        managementApiWebsocketUpdate.terminate()
      })

      await runtime.start()

      const managementApiWebsocketStart = await openLogsWebsocket(runtime)
      await waitForLogs(managementApiWebsocketStart,
        'Platformatic is now listening at '
      )

      const infoBefore = await runtime.getServiceResourcesInfo(serviceId)
      const currentWorkers = infoBefore.workers

      await runtime.updateServicesResources([
        {
          service: serviceId,
          workers: currentWorkers,
          maxHeapTotal: newHeapTotal
        }
      ])

      const managementApiWebsocketUpdate = await openLogsWebsocket(runtime)

      const expectedLogs = [
        `Updating service "${serviceId}" config maxHeapTotal to ${expectedNewHeap}`
      ]
      for (let i = 0; i < currentWorkers; i++) {
        expectedLogs.push(
          `Restarting service "${serviceId}" worker ${i} to update maxHeapTotal...`,
          `Restarted service "${serviceId}" worker ${i}`
        )
      }
      await waitForLogs(managementApiWebsocketUpdate, ...expectedLogs)

      const infoAfter = await runtime.getServiceResourcesInfo(serviceId)
      assert.equal(infoAfter.workers, currentWorkers, `Service "${serviceId}" should have ${currentWorkers} workers since workers are the same as current ones`)
      assert.equal(infoAfter.health.maxHeapTotal, expectedNewHeap, `Service "${serviceId}" should have ${expectedNewHeap} maxHeapTotal after update`)
    })
  }
})
