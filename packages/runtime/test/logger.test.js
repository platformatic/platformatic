'use strict'

const assert = require('node:assert')
const path = require('node:path')
const { readFileSync } = require('node:fs')
const { test } = require('node:test')
const { setTimeout: wait } = require('node:timers/promises')
const { request } = require('undici')
const { tmpdir } = require('node:os')
const { buildServer } = require('..')

const WAIT_LOGS_FLUSH = 3_000

test('should use full logger options - formatters, timestamp, redaction', async t => {
  process.env.LOG_DIR = path.join(tmpdir(), 'test-logs', Date.now().toString())
  process.env.PLT_RUNTIME_LOGGER_STDOUT = 1
  const file = path.join(process.env.LOG_DIR, 'service.log')
  const serviceRoot = path.join(__dirname, '..', 'fixtures', 'logger-options')

  const app = await buildServer(path.join(serviceRoot, 'platformatic.json'))
  t.after(async () => {
    await app.close()
  })
  const url = await app.start()

  await request(url, { path: '/logs' })
  // wait for logger flush
  await wait(WAIT_LOGS_FLUSH)

  const content = readFileSync(file, 'utf8')
  const logs = content.split('\n').filter(line => line.trim() !== '').map(line => JSON.parse(line))

  assert.ok(logs.find(log => log.level === 'INFO' &&
    log.time.length === 24 && // isotime
    log.name === 'service' &&
    log.msg === 'Starting the service "app"...'))
  assert.ok(logs.find(log => log.level === 'INFO' &&
    log.time.length === 24 && // isotime
    log.name === 'service' &&
    log.msg === 'Started the service "app"...'))
  assert.ok(logs.find(log => log.level === 'INFO' &&
    log.time.length === 24 && // isotime
    log.name === 'service' &&
    log.msg.startsWith('Platformatic is now listening at http://127.0.0.1:')))
})

test('should inherit full logger options from runtime to a platformatic/service', async t => {
  process.env.LOG_DIR = path.join(tmpdir(), 'test-logs', Date.now().toString())
  process.env.PLT_RUNTIME_LOGGER_STDOUT = 1
  const file = path.join(process.env.LOG_DIR, 'service.log')

  const serviceRoot = path.join(__dirname, '..', 'fixtures', 'logger-options')

  const app = await buildServer(path.join(serviceRoot, 'platformatic.json'))
  t.after(async () => {
    await app.close()
  })
  const url = await app.start()

  await request(url, { path: '/logs' })
  // wait for logger flush
  await wait(WAIT_LOGS_FLUSH)

  const content = readFileSync(file, 'utf8')
  const logs = content.split('\n').filter(line => line.trim() !== '').map(line => JSON.parse(line))

  assert.ok(logs.find(log => log.level === 'DEBUG' &&
    log.time.length === 24 && // isotime
    log.name === 'service' &&
    log.msg === 'Loading envfile...'))

  assert.ok(logs.find(log => log.level === 'INFO' &&
    log.time.length === 24 && // isotime
    log.name === 'service' &&
    log.msg === 'Starting the service "app"...'))

  assert.ok(logs.find(log => log.level === 'INFO' &&
    log.time.length === 24 && // isotime
    log.name === 'service' &&
    log.msg === 'Started the service "app"...'))

  assert.ok(logs.find(log => log.level === 'INFO' &&
    log.time.length === 24 && // isotime
    log.name === 'service' &&
    log.msg.startsWith('Platformatic is now listening at http://127.0.0.1:')))

  assert.ok(logs.find(log => {
    if (log.level === 'INFO' &&
      log.time.length === 24 && // isotime
      log.name === 'app') {
      return log.stdout.level === 'DEBUG' &&
        log.stdout.time.length === 24 && // isotime
        log.stdout.name === 'service' &&
        log.stdout.secret === 'foo' &&
        log.stdout.msg === 'call route /logs'
    }
    return false
  }))
})

test('should inherit full logger options from runtime to different services', async t => {
  process.env.LOG_DIR = path.join(tmpdir(), 'test-logs', Date.now().toString())
  process.env.PLT_RUNTIME_LOGGER_STDOUT = 1
  const file = path.join(process.env.LOG_DIR, 'service.log')
  const serviceRoot = path.join(__dirname, '..', 'fixtures', 'logger-options-all')

  const app = await buildServer(path.join(serviceRoot, 'platformatic.json'))
  t.after(async () => {
    await app.close()
  })
  const url = await app.start()

  await request(url, { path: '/logs' })
  // wait for logger flush
  await wait(WAIT_LOGS_FLUSH)

  const content = readFileSync(file, 'utf8')
  const logs = content.split('\n').filter(line => line.trim() !== '').map(line => JSON.parse(line))

  for (const t of ['composer', 'service', 'node']) {
    assert.ok(logs.find(log => log.level === 'INFO' &&
      log.time.length === 24 && // isotime
      log.name === 'service' &&
      log.msg === `Started the service "${t}"...`))
  }
})

test('should get proper formatted logs from thread services', { only: true }, async t => {
  process.env.LOG_DIR = path.join(tmpdir(), 'test-logs', Date.now().toString())
  process.env.PLT_RUNTIME_LOGGER_STDOUT = 1
  const file = path.join(process.env.LOG_DIR, 'service.log')
  const serviceRoot = path.join(__dirname, '..', 'fixtures', 'logger-options-all')

  const app = await buildServer(path.join(serviceRoot, 'platformatic.json'))
  t.after(async () => {
    await app.close()
  })
  const url = await app.start()

  await request(url, { path: '/' })

  // wait for logger flush
  await wait(WAIT_LOGS_FLUSH)

  const content = readFileSync(file, 'utf8')

  console.log(content)

  const logs = content.split('\n')
    .filter(line => line.trim() !== '').map(line => JSON.parse(line))
    .filter(log => log.caller === 'STDOUT')

  assert.ok(logs.find(log => {
    return log.stdout.level === 'INFO' &&
      log.stdout.time.length === 24 && // isotime
      log.stdout.name === 'service' &&
      log.stdout.msg === 'incoming request'
  }))

  assert.ok(logs.find(log => {
    return log.stdout.level === 'INFO' &&
      log.stdout.time.length === 24 && // isotime
      log.stdout.name === 'service' &&
      log.stdout.msg === 'request completed'
  }))
})
