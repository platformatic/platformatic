'use strict'

const assert = require('node:assert')
const { join } = require('node:path')
const { test } = require('node:test')
const { Client } = require('undici')

const { createRuntime } = require('../helpers.js')
const fixturesDir = join(__dirname, '..', '..', 'fixtures')

const platformaticVersion = require('../../package.json').version

test('should get the runtime metadata', async (t) => {
  const projectDir = join(fixturesDir, 'management-api')
  const configFile = join(projectDir, 'platformatic.json')
  const app = await createRuntime(configFile)

  await app.start()

  const client = new Client({
    hostname: 'localhost',
    protocol: 'http:',
  }, {
    socketPath: app.getManagementApiUrl(),
    keepAliveTimeout: 10,
    keepAliveMaxTimeout: 10,
  })

  t.after(async () => {
    await Promise.all([
      client.close(),
      app.close(),
    ])
  })

  const { statusCode, body } = await client.request({
    method: 'GET',
    path: '/api/v1/metadata',
  })

  assert.strictEqual(statusCode, 200)

  const entrypoint = await app.getEntrypointDetails()

  const metadata = await body.json()
  assert.equal(metadata.pid, process.pid)
  assert.equal(metadata.cwd, process.cwd())
  assert.equal(metadata.execPath, process.execPath)
  assert.equal(metadata.nodeVersion, process.version)
  assert.equal(metadata.packageName, 'test-runtime-package')
  assert.equal(metadata.packageVersion, '1.0.42')
  assert.equal(metadata.projectDir, projectDir)
  assert.equal(metadata.url, entrypoint.url)
  assert.equal(metadata.platformaticVersion, platformaticVersion)

  assert.ok(metadata.uptimeSeconds >= 0)
  assert.ok(metadata.uptimeSeconds < 10)
})
