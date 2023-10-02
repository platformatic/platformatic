'use strict'

const assert = require('node:assert')
const { tmpdir } = require('node:os')
const { test } = require('node:test')
const { join, relative } = require('node:path')
const { mkdtemp, writeFile } = require('node:fs/promises')
const selfCert = require('self-cert')
const { Agent, setGlobalDispatcher, request } = require('undici')
const { buildServer } = require('..')
const { buildConfig } = require('./helper')

test('supports https options', async (t) => {
  const { certificate, privateKey } = selfCert({})
  const localDir = tmpdir()
  const tmpDir = await mkdtemp(join(localDir, 'plt-service-https-test-'))
  const privateKeyPath = join(tmpDir, 'plt.key')
  const certificatePath = join(tmpDir, 'plt.cert')
  const certificateRelativePath = relative(process.cwd(), certificatePath)

  await writeFile(privateKeyPath, privateKey)
  await writeFile(certificatePath, certificate)

  setGlobalDispatcher(new Agent({
    connect: {
      rejectUnauthorized: false
    }
  }))

  const app = await buildServer(buildConfig({
    server: {
      hostname: '127.0.0.1',
      port: 0,
      https: {
        key: privateKey,
        cert: [{ path: certificateRelativePath }]
      }
    }
  }))

  t.after(async () => {
    await app.close()
  })

  await app.start()

  assert.strictEqual(app.url.startsWith('https://'), true)
  let res = await (request(`${app.url}/`))
  assert.strictEqual(res.statusCode, 200)
  let body = await res.body.json()
  assert.deepStrictEqual(body, { message: 'Welcome to Platformatic! Please visit https://docs.platformatic.dev' })

  await app.restart()

  assert.strictEqual(app.url.startsWith('https://'), true)
  res = await (request(`${app.url}/`))
  assert.strictEqual(res.statusCode, 200)
  body = await res.body.json()
  assert.deepStrictEqual(body, { message: 'Welcome to Platformatic! Please visit https://docs.platformatic.dev' })
})
