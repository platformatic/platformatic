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
      const appPath = path.join(__dirname, '..', '..', 'fixtures', 'update-service-resources')
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
      const servicesId = ['node', 'composer']
      const appPath = path.join(__dirname, '..', '..', 'fixtures', 'update-service-resources')
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
      const appPath = path.join(__dirname, '..', '..', 'fixtures', 'update-service-resources')
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
      const servicesId = ['node', 'composer']
      const appPath = path.join(__dirname, '..', '..', 'fixtures', 'update-service-resources')
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
    const appPath = path.join(__dirname, '..', '..', 'fixtures', 'update-service-resources')
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
      assert.equal(err.message, 'Service non-existent-service not found. Available services are: node, composer')
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

    // Test missing workers
    try {
      await runtime.updateServicesResources([
        {
          service: serviceId
        }
      ])
      assert.fail('Expected error was not thrown for missing workers')
    } catch (err) {
      assert.equal(err.message, 'Invalid argument: "workers" must be a number')
    }
  })
})
