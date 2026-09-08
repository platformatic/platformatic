import getPort from 'get-port'
import { deepStrictEqual, match, ok, rejects, strictEqual } from 'node:assert'
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

test('applications without server.port use ITC only', async t => {
  const root = await createTemporaryDirectory(t, 'itc-only')
  const application = await createApplication(root, 'service')
  const runtime = await createTestRuntime(t, [application])
  t.after(() => runtime.close())

  deepStrictEqual(await runtime.start(true), {})
  deepStrictEqual(runtime.getUrls('service'), {})
  deepStrictEqual((await runtime.getRuntimeMetadata()).urls, {})

  const response = await runtime.inject('service', { method: 'GET', url: '/' })
  strictEqual(response.statusCode, 200)
})

test('runtime refuses to load when applications declare the same port', async t => {
  const root = await createTemporaryDirectory(t, 'duplicate-port')
  const port = await getPort()
  const server = { hostname: '127.0.0.1', port }
  const first = await createApplication(root, 'first', server)
  const second = await createApplication(root, 'second', server)

  // The ports are declared in the configurations, so the conflict is reported before anything starts
  await rejects(
    () => createTestRuntime(t, [first, second]),
    error => {
      strictEqual(error.cause?.code, 'PLT_RUNTIME_APPLICATIONS_PORTS_OVERLAP')
      match(error.message, new RegExp(`"first" \\(port ${port}\\) and "second" \\(port ${port}\\)`))
      match(error.message, new RegExp(`listen on port ${port}`))
      return true
    }
  )
})

test('runtime refuses to load when an application declares a port inside a per-worker range', async t => {
  const root = await createTemporaryDirectory(t, 'per-worker-range')
  const port = await getPort()

  // first occupies port .. port + 2, so second collides on its second worker
  const first = await createApplication(root, 'first', {
    hostname: '127.0.0.1',
    port,
    portAssignment: 'perWorkerIncrement'
  })
  first.workers = 3
  const second = await createApplication(root, 'second', { hostname: '127.0.0.1', port: port + 1 })

  await rejects(
    () => createTestRuntime(t, [first, second]),
    error => {
      strictEqual(error.cause?.code, 'PLT_RUNTIME_APPLICATIONS_PORTS_OVERLAP')
      match(error.message, new RegExp(`"first" \\(ports ${port}-${port + 2}, one per worker\\)`))
      match(error.message, new RegExp(`listen on port ${port + 1}`))
      return true
    }
  )
})

test('applications can listen next to a per-worker range', async t => {
  const root = await createTemporaryDirectory(t, 'next-to-per-worker-range')
  const port = await getPort()

  const first = await createApplication(root, 'first', {
    hostname: '127.0.0.1',
    port,
    portAssignment: 'perWorkerIncrement'
  })
  first.workers = 2
  // first only reaches port + 1
  const second = await createApplication(root, 'second', { hostname: '127.0.0.1', port: port + 2 })

  const runtime = await createTestRuntime(t, [first, second])
  t.after(() => runtime.close())

  const urls = await runtime.start(true)
  strictEqual(new URL(urls['first:0']).port, String(port))
  strictEqual(new URL(urls['first:1']).port, String(port + 1))
  strictEqual(new URL(urls['second:0']).port, String(port + 2))
})

test('ports which are not declared in the configuration are still checked when applications start', async t => {
  const root = await createTemporaryDirectory(t, 'duplicate-port-from-env')
  const port = await getPort()

  // The port is only known inside the worker, so the load time check cannot see it
  const first = await createApplication(root, 'first', { hostname: '127.0.0.1', port: '{HTTP_PORT}' })
  first.env = { HTTP_PORT: String(port) }
  const second = await createApplication(root, 'second', { hostname: '127.0.0.1', port: '{HTTP_PORT}' })
  second.env = { HTTP_PORT: String(port) }

  const runtime = await createTestRuntime(t, [first, second])

  await rejects(
    () => runtime.start(true),
    error => {
      // When reusePort is available both applications can bind the port and the runtime detects the conflict when
      // recording the URLs. Otherwise the second application fails to bind: the runtime can name the owner only if the
      // first application already reported its URL, so the raw EADDRINUSE error is also acceptable.
      ok(error.code === 'EADDRINUSE' || error.code === 'PLT_RUNTIME_EADDR_IN_USE', error.message)
      match(error.message, new RegExp(`${port}`))
      return true
    }
  )
})

test('applications using dynamic workers are not checked when loading', async t => {
  const root = await createTemporaryDirectory(t, 'dynamic-workers-ports')
  const port = await getPort()

  // The number of workers, and thus the range, changes while running
  const first = await createApplication(root, 'first', {
    hostname: '127.0.0.1',
    port,
    portAssignment: 'perWorkerIncrement'
  })
  first.workers = { dynamic: true, minimum: 1, maximum: 3 }
  const second = await createApplication(root, 'second', { hostname: '127.0.0.1', port: port + 1 })

  const runtime = await createTestRuntime(t, [first, second])
  t.after(() => runtime.close())

  ok(runtime)
})

test('applications can listen on the same port on different hosts', async t => {
  const root = await createTemporaryDirectory(t, 'same-port-different-hosts')
  const port = await getPort()
  const first = await createApplication(root, 'first', { hostname: '127.0.0.1', port })
  const second = await createApplication(root, 'second', { hostname: '127.0.0.2', port })
  const runtime = await createTestRuntime(t, [first, second])
  t.after(() => runtime.close())

  let urls
  try {
    urls = await runtime.start(true)
  } catch (error) {
    if (error.code === 'EADDRNOTAVAIL') {
      t.skip('A second loopback address is not available')
      return
    }
    throw error
  }
  strictEqual(new URL(urls['first:0']).port, String(port))
  strictEqual(new URL(urls['second:0']).port, String(port))
})
