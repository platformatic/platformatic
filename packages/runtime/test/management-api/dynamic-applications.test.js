import { deepStrictEqual, ok } from 'node:assert'
import { once } from 'node:events'
import { join, resolve } from 'node:path'
import { test } from 'node:test'
import { Client, request } from 'undici'
import { version } from '../../index.js'
import { createRuntime } from '../helpers.js'

const fixturesDir = join(import.meta.dirname, '..', '..', 'fixtures')

test('should be able to add and remove applications using the management API', async t => {
  const configFile = join(fixturesDir, 'dynamic-applications')
  const runtime = await createRuntime(configFile, null)
  let url = await runtime.start()

  const client = new Client(
    {
      hostname: 'localhost',
      protocol: 'http:'
    },
    {
      socketPath: runtime.getManagementApiUrl(),
      keepAliveTimeout: 10,
      keepAliveMaxTimeout: 10
    }
  )

  t.after(async () => {
    await Promise.all([client.close(), runtime.close()])
  })

  let events = []

  for (const event of ['application:added', 'application:removed', 'application:started', 'application:stopped']) {
    runtime.on(event, payload => {
      events.push({ event, payload })
    })
  }

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

    const { statusCode, body } = await client.request({
      method: 'POST',
      path: '/api/v1/applications',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'application-2', path: './application-2' })
    })

    deepStrictEqual(statusCode, 201)
    deepStrictEqual(await body.json(), [
      {
        dependencies: [],
        entrypoint: false,
        id: 'application-2',
        path: resolve(fixturesDir, 'dynamic-applications', 'application-2'),
        localUrl: 'http://application-2.plt.local',
        status: 'started',
        type: 'nodejs',
        version
      }
    ])

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

  // Remove application-1 via specific endpoint
  {
    events = []

    const removePromise = once(runtime, 'application:removed')
    const restartPromise = once(runtime, 'application:restarted')

    const { statusCode, body } = await client.request({
      method: 'DELETE',
      path: '/api/v1/applications/application-1'
    })

    deepStrictEqual(statusCode, 202)
    deepStrictEqual(await body.json(), [
      {
        config: resolve(fixturesDir, 'dynamic-applications', 'application-1', 'platformatic.json'),
        dependencies: [],
        entrypoint: false,
        id: 'application-1',
        localUrl: 'http://application-1.plt.local',
        path: resolve(fixturesDir, 'dynamic-applications', 'application-1'),
        status: 'removed',
        type: 'nodejs',
        version
      }
    ])

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

  // Remove application-2 via generic endpoint
  {
    events = []

    const removePromise = once(runtime, 'application:removed')
    const restartPromise = once(runtime, 'application:restarted')

    const { statusCode, body } = await client.request({
      method: 'DELETE',
      path: '/api/v1/applications/application-2',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(['application-1'])
    })

    deepStrictEqual(statusCode, 202)
    deepStrictEqual(await body.json(), [
      {
        dependencies: [],
        entrypoint: false,
        id: 'application-2',
        localUrl: 'http://application-2.plt.local',
        path: resolve(fixturesDir, 'dynamic-applications', 'application-2'),
        status: 'removed',
        type: 'nodejs',
        version
      }
    ])

    await removePromise
    await restartPromise

    ok(events.find(e => e.event === 'application:stopped' && e.payload === 'application-2'))
    ok(events.find(e => e.event === 'application:removed' && e.payload === 'application-2'))

    url = runtime.getUrl()

    {
      const res = await request(url + '/application-1/hello')
      deepStrictEqual(res.statusCode, 404)
    }

    {
      const res = await request(url + '/application-2/hello')
      deepStrictEqual(res.statusCode, 404)
    }
  }
})

test('should validate options when adding apps via the management API', async t => {
  const configFile = join(fixturesDir, 'dynamic-applications')
  const runtime = await createRuntime(configFile, null)
  await runtime.start()

  const client = new Client(
    {
      hostname: 'localhost',
      protocol: 'http:'
    },
    {
      socketPath: runtime.getManagementApiUrl(),
      keepAliveTimeout: 10,
      keepAliveMaxTimeout: 10
    }
  )

  t.after(async () => {
    await Promise.all([client.close(), runtime.close()])
  })

  // Invalid type
  {
    const { statusCode, body } = await client.request({
      method: 'POST',
      path: '/api/v1/applications',
      headers: { 'Content-Type': 'text/plain' },
      body: 'WHATEVER'
    })

    deepStrictEqual(statusCode, 400)
    deepStrictEqual(await body.json(), {
      error: 'Bad Request',
      message: 'Invalid applications configuration.',
      statusCode: 400,
      validationErrors: [
        {
          message: 'must be object',
          params: {
            type: 'object'
          },
          path: '/0'
        }
      ]
    })
  }

  // Missing id
  {
    const { statusCode, body } = await client.request({
      method: 'POST',
      path: '/api/v1/applications',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: 'path' })
    })

    deepStrictEqual(statusCode, 400)
    deepStrictEqual(await body.json(), {
      statusCode: 400,
      error: 'Bad Request',
      message: 'Invalid applications configuration.',
      validationErrors: [
        {
          path: '/0',
          message: "must have required property 'id'",
          params: {
            missingProperty: 'id'
          }
        },
        {
          path: '/0',
          message: "must have required property 'id'",
          params: {
            missingProperty: 'id'
          }
        },
        { path: '/0', message: 'must match a schema in anyOf', params: {} }
      ]
    })
  }

  // Invalid type
  {
    const { statusCode, body } = await client.request({
      method: 'POST',
      path: '/api/v1/applications',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 123, path: 'path' })
    })

    deepStrictEqual(statusCode, 400)
    deepStrictEqual(await body.json(), {
      error: 'Bad Request',
      message: 'Invalid applications configuration.',
      statusCode: 400,
      validationErrors: [
        {
          message: 'must be string',
          params: {
            type: 'string'
          },
          path: '/0/id'
        }
      ]
    })
  }
})

test('should validate ids when removing apps via the management API', async t => {
  const configFile = join(fixturesDir, 'dynamic-applications')
  const runtime = await createRuntime(configFile, null)
  await runtime.start()

  const client = new Client(
    {
      hostname: 'localhost',
      protocol: 'http:'
    },
    {
      socketPath: runtime.getManagementApiUrl(),
      keepAliveTimeout: 10,
      keepAliveMaxTimeout: 10
    }
  )

  t.after(async () => {
    await Promise.all([client.close(), runtime.close()])
  })

  {
    const { statusCode, body } = await client.request({
      method: 'DELETE',
      path: '/api/v1/applications',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(['application-1', 'whatever'])
    })

    deepStrictEqual(statusCode, 404)
    deepStrictEqual(await body.json(), {
      error: 'Not Found',
      message: 'Application with id "whatever" not found.',
      statusCode: 404
    })
  }

  {
    const { statusCode, body } = await client.request({
      method: 'DELETE',
      path: '/api/v1/applications/whatever'
    })

    deepStrictEqual(statusCode, 404)
    deepStrictEqual(await body.json(), {
      error: 'Not Found',
      message: 'Application with id "whatever" not found.',
      statusCode: 404
    })
  }
})
