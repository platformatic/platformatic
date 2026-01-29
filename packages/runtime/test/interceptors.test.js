import { deepStrictEqual, notEqual, strictEqual } from 'node:assert'
import { join } from 'node:path'
import { test } from 'node:test'
import { request } from 'undici'
import external from '../fixtures/interceptors/external.js'
import idp from '../fixtures/interceptors/idp.js'
import { createRuntime } from './helpers.js'

const fixturesDir = join(import.meta.dirname, '..', 'fixtures')

test('interceptors as undici options', async t => {
  const idpServer = await idp({ port: 0 })
  const externalServer = await external()

  await externalServer.listen({ port: 0 })

  process.env.PLT_IDP_TOKEN_URL = idpServer.listeningOrigin + '/token'
  process.env.PLT_REFRESH_TOKEN = idpServer.refreshToken
  process.env.PLT_EXTERNAL_SERVICE = externalServer.listeningOrigin
  process.env.PORT = 0

  const configFile = join(fixturesDir, 'interceptors', 'platformatic.runtime.json')
  const app = await createRuntime(configFile)
  const entryUrl = await app.start()

  t.after(async () => {
    await Promise.all([idpServer.close(), externalServer.close(), app.close()])
  })

  {
    const res = await request(entryUrl + '/hello')

    strictEqual(res.statusCode, 200)
    deepStrictEqual(await res.body.json(), { hello: 'world' })
  }
})

test('composable interceptors', async t => {
  const idpServer = await idp({ port: 0 })
  const externalServer = await external()

  await externalServer.listen({ port: 0 })

  process.env.PLT_IDP_TOKEN_URL = idpServer.listeningOrigin + '/token'
  process.env.PLT_REFRESH_TOKEN = idpServer.refreshToken
  process.env.PLT_EXTERNAL_SERVICE = externalServer.listeningOrigin
  process.env.PORT = 0

  const configFile = join(fixturesDir, 'interceptors-2', 'platformatic.runtime.json')
  const app = await createRuntime(configFile)
  const entryUrl = await app.start()

  t.after(async () => {
    await Promise.all([idpServer.close(), externalServer.close(), app.close()])
  })

  {
    const res = await request(entryUrl + '/hello')

    strictEqual(res.statusCode, 200)
    deepStrictEqual(await res.body.json(), { hello: 'world' })
  }
})

test('mesh network works from external processes via ChildManager', async t => {
  const configFile = join(fixturesDir, 'interceptors-3', 'platformatic.json')
  const app = await createRuntime(configFile)
  const entryUrl = await app.start()

  t.after(async () => {
    await app.close()
  })

  {
    const res = await request(entryUrl + '/node/')
    const body = await res.body.json()

    notEqual(body.pid, process.pid)

    deepStrictEqual(body.responses[0], {
      body: {
        from: 'a'
      },
      statusCode: 200
    })

    deepStrictEqual(body.responses[1], {
      body: {
        from: 'b'
      },
      statusCode: 200
    })

    deepStrictEqual(body.responses[2].statusCode, 502)
    deepStrictEqual(Object.keys(body.responses[2].body).sort(), ['message', 'stack'])

    deepStrictEqual(body.responses[3], {
      body: `application/octet-stream:123:${'echo'.repeat(10)}`,
      statusCode: 200
    })
  }
})

test('use client interceptors for internal requests', async t => {
  const configFile = join(fixturesDir, 'interceptors-4', 'platformatic.runtime.json')
  const app = await createRuntime(configFile)
  const entryUrl = await app.start()

  t.after(() => app.close())

  const { statusCode, body } = await request(entryUrl + '/hello')

  strictEqual(statusCode, 200)
  deepStrictEqual(await body.json(), {
    reqIntercepted: 'true',
    resIntercepted: 'true',
    reqInterceptedValue: 'initial'
  })
})

test('update undici interceptor config', async t => {
  const configFile = join(fixturesDir, 'interceptors-4', 'platformatic.runtime.json')
  const app = await createRuntime(configFile)
  const entryUrl = await app.start()

  t.after(() => app.close())

  {
    const { statusCode, body } = await request(entryUrl + '/hello')
    strictEqual(statusCode, 200)
    deepStrictEqual(await body.json(), {
      reqIntercepted: 'true',
      resIntercepted: 'true',
      reqInterceptedValue: 'initial'
    })
  }

  const newUndiciConfig = {
    interceptors: [
      {
        module: './interceptor.js',
        options: { testInterceptedValue: 'updated' }
      }
    ]
  }

  // Update the undici interceptor config
  await app.updateUndiciInterceptors(newUndiciConfig)

  {
    const { statusCode, body } = await request(entryUrl + '/hello')
    strictEqual(statusCode, 200)
    deepStrictEqual(await body.json(), {
      reqIntercepted: 'true',
      resIntercepted: 'true',
      reqInterceptedValue: 'updated'
    })
  }

  const runtimeConfig = await app.getRuntimeConfig()
  deepStrictEqual(runtimeConfig.undici, newUndiciConfig)
})

test('interceptor readiness timeout handling', async t => {
  const configFile = join(fixturesDir, 'interceptors-timeout', 'platformatic.runtime.json')
  const app = await createRuntime(configFile)

  // Note that this throws only because restartOnError is set to false in the config.
  // In the real world the app would keep trying to restart.
  try {
    await app.start()
  } catch (err) {
    strictEqual(err.message, 'The worker 0 of the application "main" failed to join the mesh network in 3000ms.')
  }

  t.after(() => app.close())
})
