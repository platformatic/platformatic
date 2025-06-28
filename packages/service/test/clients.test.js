'use strict'

const assert = require('node:assert')
const { test } = require('node:test')
const { join } = require('node:path')
const { request } = require('undici')
const { compile } = require('@platformatic/ts-compiler')
const pino = require('pino')
const { create } = require('..')
const { safeRemove } = require('@platformatic/utils')

const projectRoot = join(__dirname, './fixtures/hello')

test('client is loaded', async t => {
  const app1 = await create(join(projectRoot, 'warn-log.service.json'))

  t.after(async () => {
    await app1.stop()
  })
  await app1.start({ listen: true })

  process.env.PLT_CLIENT_URL = app1.url

  const app2 = await create(join(__dirname, './fixtures/hello-client/platformatic.service.json'))

  t.after(async () => {
    await app2.stop()
  })
  await app2.start({ listen: true })

  const res = await request(`${app2.url}/`)
  assert.strictEqual(res.statusCode, 200, 'status code')
  const data = await res.body.json()
  assert.deepStrictEqual(data, { hello: 'world' })
})

test('client is loaded (ts)', async t => {
  const app1 = await create(join(projectRoot, 'warn-log.service.json'))

  t.after(async () => {
    await app1.stop()
  })
  await app1.start({ listen: true })

  process.env.PLT_CLIENT_URL = app1.url

  const targetDir = join(__dirname, './fixtures/hello-client-ts')

  try {
    await safeRemove(join(targetDir, 'dist'))
  } catch {}

  await compile({
    cwd: targetDir,
    logger: pino({ level: 'warn' })
  })

  const app2 = await create(targetDir)
  t.after(async () => {
    await app2.stop()
  })
  await app2.start({ listen: true })

  const res = await request(`${app2.url}/`)
  assert.strictEqual(res.statusCode, 200, 'status code')
  const data = await res.body.json()
  assert.deepStrictEqual(data, { hello: 'world' })
})

test('client is loaded dependencyless', async t => {
  const app1 = await create(join(projectRoot, 'warn-log.service.json'))

  t.after(async () => {
    await app1.stop()
  })
  await app1.start({ listen: true })

  process.env.PLT_CLIENT_URL = app1.url

  const app2 = await create(join(__dirname, './fixtures/hello-client-without-deps'))

  t.after(async () => {
    await app2.stop()
  })
  await app2.start({ listen: true })

  const res = await request(`${app2.url}/`)
  assert.strictEqual(res.statusCode, 200, 'status code')
  const data = await res.body.json()
  assert.deepStrictEqual(data, { hello: 'world' })
})

test('client is loaded before plugins', async t => {
  const app1 = await create(join(projectRoot, 'warn-log.service.json'))

  t.after(async () => {
    await app1.stop()
  })
  await app1.start({ listen: true })

  process.env.PLT_CLIENT_URL = app1.url

  const app2 = await create(join(__dirname, './fixtures/hello-client-from-plugin'))

  t.after(async () => {
    await app2.stop()
  })
  await app2.start({ listen: true })

  const res = await request(`${app2.url}/`)
  assert.strictEqual(res.statusCode, 200, 'status code')
  const data = await res.body.json()
  assert.deepStrictEqual(data, { hello: 'world', hasConfig: true })
})
