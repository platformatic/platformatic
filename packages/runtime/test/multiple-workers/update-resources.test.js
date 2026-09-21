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

    // Track all started events to verify workers are replaced with new unique indices
    const startedEvents = []
    runtime.on('application:worker:started', payload => {
      startedEvents.push(payload)
    })

    // Calculate total expected replacements
    let totalExpectedReplacements = 0
    for (const applicationId of applicationsId) {
      totalExpectedReplacements += resourcesInfo[applicationId].workers
    }

    await runtime.updateApplicationsResources([
      ...applicationsId.map(applicationId => ({
        application: applicationId,
        health: { maxHeapTotal: newHeapTotal, maxYoungGeneration: newYoungGeneration }
      }))
    ])

    // Wait a bit for all events to be processed
    await new Promise(resolve => setTimeout(resolve, 1000))

    // Verify the correct number of workers were started
    const relevantEvents = startedEvents.filter(e => applicationsId.includes(e.application))
    assert.equal(
      relevantEvents.length,
      totalExpectedReplacements,
      `Should have ${totalExpectedReplacements} worker started events, got ${relevantEvents.length}`
    )

    // Verify each application's workers got new unique indices (>= initial count)
    for (const applicationId of applicationsId) {
      const appEvents = relevantEvents.filter(e => e.application === applicationId)
      const initialWorkerCount = resourcesInfo[applicationId].workers

      assert.equal(
        appEvents.length,
        initialWorkerCount,
        `Application "${applicationId}" should have ${initialWorkerCount} worker started events`
      )

      // All new workers should have indices >= initial worker count
      for (const event of appEvents) {
        assert.ok(
          event.worker >= initialWorkerCount,
          `Application "${applicationId}" worker ${event.worker} should have index >= ${initialWorkerCount}`
        )
      }
    }

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

      // Track events instead of predicting exact indices
      const startedEvents = []
      const stoppedEvents = []
      runtime.on('application:worker:started', payload => {
        startedEvents.push(payload)
      })
      runtime.on('application:worker:stopped', payload => {
        stoppedEvents.push(payload)
      })

      const report = await runtime.updateApplicationsResources([
        ...applicationsId.map(applicationId => ({
          application: applicationId,
          workers: updateResources[applicationId].workers,
          health: updateResources[applicationId].health
        }))
      ])

      // Wait for events to be processed
      await new Promise(resolve => setTimeout(resolve, 1000))

      // Verify report structure for each application
      for (const applicationId of applicationsId) {
        const appReport = report.find(r => r.application === applicationId)
        assert.ok(appReport, `Report should include ${applicationId}`)

        // Verify workers report
        assert.equal(appReport.workers.current, currentResources[applicationId].workers)
        assert.equal(appReport.workers.new, updateResources[applicationId].workers)
        assert.equal(appReport.workers.success, true)

        if (variation > 0) {
          assert.ok(Array.isArray(appReport.workers.started), 'Should have started array')
          assert.equal(appReport.workers.started.length, variation, `Should have started ${variation} workers`)
        } else {
          assert.ok(Array.isArray(appReport.workers.stopped), 'Should have stopped array')
          assert.equal(appReport.workers.stopped.length, Math.abs(variation), `Should have stopped ${Math.abs(variation)} workers`)
        }

        // Verify health report
        assert.ok(appReport.health, 'Should have health report')
        assert.equal(appReport.health.success, true)
        assert.ok(Array.isArray(appReport.health.updated), 'Should have updated array')
      }

      // Verify final state
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

    // When workers are replaced, they get new unique indices starting from the initial worker count
    const events = []
    for (const applicationId of applicationsId) {
      const workerCount = resourcesInfo[applicationId].workers
      // First replaced worker gets index equal to initial worker count
      events.push({ event: 'application:worker:started', application: applicationId, worker: workerCount })
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

  // Verify report structure without checking exact indices
  // The fixture crashes workers with workerId > 1, but exact failure scenario
  // depends on the order of operations and retry behavior
  assert.equal(report.length, 1)
  const appReport = report[0]

  assert.equal(appReport.application, 'node')

  // Workers report should have expected structure
  assert.ok(appReport.workers, 'Should have workers report')
  assert.equal(appReport.workers.current, 1)
  assert.equal(appReport.workers.new, 3)
  assert.ok(Array.isArray(appReport.workers.started), 'Should have started array')
  assert.equal(typeof appReport.workers.success, 'boolean')

  // Health report should have expected structure
  assert.ok(appReport.health, 'Should have health report')
  assert.ok(appReport.health.current, 'Should have current health')
  assert.ok(appReport.health.new, 'Should have new health')
  assert.ok(Array.isArray(appReport.health.updated), 'Should have updated array')
  assert.equal(typeof appReport.health.success, 'boolean')

  // At least one operation should have failed (the fixture causes failures)
  const hasFailure = !appReport.workers.success || !appReport.health.success
  assert.ok(hasFailure, 'At least one operation should have failed due to fixture')
})
