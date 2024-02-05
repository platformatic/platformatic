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

test('interceptors', async (t) => {
  const idpServer = await idp({ port: 0 })
  const externalServer = await external()

  await externalServer.listen({ port: 0 })

  process.env.PLT_REFRESH_TOKEN = idpServer.refreshToken
  process.env.PLT_EXTERNAL_SERVICE = externalServer.listeningOrigin
  process.env.PORT = 0

  const configFile = join(fixturesDir, 'interceptors', 'platformatic.runtime.json')
  const config = await loadConfig({}, ['-c', configFile], platformaticRuntime)
  const app = await buildServer(config.configManager.current)
  const entryUrl = await app.start()

  t.after(async () => {
    await Promise.all([
      idpServer.close(),
      externalServer.close(),
      app.close()
    ])
  })

  {
    const res = await request(entryUrl + '/hello')

    assert.strictEqual(res.statusCode, 200)
    assert.deepStrictEqual(await res.body.json(), { hello: 'world' })
  }
})
