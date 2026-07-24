import getPort from 'get-port'
import { deepStrictEqual, match, rejects, strictEqual } from 'node:assert'
import { mkdir, symlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { test } from 'node:test'
import { createRuntime, createTemporaryDirectory } from './helpers.js'

async function createApplication (root, id, server) {
  const directory = join(root, id)
  await mkdir(directory, { recursive: true })
  const platformaticModules = join(directory, 'node_modules/@platformatic')
  await mkdir(platformaticModules, { recursive: true })
  await symlink(join(import.meta.dirname, '../../service'), join(platformaticModules, 'service'), 'dir')
  await writeFile(
    join(directory, 'platformatic.json'),
    JSON.stringify({
      $schema: 'https://schemas.platformatic.dev/@platformatic/service/3.62.2.json',
      ...(server ? { server } : {})
    })
  )

  return {
    id,
    path: directory,
    config: join(directory, 'platformatic.json')
  }
}

async function createTestRuntime (t, applications) {
  const root = await createTemporaryDirectory(t, 'ports')
  const config = join(root, 'watt.json')
  await writeFile(join(root, 'package.json'), JSON.stringify({ name: 'ports-test' }))
  await writeFile(
    config,
    JSON.stringify({
      $schema: 'https://schemas.platformatic.dev/wattpm/3.62.2.json',
      applications
    })
  )

  return createRuntime(config)
}

test('applications use their configured port environment variable', async t => {
  const root = await createTemporaryDirectory(t, 'custom-port-env')
  const port = await getPort()
  const application = await createApplication(root, 'service', {
    hostname: '127.0.0.1',
    port: '{HTTP_PORT}'
  })
  application.portEnv = 'HTTP_PORT'
  application.env = { HTTP_PORT: String(port) }

  const runtime = await createTestRuntime(t, [application])
  t.after(() => runtime.close())

  const { 'service:0': url } = await runtime.start(true)
  strictEqual(new URL(url).port, String(port))
  deepStrictEqual(runtime.getUrls(), { 'service:0': url })
  deepStrictEqual(runtime.getUrls('service'), { 'service:0': url })
  deepStrictEqual((await runtime.getRuntimeMetadata()).urls, { 'service:0': url })

  await runtime.stopApplication('service')
  deepStrictEqual((await runtime.getRuntimeMetadata()).urls, {})
})

test('applications with exposed disabled use ITC only', async t => {
  const root = await createTemporaryDirectory(t, 'itc-only')
  const application = await createApplication(root, 'service')
  application.exposed = false
  const runtime = await createTestRuntime(t, [application])
  t.after(() => runtime.close())

  deepStrictEqual(await runtime.start(true), {})
  deepStrictEqual(runtime.getUrls('service'), {})
  deepStrictEqual((await runtime.getRuntimeMetadata()).urls, {})

  const response = await runtime.inject('service', { method: 'GET', url: '/' })
  strictEqual(response.statusCode, 200)
})

test('runtime stops when applications listen on the same port', async t => {
  const root = await createTemporaryDirectory(t, 'duplicate-port')
  const port = await getPort()
  const server = { hostname: '127.0.0.1', port }
  const first = await createApplication(root, 'first', server)
  const second = await createApplication(root, 'second', server)
  const runtime = await createTestRuntime(t, [first, second])

  await rejects(
    () => runtime.start(true),
    error => {
      strictEqual(error.code, 'PLT_RUNTIME_EADDR_IN_USE')
      match(error.message, new RegExp(`Port ${port} is already in use`))
      return true
    }
  )
})

test('applications can listen on the same port on different hosts', async t => {
  const root = await createTemporaryDirectory(t, 'same-port-different-hosts')
  const port = await getPort()
  const first = await createApplication(root, 'first', { hostname: '127.0.0.1', port })
  const second = await createApplication(root, 'second', { hostname: '127.0.0.2', port })
  const runtime = await createTestRuntime(t, [first, second])
  t.after(() => runtime.close())

  const urls = await runtime.start(true)
  strictEqual(new URL(urls['first:0']).port, String(port))
  strictEqual(new URL(urls['second:0']).port, String(port))
})
