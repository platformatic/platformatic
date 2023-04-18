'use strict'

require('./helper')
const { test } = require('tap')
const { buildServer } = require('..')
const { join } = require('path')
const { request } = require('undici')
const { compile } = require('../lib/compile')
const { rmdir } = require('fs/promises')

test('client is loaded', async ({ teardown, equal, pass, same, comment }) => {
  const server1 = await buildServer(join(__dirname, '..', 'fixtures', 'hello', 'platformatic.service.json'))
  await server1.listen()

  process.env.PLT_CLIENT_URL = server1.url

  const server2 = await buildServer(join(__dirname, '..', 'fixtures', 'hello-client', 'platformatic.service.json'))

  teardown(async () => {
    await server2.stop()
    await server1.stop()
  })
  await server2.listen()
  const res = await request(`${server2.url}/`)
  equal(res.statusCode, 200, 'status code')
  const data = await res.body.json()
  same(data, { hello: 'world' })
})

test('client is loaded (ts)', async ({ teardown, equal, pass, same }) => {
  const server1 = await buildServer(join(__dirname, '..', 'fixtures', 'hello', 'platformatic.service.json'))
  await server1.listen()

  process.env.PLT_CLIENT_URL = server1.url

  const targetDir = join(__dirname, '..', 'fixtures', 'hello-client-ts')

  try {
    await rmdir(join(targetDir, 'dist'))
  } catch {}

  await compile(targetDir)

  const server2 = await buildServer(join(targetDir, 'platformatic.service.json'))
  teardown(async () => {
    await server2.stop()
    await server1.stop()
  })
  await server2.listen()

  const res = await request(`${server2.url}/`)
  equal(res.statusCode, 200, 'status code')
  const data = await res.body.json()
  same(data, { hello: 'world' })
})
