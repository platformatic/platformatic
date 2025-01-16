'use strict'
const assert = require('node:assert')
const { join } = require('node:path')
const { test } = require('node:test')
const { request } = require('undici')
const { loadConfig } = require('@platformatic/config')
const { buildServer, platformaticRuntime } = require('..')
const fixturesDir = join(__dirname, '..', 'fixtures')
const idp = require(join(fixturesDir, 'interceptors', 'idp'))
const external = require(join(fixturesDir, 'interceptors', 'external'))

test('interceptors as undici options', async t => {
  const idpServer = await idp({ port: 0 })
  const externalServer = await external()

  await externalServer.listen({ port: 0 })

  process.env.PLT_IDP_TOKEN_URL = idpServer.listeningOrigin + '/token'
  process.env.PLT_REFRESH_TOKEN = idpServer.refreshToken
  process.env.PLT_EXTERNAL_SERVICE = externalServer.listeningOrigin
  process.env.PORT = 0

  const configFile = join(fixturesDir, 'interceptors', 'platformatic.runtime.json')
  const config = await loadConfig({}, ['-c', configFile], platformaticRuntime)
  const app = await buildServer(config.configManager.current)
  const entryUrl = await app.start()

  t.after(async () => {
    await Promise.all([idpServer.close(), externalServer.close(), app.close()])
  })

  {
    const res = await request(entryUrl + '/hello')

    assert.strictEqual(res.statusCode, 200)
    assert.deepStrictEqual(await res.body.json(), { hello: 'world' })
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
  const config = await loadConfig({}, ['-c', configFile], platformaticRuntime)
  const app = await buildServer(config.configManager.current)
  const entryUrl = await app.start()

  t.after(async () => {
    await Promise.all([idpServer.close(), externalServer.close(), app.close()])
  })

  {
    const res = await request(entryUrl + '/hello')

    assert.strictEqual(res.statusCode, 200)
    assert.deepStrictEqual(await res.body.json(), { hello: 'world' })
  }
})

test.only('mesh network works from external processes via ChildManager', async t => {
  const configFile = join(fixturesDir, 'interceptors-3', 'platformatic.json')
  const config = await loadConfig({}, ['-c', configFile], platformaticRuntime)
  const app = await buildServer(config.configManager.current)
  const entryUrl = await app.start()

  t.after(async () => {
    await app.close()
  })

  {
    const res = await request(entryUrl + '/node/')
    const body = await res.body.json()

    assert.notEqual(body.pid, process.pid)
    assert.deepStrictEqual(body.responses, [
      {
        body: {
          from: 'a'
        },
        statusCode: 200
      },
      {
        body: {
          from: 'b'
        },
        statusCode: 200
      },
      {
        body: {
          code: 'ENOTFOUND',
          errno: -3008,
          hostname: 'c.plt.local',
          message: 'getaddrinfo ENOTFOUND c.plt.local',
          stack:
            'Error: getaddrinfo ENOTFOUND c.plt.local\n' +
            '    at GetAddrInfoReqWrap.onlookupall [as oncomplete] (node:dns:120:26)',
          syscall: 'getaddrinfo'
        },
        statusCode: 502
      },
      {
        body: `application/octet-stream:123:${'echo'.repeat(10)}`,
        statusCode: 200
      }
    ])
  }
})
