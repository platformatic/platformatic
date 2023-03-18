'use strict'

const { mkdtempSync, writeFileSync } = require('fs')
const { tmpdir } = require('os')
const { isAbsolute, join, relative } = require('path')
const selfCert = require('self-cert')
const { test } = require('tap')
const { Agent, setGlobalDispatcher, request } = require('undici')
const { buildServer } = require('..')
const { buildConfig } = require('./helper')

test('supports https options', async ({ teardown, equal, same, plan }) => {
  plan(7)

  const { certificate, privateKey } = selfCert({})
  const tmpDir = mkdtempSync(join(tmpdir(), 'plt-service-https-test-'))
  const privateKeyPath = join(tmpDir, 'plt.key')
  const certificatePath = join(tmpDir, 'plt.cert')
  const certificateRelativePath = relative(__dirname, certificatePath)

  writeFileSync(privateKeyPath, privateKey)
  writeFileSync(certificatePath, certificate)

  setGlobalDispatcher(new Agent({
    connect: {
      rejectUnauthorized: false
    }
  }))

  const server = await buildServer(buildConfig({
    server: {
      hostname: '127.0.0.1',
      port: 0,
      https: {
        key: privateKey,
        cert: [{ path: certificateRelativePath }]
      }
    }
  }))

  teardown(server.stop)
  await server.listen()

  equal(isAbsolute(server.app.platformatic.configManager.current.server.https.cert[0].path), true)
  equal(server.url.startsWith('https://'), true)
  let res = await (request(`${server.url}/`))
  equal(res.statusCode, 200)
  let body = await res.body.json()
  same(body, { message: 'Welcome to Platformatic! Please visit https://oss.platformatic.dev' })

  await server.restart()

  equal(server.url.startsWith('https://'), true)
  res = await (request(`${server.url}/`))
  equal(res.statusCode, 200)
  body = await res.body.json()
  same(body, { message: 'Welcome to Platformatic! Please visit https://oss.platformatic.dev' })
})
