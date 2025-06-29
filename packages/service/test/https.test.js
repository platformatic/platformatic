'use strict'

const assert = require('node:assert')
const { tmpdir } = require('node:os')
const { test } = require('node:test')
const { join, relative } = require('node:path')
const { mkdtemp, writeFile } = require('node:fs/promises')
const selfCert = require('self-cert')
const { Agent, setGlobalDispatcher, request } = require('undici')
const { buildConfig, createFromConfig } = require('./helper')

test('supports https options', async t => {
  const { certificate, privateKey } = selfCert({})
  const localDir = tmpdir()
  const tmpDir = await mkdtemp(join(localDir, 'plt-service-https-test-'))
  const privateKeyPath = join(tmpDir, 'plt.key')
  const certificatePath = join(tmpDir, 'plt.cert')
  const certificateRelativePath = relative(process.cwd(), certificatePath)

  await writeFile(privateKeyPath, privateKey)
  await writeFile(certificatePath, certificate)

  setGlobalDispatcher(
    new Agent({
      connect: {
        rejectUnauthorized: false
      }
    })
  )

  const app = await createFromConfig(
    t,
    buildConfig({
      server: {
        hostname: '127.0.0.1',
        port: 0,
        logger: { level: 'fatal' },
        https: {
          key: privateKey,
          cert: [{ path: certificateRelativePath }]
        }
      }
    })
  )

  t.after(async () => {
    await app.stop()
  })

  await app.start({ listen: true })

  assert.strictEqual(app.url.startsWith('https://'), true)
  const res = await request(`${app.url}/`)
  assert.strictEqual(res.statusCode, 200)
  const body = await res.body.json()
  assert.deepStrictEqual(body, { message: 'Welcome to Platformatic! Please visit https://docs.platformatic.dev' })
})
