'use strict'

const assert = require('node:assert')
const { test } = require('node:test')
const { join } = require('node:path')
const { loadConfig } = require('@platformatic/config')
const { platformaticRuntime } = require('..')
const { buildServer } = require('..')
const fixturesDir = join(__dirname, '..', 'fixtures')
const Fastify = require('fastify')
const { once, EventEmitter } = require('events')

test('Should throw if cron is not valid', async (t) => {
  const ee = new EventEmitter()
  const target = Fastify()
  target.get('/test', async (req, reply) => {
    ee.emit('target called')
    return { ok: true }
  })
  t.after(() => target.close())

  await target.listen({ port: 0 })
  const callbackUrl = `http://localhost:${target.server.address().port}/test`

  const configFile = join(fixturesDir, 'scheduler', 'platformatic.json')
  const config = await loadConfig({}, ['-c', configFile], platformaticRuntime)
  config.configManager.current.scheduler = [
    {
      name: 'test',
      cron: 'BOOM!', // not valid
      callbackUrl,
      method: 'GET',
    },
  ]
  try {
    await buildServer(config.configManager.current)
    assert.fail('Should throw')
  } catch (e) {
    assert.strictEqual(e.message, 'Invalid cron expression "BOOM!" for scheduler "test"')
  }
})

test('Start a job that hits a server with a GET', async (t) => {
  const ee = new EventEmitter()
  const target = Fastify()
  target.get('/test', async (req, reply) => {
    ee.emit('target called')
    return { ok: true }
  })
  t.after(() => target.close())

  await target.listen({ port: 0 })
  const callbackUrl = `http://localhost:${target.server.address().port}/test`

  const configFile = join(fixturesDir, 'scheduler', 'platformatic.json')
  const config = await loadConfig({}, ['-c', configFile], platformaticRuntime)
  config.configManager.current.scheduler = [
    {
      name: 'test',
      cron: '*/1 * * * * *', // every second
      callbackUrl,
      method: 'GET',
    },
  ]
  const app = await buildServer(config.configManager.current)
  t.after(() => app.close())
  // should be called multiple times (one time per second)
  await once(ee, 'target called')
  await once(ee, 'target called')
  await once(ee, 'target called')
})

test('Should not start a job if disabled', async (t) => {
  const target = Fastify()
  const calls = []
  target.get('/test', async (req, reply) => {
    calls.push('called')
  })
  t.after(() => target.close())

  await target.listen({ port: 0 })
  const callbackUrl = `http://localhost:${target.server.address().port}/test`

  const configFile = join(fixturesDir, 'scheduler', 'platformatic.json')
  const config = await loadConfig({}, ['-c', configFile], platformaticRuntime)
  config.configManager.current.scheduler = [
    {
      enabled: false,
      name: 'test',
      cron: '*/1 * * * * *', // every second
      callbackUrl,
      method: 'GET',
    },
  ]
  const app = await buildServer(config.configManager.current)
  t.after(() => app.close())
  await new Promise(resolve => setTimeout(resolve, 3000))
  assert.equal(calls.length, 0, 'Should not have been called')
})

test('Shoud retry 3 times if fails ', async (t) => {
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

  const configFile = join(fixturesDir, 'scheduler', 'platformatic.json')
  const config = await loadConfig({}, ['-c', configFile], platformaticRuntime)
  config.configManager.current.scheduler = [
    {
      name: 'test2',
      cron: '*/1 * * * * *', // every second
      callbackUrl,
      method: 'GET',
    },
  ]
  const app = await buildServer(config.configManager.current)
  t.after(() => app.close())
  // 3 attempts, the third one should succeed
  await once(ee, 'success')
  assert.deepStrictEqual(calls, ['failure', 'failure', 'success'])
})

test('Start a job that hits a server with a POST of a JSON', async (t) => {
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

  const configFile = join(fixturesDir, 'scheduler', 'platformatic.json')
  const config = await loadConfig({}, ['-c', configFile], platformaticRuntime)
  config.configManager.current.scheduler = [
    {
      name: 'test',
      cron: '*/1 * * * * *', // every second
      callbackUrl,
      body: { test: 'test' },
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    },
  ]
  const app = await buildServer(config.configManager.current)
  t.after(() => app.close())
  // should be called multiple times (one time per second)
  await once(ee, 'target called')
  assert.deepStrictEqual(bodyCall, { test: 'test' })
})

test('Start a job that hits a server with a POST of a TXT', async (t) => {
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

  const configFile = join(fixturesDir, 'scheduler', 'platformatic.json')
  const config = await loadConfig({}, ['-c', configFile], platformaticRuntime)
  config.configManager.current.scheduler = [
    {
      name: 'test',
      cron: '*/1 * * * * *', // every second
      callbackUrl,
      body: 'test',
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' }
    },
  ]
  const app = await buildServer(config.configManager.current)
  t.after(async () => app.close())
  // should be called multiple times (one time per second)
  await once(ee, 'target called')
  assert.deepStrictEqual(bodyCall, 'test')
})

test('Shoud stop retrying after 3 times ', async (t) => {
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

  const configFile = join(fixturesDir, 'scheduler', 'platformatic.json')
  const config = await loadConfig({}, ['-c', configFile], platformaticRuntime)
  config.configManager.current.scheduler = [
    {
      name: 'test2',
      cron: '*/1 * * * * *', // every second
      callbackUrl,
      method: 'GET',
    },
  ]
  const app = await buildServer(config.configManager.current)
  t.after(() => app.close())

  await once(ee, 'success')

  // 3 attempts, then should be reset
  assert.deepStrictEqual(attempts, [1, 2, 3, 1])
})
