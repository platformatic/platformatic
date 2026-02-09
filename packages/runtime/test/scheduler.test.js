import { EventEmitter, once } from 'events'
import Fastify from 'fastify'
import { deepStrictEqual, equal, fail, ok, strictEqual } from 'node:assert'
import { join } from 'node:path'
import { test } from 'node:test'
import { setTimeout as sleep } from 'node:timers/promises'
import { request } from 'undici'
import { transform } from '../lib/config.js'
import { createRuntime } from './helpers.js'

const fixturesDir = join(import.meta.dirname, '..', 'fixtures')

async function createRuntimeWithScheduler (t, scheduler) {
  const configFile = join(fixturesDir, 'scheduler', 'platformatic.json')

  const app = await createRuntime(configFile, null, {
    async transform (config, ...args) {
      config = await transform(config, ...args)
      config.scheduler = scheduler
      return config
    }
  })

  t.after(() => app.close())
  await app.init()

  return app
}

test('Should throw if cron is not valid', async t => {
  const ee = new EventEmitter()
  const target = Fastify()
  target.get('/test', async (req, reply) => {
    ee.emit('target called')
    return { ok: true }
  })
  t.after(() => target.close())

  await target.listen({ port: 0 })
  const callbackUrl = `http://localhost:${target.server.address().port}/test`

  try {
    await createRuntimeWithScheduler(t, [
      {
        name: 'test',
        cron: 'BOOM!', // not valid
        callbackUrl,
        method: 'GET'
      }
    ])

    fail('Should throw')
  } catch (e) {
    strictEqual(e.message, 'Invalid cron expression "BOOM!" for scheduler "test"')
  }
})

test('Start a job that hits a server with a GET', async t => {
  const ee = new EventEmitter()
  const target = Fastify()
  target.get('/test', async (req, reply) => {
    ee.emit('target called')
    return { ok: true }
  })
  t.after(() => target.close())

  await target.listen({ port: 0 })
  const callbackUrl = `http://localhost:${target.server.address().port}/test`

  const app = await createRuntimeWithScheduler(t, [
    {
      name: 'test',
      cron: '*/1 * * * * *', // every second
      callbackUrl,
      method: 'GET'
    }
  ])

  t.after(() => app.close())
  // should be called multiple times (one time per second)
  await once(ee, 'target called')
  await once(ee, 'target called')
  await once(ee, 'target called')
})

test('Should not start a job if disabled', async t => {
  const target = Fastify()
  const calls = []
  target.get('/test', async (req, reply) => {
    calls.push('called')
  })
  t.after(() => target.close())

  await target.listen({ port: 0 })
  const callbackUrl = `http://localhost:${target.server.address().port}/test`

  const app = await createRuntimeWithScheduler(t, [
    {
      enabled: false,
      name: 'test',
      cron: '*/1 * * * * *', // every second
      callbackUrl,
      method: 'GET'
    }
  ])

  t.after(() => app.close())
  await new Promise(resolve => setTimeout(resolve, 3000))
  equal(calls.length, 0, 'Should not have been called')
})

test('Should retry 3 times if fails ', async t => {
  const ee = new EventEmitter()
  const target = Fastify()
  let attempts = 0
  const calls = []
  target.get('/test', async (req, reply) => {
    attempts++

    if (attempts < 3) {
      calls.push('failure')
      throw new Error('fail')
    }
    calls.push('success')
    ee.emit('success')
    return { ok: true }
  })
  t.after(() => target.close())
  await target.listen({ port: 0 })
  const callbackUrl = `http://localhost:${target.server.address().port}/test`

  const app = await createRuntimeWithScheduler(t, [
    {
      name: 'test2',
      cron: '*/1 * * * * *', // every second
      callbackUrl,
      method: 'GET'
    }
  ])
  t.after(() => app.close())
  // 3 attempts, the third one should succeed
  await once(ee, 'success')
  deepStrictEqual(calls.slice(0, 3), ['failure', 'failure', 'success'])
})

test('Start a job that hits a server with a POST of a JSON', async t => {
  const ee = new EventEmitter()
  const target = Fastify()
  let bodyCall = null
  target.post('/test', async (req, reply) => {
    const body = await req.body
    bodyCall = body
    ee.emit('target called')
    return { ok: true }
  })
  t.after(() => target.close())

  await target.listen({ port: 0 })
  const callbackUrl = `http://localhost:${target.server.address().port}/test`

  const app = await createRuntimeWithScheduler(t, [
    {
      name: 'test',
      cron: '*/1 * * * * *', // every second
      callbackUrl,
      body: { test: 'test' },
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }
  ])
  t.after(() => app.close())
  // should be called multiple times (one time per second)
  await once(ee, 'target called')
  deepStrictEqual(bodyCall, { test: 'test' })
})

test('Start a job that hits a server with a POST of a TXT', async t => {
  const ee = new EventEmitter()
  const target = Fastify()
  let bodyCall = null
  target.post('/test', async (req, reply) => {
    const body = await req.body
    bodyCall = body
    ee.emit('target called')
    return { ok: true }
  })
  t.after(() => target.close())

  await target.listen({ port: 0 })
  const callbackUrl = `http://localhost:${target.server.address().port}/test`

  const app = await createRuntimeWithScheduler(t, [
    {
      name: 'test',
      cron: '*/1 * * * * *', // every second
      callbackUrl,
      body: 'test',
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' }
    }
  ])
  t.after(async () => app.close())
  // should be called multiple times (one time per second)
  await once(ee, 'target called')
  deepStrictEqual(bodyCall, 'test')
})

test('Shoud stop retrying after 3 times ', async t => {
  const ee = new EventEmitter()
  const target = Fastify()
  const attempts = []
  target.get('/test', async (req, reply) => {
    const attempt = req.headers['x-retry-attempt']
    // 3 attempts, the should be reset
    if (attempts.length < 4) {
      attempts.push(+attempt)
      throw new Error('fail')
    }
    ee.emit('success')
  })
  t.after(() => target.close())
  await target.listen({ port: 0 })
  const callbackUrl = `http://localhost:${target.server.address().port}/test`

  const app = await createRuntimeWithScheduler(t, [
    {
      name: 'test2',
      cron: '*/1 * * * * *', // every second
      callbackUrl,
      method: 'GET'
    }
  ])
  t.after(() => app.close())

  await once(ee, 'success')

  // 3 attempts, then should be reset
  deepStrictEqual(attempts, [1, 2, 3, 1])
})

test('Works with the mesh network', async t => {
  const port = 16667
  const callbackUrl = `http://service.plt.local:${port}/inc`

  const app = await createRuntimeWithScheduler(t, [
    {
      name: 'test',
      cron: '*/1 * * * * *', // every second
      callbackUrl,
      headers: {
        'content-type': 'application/json'
      },
      method: 'POST'
    }
  ])
  t.after(() => app.close())

  const entryUrl = await app.start()
  await sleep(1500)
  const res = await request(`${entryUrl}/counter`)

  const body = await res.body.json()
  const { counter } = body
  ok(counter > 0)
})

test('Should not start scheduler in build mode', async t => {
  const ee = new EventEmitter()
  const target = Fastify()
  let callCount = 0

  target.get('/test', async (req, reply) => {
    callCount++
    ee.emit('target called')
    return { ok: true }
  })
  t.after(() => target.close())

  await target.listen({ port: 0 })
  const callbackUrl = `http://localhost:${target.server.address().port}/test`

  const configFile = join(fixturesDir, 'scheduler', 'platformatic.json')
  const app = await createRuntime(configFile, null, {
    build: true,
    async transform (config, ...args) {
      config = await transform(config, ...args)
      config.scheduler = [
        {
          name: 'test',
          cron: '*/1 * * * * *', // every second
          callbackUrl,
          method: 'GET'
        }
      ]
      return config
    }
  })

  t.after(() => app.close())
  await app.init()

  // Wait for 2 seconds - scheduler should not run in build mode
  await sleep(2000)

  // Verify the endpoint was never called
  strictEqual(callCount, 0, 'Scheduler should not run in build mode')
})
