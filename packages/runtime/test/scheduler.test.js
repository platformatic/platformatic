'use strict'

const assert = require('node:assert')
const { test } = require('node:test')
const { join } = require('node:path')
const { create } = require('../index.js')
const { transform } = require('../lib/config')
const fixturesDir = join(__dirname, '..', 'fixtures')
const Fastify = require('fastify')
const { once, EventEmitter } = require('events')
const { setTimeout: sleep } = require('node:timers/promises')
const { request } = require('undici')

async function createRuntime (t, scheduler) {
  const configFile = join(fixturesDir, 'scheduler', 'platformatic.json')

  const app = await create(configFile, null, {
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
    await createRuntime(t, [
      {
        name: 'test',
        cron: 'BOOM!', // not valid
        callbackUrl,
        method: 'GET'
      }
    ])

    assert.fail('Should throw')
  } catch (e) {
    assert.strictEqual(e.message, 'Invalid cron expression "BOOM!" for scheduler "test"')
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

  const app = await createRuntime(t, [
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

  const app = await createRuntime(t, [
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
  assert.equal(calls.length, 0, 'Should not have been called')
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

  const app = await createRuntime(t, [
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
  assert.deepStrictEqual(calls.slice(0, 3), ['failure', 'failure', 'success'])
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

  const app = await createRuntime(t, [
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
  assert.deepStrictEqual(bodyCall, { test: 'test' })
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

  const app = await createRuntime(t, [
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
  assert.deepStrictEqual(bodyCall, 'test')
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

  const app = await createRuntime(t, [
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
  assert.deepStrictEqual(attempts, [1, 2, 3, 1])
})

test('Works with the mesh network', async t => {
  const port = 16667
  const callbackUrl = `http://service.plt.local:${port}/inc`

  const app = await createRuntime(t, [
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
  assert.ok(counter > 0)
})
