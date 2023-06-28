'use strict'

require('./helper')
const { test } = require('tap')
const { buildServer } = require('..')
const { join } = require('path')
const { request } = require('undici')
const { compile } = require('../lib/compile')
const { rmdir } = require('fs/promises')

test('client is loaded', async ({ teardown, equal, same }) => {
  const app1 = await buildServer(join(__dirname, '..', 'fixtures', 'hello', 'warn-log.service.json'))

  teardown(async () => {
    await app1.close()
  })
  await app1.start()

  process.env.PLT_CLIENT_URL = app1.url

  const app2 = await buildServer(join(__dirname, '..', 'fixtures', 'hello-client', 'platformatic.service.json'))

  teardown(async () => {
    await app2.close()
  })
  await app2.start()

  const res = await request(`${app2.url}/`)
  equal(res.statusCode, 200, 'status code')
  const data = await res.body.json()
  same(data, { hello: 'world' })
})

test('client is loaded (ts)', async ({ teardown, equal, pass, same }) => {
  const app1 = await buildServer(join(__dirname, '..', 'fixtures', 'hello', 'warn-log.service.json'))

  teardown(async () => {
    await app1.close()
  })
  await app1.start()

  process.env.PLT_CLIENT_URL = app1.url

  const targetDir = join(__dirname, '..', 'fixtures', 'hello-client-ts')

  try {
    await rmdir(join(targetDir, 'dist'))
  } catch {}

  await compile(targetDir, { server: { logger: { level: 'warn' } } })

  const app2 = await buildServer(join(targetDir, 'platformatic.service.json'))
  teardown(async () => {
    await app2.close()
  })
  await app2.start()

  const res = await request(`${app2.url}/`)
  equal(res.statusCode, 200, 'status code')
  const data = await res.body.json()
  same(data, { hello: 'world' })
})

test('client is loaded dependencyless', async ({ teardown, equal, same }) => {
  const app1 = await buildServer(join(__dirname, '..', 'fixtures', 'hello', 'warn-log.service.json'))

  teardown(async () => {
    await app1.close()
  })
  await app1.start()

  process.env.PLT_CLIENT_URL = app1.url

  const app2 = await buildServer(join(__dirname, '..', 'fixtures', 'hello-client-without-deps', 'platformatic.service.json'))

  teardown(async () => {
    await app2.close()
  })
  await app2.start()

  const res = await request(`${app2.url}/`)
  equal(res.statusCode, 200, 'status code')
  const data = await res.body.json()
  same(data, { hello: 'world' })
})

test('client is loaded (ts) depencyless', async ({ teardown, equal, pass, same }) => {
  const app1 = await buildServer(join(__dirname, '..', 'fixtures', 'hello', 'warn-log.service.json'))

  teardown(async () => {
    await app1.close()
  })
  await app1.start()

  process.env.PLT_CLIENT_URL = app1.url

  const targetDir = join(__dirname, '..', 'fixtures', 'hello-client-ts-without-deps')

  try {
    await rmdir(join(targetDir, 'dist'))
  } catch {}

  await compile(targetDir, { server: { logger: { level: 'warn' } } })

  const app2 = await buildServer(join(targetDir, 'platformatic.service.json'))
  teardown(async () => {
    await app2.close()
  })
  await app2.start()

  const res = await request(`${app2.url}/`)
  equal(res.statusCode, 200, 'status code')
  const data = await res.body.json()
  same(data, { hello: 'world' })
})
