import assert from 'node:assert'
import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, relative } from 'node:path'
import { test } from 'node:test'
import selfCert from 'self-cert'
import { Agent, request } from 'undici'
import { create } from '../index.js'
import { buildConfig } from './helper.js'

test('supports http2 options', async t => {
  const { certificate, privateKey } = selfCert({})
  const localDir = process.env.RUNNER_TEMP ?? tmpdir()
  const tmpDir = await mkdtemp(join(localDir, 'plt-service-https-test-'))
  const privateKeyPath = join(tmpDir, 'plt.key')
  const certificatePath = join(tmpDir, 'plt.cert')

  await writeFile(privateKeyPath, privateKey)
  await writeFile(certificatePath, certificate)

  const agent = new Agent({
    // use HTTP/2
    allowH2: true,
    keepAliveTimeout: 100,
    keepAliveMaxTimeout: 100,
    connect: {
      rejectUnauthorized: false
    }
  })

  const app = await create(
    tmpDir,
    buildConfig({
      server: {
        hostname: '127.0.0.1',
        port: 0,
        logger: { level: 'fatal' },
        http2: true,
        https: {
          key: privateKey,
          cert: [{ path: certificatePath }]
        }
      }
    })
  )

  t.after(async () => {
    agent.destroy()
    await app.stop()
  })

  await app.start({ listen: true })

  assert.strictEqual(app.url.startsWith('https://'), true)
  const res = await request(`${app.url}/`, { dispatcher: agent })
  assert.strictEqual(res.statusCode, 200)
  const body = await res.body.json()
  assert.deepStrictEqual(body, { message: 'Welcome to Platformatic! Please visit https://docs.platformatic.dev' })

  // This uses the HTTP/1 agent
  await assert.rejects(request(`${app.url}/`))
})

test('supports allowHTTP1 with HTTP/2', async t => {
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
      rejectUnauthorized: false
    }
  })

  const app = await create(
    tmpDir,
    buildConfig({
      server: {
        hostname: '127.0.0.1',
        port: 0,
        logger: { level: 'fatal' },
        http2: true,
        https: {
          allowHTTP1: true,
          key: privateKey,
          cert: [{ path: certificateRelativePath }]
        }
      }
    })
  )

  t.after(async () => {
    agent.destroy()
    await app.stop()
  })

  await app.start({ listen: true })

  assert.strictEqual(app.url.startsWith('https://'), true)
  const res = await request(`${app.url}/`, { dispatcher: agent })
  assert.strictEqual(res.statusCode, 200)
  const body = await res.body.json()
  assert.deepStrictEqual(body, { message: 'Welcome to Platformatic! Please visit https://docs.platformatic.dev' })
})
