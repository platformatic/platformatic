import assert from 'node:assert'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pipeline } from 'node:stream/promises'
import { test } from 'node:test'
import { createGunzip } from 'node:zlib'
import { request } from 'undici'
import { platformaticService } from '../index.js'
import { createFromConfig } from './helper.js'

async function myApp (app, capability) {
  await platformaticService(app, capability)
  app.get('/', () => 'hello world')
}

test('customize service', async t => {
  const app = await createFromConfig(
    t,
    {
      server: {
        hostname: '127.0.0.1',
        port: 0,
        logger: { level: 'fatal' }
      }
    },
    myApp
  )

  t.after(async () => {
    await app.stop()
  })
  await app.start({ listen: true })

  const res = await request(app.url)
  const body = await res.body.text()
  assert.strictEqual(res.statusCode, 200)
  assert.strictEqual(body, 'hello world')
})

test('catch errors from the other side', async t => {
  const app = await createFromConfig(
    t,
    {
      server: {
        hostname: '127.0.0.1',
        port: 0,
        logger: { level: 'fatal' }
      },
      plugins: {
        paths: [
          {
            path: resolve(import.meta.dirname, './fixtures/other-side.js')
          }
        ]
      }
    },
    myApp
  )

  t.after(async () => {
    await app.stop()
  })
  await app.start({ listen: true })

  const res = await request(app.url)
  const body = await res.body.json()
  assert.strictEqual(res.statusCode, 500)
  assert.deepStrictEqual(body, {
    statusCode: 500,
    error: 'Internal Server Error',
    message: 'kaboom'
  })
})

test('accept packages', async t => {
  const app = await createFromConfig(t, {
    server: {
      hostname: '127.0.0.1',
      port: 0,
      logger: { level: 'fatal' }
    },
    plugins: {
      packages: [
        {
          name: '@fastify/compress',
          options: {
            threshold: 1 // 1 byte
          }
        }
      ]
    }
  })

  t.after(async () => {
    await app.stop()
  })
  await app.start({ listen: true })

  const res = await request(app.url, {
    headers: {
      'accept-encoding': 'gzip'
    }
  })
  assert.strictEqual(res.statusCode, 200)
  let body = ''
  await pipeline(res.body, createGunzip(), async function * (stream) {
    stream.setEncoding('utf8')
    for await (const chunk of stream) {
      body += chunk
    }
  })
  assert.deepStrictEqual(JSON.parse(body), {
    message: 'Welcome to Platformatic! Please visit https://docs.platformatic.dev'
  })
})

test('accept packages / string form', async t => {
  const app = await createFromConfig(t, {
    server: {
      hostname: '127.0.0.1',
      port: 0,
      logger: { level: 'fatal' }
    },
    plugins: {
      packages: ['@fastify/compress']
    }
  })

  t.after(async () => {
    await app.stop()
  })
  await app.start({ listen: true })

  assert.match(app.getApplication().printPlugins(), /@fastify\/compress/)
})

test('accept packages / with typescript on', async t => {
  const app = await createFromConfig(t, {
    server: {
      hostname: '127.0.0.1',
      port: 0,
      logger: { level: 'fatal' }
    },
    plugins: {
      packages: ['@fastify/compress']
    }
  })

  t.after(async () => {
    await app.stop()
  })
  await app.start({ listen: true })

  assert.match(app.getApplication().printPlugins(), /@fastify\/compress/)
})

test('customize service without toLoad', async t => {
  const app = await createFromConfig(
    t,
    {
      server: {
        hostname: '127.0.0.1',
        port: 0,
        logger: { level: 'fatal' }
      }
    },
    myApp
  )

  t.after(async () => {
    await app.stop()
  })
  await app.start({ listen: true })

  const res = await request(app.url)
  const body = await res.body.text()
  assert.strictEqual(res.statusCode, 200)
  assert.strictEqual(body, 'hello world')
})

test('customize service with beforePlugins', async t => {
  const app = await createFromConfig(
    t,
    {
      server: {
        hostname: '127.0.0.1',
        port: 0,
        logger: { level: 'fatal' }
      }
    },
    myApp
  )

  t.after(async () => {
    await app.stop()
  })
  await app.start({ listen: true })

  const res = await request(app.url)
  const body = await res.body.text()
  assert.strictEqual(res.statusCode, 200)
  assert.strictEqual(body, 'hello world')
})

test('@fastify/static serving root without wildcards', async t => {
  const app = await createFromConfig(t, {
    server: {
      hostname: '127.0.0.1',
      port: 0,
      logger: { level: 'fatal' }
    },
    plugins: {
      paths: [
        {
          path: resolve(import.meta.dirname, './fixtures/root-static.js')
        }
      ]
    }
  })

  t.after(async () => {
    await app.stop()
  })
  await app.start({ listen: true })

  const res = await request(app.url)
  const body = await res.body.text()
  const expected = await readFile(resolve(import.meta.dirname, './fixtures/hello/index.html'), 'utf8')
  assert.strictEqual(res.statusCode, 200)
  assert.strictEqual(body, expected)
})
