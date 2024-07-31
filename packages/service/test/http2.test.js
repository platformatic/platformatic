'use strict'

const assert = require('node:assert')
const { tmpdir } = require('node:os')
const { test } = require('node:test')
const { join, relative } = require('node:path')
const { mkdtemp, writeFile } = require('node:fs/promises')
const selfCert = require('self-cert')
const { Agent, request } = require('undici')
const { buildServer } = require('..')
const { buildConfig } = require('./helper')

const isNode18 = process.versions.node.startsWith('18')

test('supports http2 options', { skip: isNode18 }, async (t) => {
  const { certificate, privateKey } = selfCert({})
  const localDir = tmpdir()
  const tmpDir = await mkdtemp(join(localDir, 'plt-service-https-test-'))
  const privateKeyPath = join(tmpDir, 'plt.key')
  const certificatePath = join(tmpDir, 'plt.cert')
  const certificateRelativePath = relative(process.cwd(), certificatePath)

  await writeFile(privateKeyPath, privateKey)
  await writeFile(certificatePath, certificate)

  const agent = new Agent({
    // use HTTP/2
    allowH2: true,
    keepAliveTimeout: 100,
    keepAliveMaxTimeout: 100,
    connect: {
      rejectUnauthorized: false,
    },
  })

  const app = await buildServer(buildConfig({
    server: {
      hostname: '127.0.0.1',
      port: 0,
      http2: true,
      https: {
        key: privateKey,
        cert: [{ path: certificateRelativePath }],
      },
    },
  }))

  t.after(async () => {
    agent.destroy()
    await app.close()
  })

  await app.start()

  assert.strictEqual(app.url.startsWith('https://'), true)
  let res = await (request(`${app.url}/`, {
    dispatcher: agent,
  }))
  assert.strictEqual(res.statusCode, 200)
  let body = await res.body.json()
  assert.deepStrictEqual(body, { message: 'Welcome to Platformatic! Please visit https://docs.platformatic.dev' })

  await app.restart()

  assert.strictEqual(app.url.startsWith('https://'), true)
  res = await (request(`${app.url}/`, {
    dispatcher: agent,
  }))

  assert.strictEqual(res.statusCode, 200)
  body = await res.body.json()
  assert.deepStrictEqual(body, { message: 'Welcome to Platformatic! Please visit https://docs.platformatic.dev' })

  // This uses the HTTP/1 agent
  await assert.rejects(request(`${app.url}/`))
})

test('supports allowHTTP1 with HTTP/2', { skip: isNode18 }, async (t) => {
  const { certificate, privateKey } = selfCert({})
  const localDir = tmpdir()
  const tmpDir = await mkdtemp(join(localDir, 'plt-service-https-test-'))
  const privateKeyPath = join(tmpDir, 'plt.key')
  const certificatePath = join(tmpDir, 'plt.cert')
  const certificateRelativePath = relative(process.cwd(), certificatePath)

  await writeFile(privateKeyPath, privateKey)
  await writeFile(certificatePath, certificate)

  const agent = new Agent({
    keepAliveTimeout: 100,
    keepAliveMaxTimeout: 100,
    connect: {
      rejectUnauthorized: false,
    },
  })

  const app = await buildServer(buildConfig({
    server: {
      hostname: '127.0.0.1',
      port: 0,
      http2: true,
      https: {
        allowHTTP1: true,
        key: privateKey,
        cert: [{ path: certificateRelativePath }],
      },
    },
  }))

  t.after(async () => {
    agent.destroy()
    await app.close()
  })

  await app.start()

  assert.strictEqual(app.url.startsWith('https://'), true)
  let res = await (request(`${app.url}/`, {
    dispatcher: agent,
  }))
  assert.strictEqual(res.statusCode, 200)
  let body = await res.body.json()
  assert.deepStrictEqual(body, { message: 'Welcome to Platformatic! Please visit https://docs.platformatic.dev' })

  await app.restart()

  assert.strictEqual(app.url.startsWith('https://'), true)
  res = await (request(`${app.url}/`, {
    dispatcher: agent,
  }))
  assert.strictEqual(res.statusCode, 200)
  body = await res.body.json()
  assert.deepStrictEqual(body, { message: 'Welcome to Platformatic! Please visit https://docs.platformatic.dev' })
})
