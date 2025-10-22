import { deepStrictEqual, ok, rejects } from 'node:assert'
import { once } from 'node:events'
import { join } from 'node:path'
import { test } from 'node:test'
import { request } from 'undici'
import { prepareApplication } from '../index.js'
import { createRuntime, sleep } from './helpers.js'

const fixturesDir = join(import.meta.dirname, '..', 'fixtures')

test('should be able to add and remove applications with auto restart of composers', async t => {
  const configFile = join(fixturesDir, 'dynamic-applications')
  const runtime = await createRuntime(configFile, null)

  t.after(async () => {
    await runtime.close()
  })

  let events = []

  for (const event of ['application:added', 'application:removed', 'application:started', 'application:stopped']) {
    runtime.on(event, payload => {
      events.push({ event, payload })
    })
  }

  let url = await runtime.start()

  ok(!events.find(e => e.payload.id === 'application-2'))

  {
    const res = await request(url + '/application-1/hello')
    deepStrictEqual(res.statusCode, 200)
    deepStrictEqual(await res.body.json(), { from: 'application-1' })
  }

  {
    const res = await request(url + '/application-2/hello')
    deepStrictEqual(res.statusCode, 404)
  }

  // Add application-2
  {
    events = []

    const addPromise = once(runtime, 'application:started')
    const restartPromise = once(runtime, 'application:restarted')
    await runtime.addApplications(
      [
        await prepareApplication(runtime.getRuntimeConfig(true), {
          id: 'application-2',
          path: './application-2'
        })
      ],
      true
    )

    await addPromise
    await restartPromise
    ok(events.find(e => e.event === 'application:added' && e.payload.id === 'application-2'))
    ok(events.find(e => e.event === 'application:started' && e.payload === 'application-2'))

    url = runtime.getUrl()

    {
      const res = await request(url + '/application-1/hello')
      deepStrictEqual(res.statusCode, 200)
      deepStrictEqual(await res.body.json(), { from: 'application-1' })
    }

    {
      const res = await request(url + '/application-2/hello')
      deepStrictEqual(res.statusCode, 200)
      deepStrictEqual(await res.body.json(), { from: 'application-2' })
    }
  }

  // Remove application-1
  {
    events = []

    const removePromise = once(runtime, 'application:removed')
    const restartPromise = once(runtime, 'application:restarted')
    await runtime.removeApplications(['application-1'])

    await removePromise
    await restartPromise

    ok(events.find(e => e.event === 'application:stopped' && e.payload === 'application-1'))
    ok(events.find(e => e.event === 'application:removed' && e.payload === 'application-1'))

    url = runtime.getUrl()

    {
      const res = await request(url + '/application-1/hello')
      deepStrictEqual(res.statusCode, 404)
    }

    {
      const res = await request(url + '/application-2/hello')
      deepStrictEqual(res.statusCode, 200)
      deepStrictEqual(await res.body.json(), { from: 'application-2' })
    }
  }
})

test('should not allow to remove the entrypoint', async t => {
  const configFile = join(fixturesDir, 'dynamic-applications')
  const runtime = await createRuntime(configFile, null)

  t.after(async () => {
    await runtime.close()
  })

  await runtime.start()
  await rejects(() => runtime.removeApplications(['composer']), /Cannot remove the entrypoint application./)
})

test('mesh network should work properly when adding and removing applications', async t => {
  const configFile = join(fixturesDir, 'dynamic-applications')
  const runtime = await createRuntime(configFile, null)

  t.after(async () => {
    await runtime.close()
  })

  let events = []

  for (const event of ['application:added', 'application:removed', 'application:started', 'application:stopped']) {
    runtime.on(event, payload => {
      events.push({ event, payload })
    })
  }

  let url = await runtime.start()

  ok(!events.find(e => e.payload.id === 'application-2'))

  {
    const res = await request(url + '/application-1/hello')
    deepStrictEqual(res.statusCode, 200)
    deepStrictEqual(await res.body.json(), { from: 'application-1' })
  }

  {
    const res = await request(url + '/application-2/hello')
    deepStrictEqual(res.statusCode, 404)
  }

  // Add application-2
  {
    events = []

    const addPromise = once(runtime, 'application:started')
    const restartPromise = once(runtime, 'application:restarted')
    await runtime.addApplications(
      [
        await prepareApplication(runtime.getRuntimeConfig(true), {
          id: 'application-2',
          path: './application-2'
        })
      ],
      true
    )

    await addPromise
    await restartPromise
    url = runtime.getUrl()

    {
      const res = await request(url + '/application-1/from-application-2')
      deepStrictEqual(res.statusCode, 200)
      deepStrictEqual(await res.body.json(), { from: 'application-2' })
    }

    {
      const res = await request(url + '/application-2/from-application-1')
      deepStrictEqual(res.statusCode, 200)
      deepStrictEqual(await res.body.json(), { from: 'application-1' })
    }
  }

  // Remove application-1
  {
    events = []

    const removePromise = once(runtime, 'application:removed')
    const restartPromise = once(runtime, 'application:restarted')
    await runtime.removeApplications(['application-1'])

    await removePromise
    await restartPromise

    ok(events.find(e => e.event === 'application:stopped' && e.payload === 'application-1'))
    ok(events.find(e => e.event === 'application:removed' && e.payload === 'application-1'))

    url = runtime.getUrl()

    {
      const res = await request(url + '/application-2/from-application-1')
      deepStrictEqual(res.statusCode, 500)
      deepStrictEqual(await res.body.json(), {
        error: 'Internal Server Error',
        message: 'fetch failed',
        statusCode: 500
      })
    }
  }
})

test('metrics should work properly when adding and removing applications', async t => {
  const configFile = join(fixturesDir, 'dynamic-applications')
  const runtime = await createRuntime(configFile, null)

  t.after(async () => {
    await runtime.close()
  })

  let events = []

  for (const event of ['application:added', 'application:removed', 'application:started', 'application:stopped']) {
    runtime.on(event, payload => {
      events.push({ event, payload })
    })
  }

  await runtime.start()

  {
    const { metrics } = await runtime.getMetrics('text')

    ok(metrics.includes('applicationId="composer"'))
    ok(metrics.includes('applicationId="application-1"'))
    ok(!metrics.includes('applicationId="application-2"'))
  }

  // Add application-2
  {
    events = []

    const addPromise = once(runtime, 'application:started')
    const restartPromise = once(runtime, 'application:restarted')
    await runtime.addApplications(
      [
        await prepareApplication(runtime.getRuntimeConfig(true), {
          id: 'application-2',
          path: './application-2'
        })
      ],
      true
    )

    await addPromise
    await restartPromise

    const { metrics } = await runtime.getMetrics('text')

    ok(metrics.includes('applicationId="composer"'))
    ok(metrics.includes('applicationId="application-1"'))
    ok(metrics.includes('applicationId="application-2"'))
  }

  // Remove application-1
  {
    events = []

    const removePromise = once(runtime, 'application:removed')
    const restartPromise = once(runtime, 'application:restarted')
    await runtime.removeApplications(['application-1'])

    await removePromise
    await restartPromise

    const { metrics } = await runtime.getMetrics('text')

    ok(metrics.includes('applicationId="composer"'))
    ok(!metrics.includes('applicationId="application-1"'))
    ok(metrics.includes('applicationId="application-2"'))
  }
})

test('vertical autoscaler should work properly when adding and removing applications', async t => {
  const configFile = join(fixturesDir, 'dynamic-applications')
  const runtime = await createRuntime(configFile, null)

  t.after(async () => {
    await runtime.close()
  })

  let events = []

  for (const event of ['application:added', 'application:removed', 'application:started', 'application:stopped']) {
    runtime.on(event, payload => {
      events.push({ event, payload })
    })
  }

  await runtime.start()

  // Add application-2
  {
    events = []

    const addPromise = once(runtime, 'application:started')
    const restartPromise = once(runtime, 'application:restarted')
    await runtime.addApplications(
      [
        await prepareApplication(runtime.getRuntimeConfig(true), {
          id: 'application-2',
          path: './application-2'
        })
      ],
      true
    )

    await addPromise
    await restartPromise
  }

  // Stress applications and wait for both of them to be upscaled
  {
    // Add load on both application-1 and application-2
    const url = runtime.getUrl()

    const promise = Promise.withResolvers()

    const expected = new Set(['application-1', 'application-2'])
    function listener ({ application }) {
      expected.delete(application)

      if (expected.size === 0) {
        runtime.removeListener('application:worker:started', listener)
        promise.resolve()
      }
    }

    runtime.on('application:worker:started', listener)

    await request(url + '/application-1/stress')
    await request(url + '/application-2/stress')
    await promise.promise
  }

  // Remove application-1 - The vertical autoscaler should not blow up
  {
    events = []

    const removePromise = once(runtime, 'application:removed')
    const restartPromise = once(runtime, 'application:restarted')
    await runtime.removeApplications(['application-1'])

    await removePromise
    await restartPromise
  }

  // Wait for few cycles of vertical autoscaler
  await sleep(10000)
})
