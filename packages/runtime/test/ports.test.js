import getPort from 'get-port'
import { deepStrictEqual, match, ok, rejects, strictEqual } from 'node:assert'
import { mkdir, symlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { test } from 'node:test'
import { createRuntime, createTemporaryDirectory } from './helpers.js'

/*
  `server` is written as an expression rather than a value so a port can be an environment read --
  the v4 spelling of what v3 wrote as a {HTTP_PORT} placeholder.
*/
async function createApplication (root, id, server) {
  const directory = join(root, id)
  await mkdir(directory, { recursive: true })
  const platformaticModules = join(directory, 'node_modules/@platformatic')
  await mkdir(platformaticModules, { recursive: true })
  await symlink(join(import.meta.dirname, '../../service'), join(platformaticModules, 'service'), 'dir')
  // A string is written as an expression verbatim (a port can be an environment read); an object is
  // a plain value and is serialized as one.
  const serverExpression = typeof server === 'string' ? server : JSON.stringify(server)
  await writeFile(
    join(directory, 'watt.config.mjs'),
    `export default {\n  module: '@platformatic/service'${server ? `,\n  server: ${serverExpression}` : ''}\n}\n`
  )

  return { id, path: directory }
}

async function createTestRuntime (t, applications) {
  const root = await createTemporaryDirectory(t, 'ports')
  const config = join(root, 'watt.config.mjs')
  await writeFile(join(root, 'package.json'), JSON.stringify({ name: 'ports-test' }))
  await writeFile(config, `export default { applications: ${JSON.stringify(applications)} }\n`)

  return createRuntime(config)
}

test('applications use their configured port environment variable', async t => {
  const root = await createTemporaryDirectory(t, 'custom-port-env')
  const port = await getPort()
  const application = await createApplication(
    root,
    'service',
    "{ hostname: '127.0.0.1', port: Number(process.env.HTTP_PORT) }"
  )
  // v3 supplied the placeholder's value through the entry's env block. v4's entry env configures
  // the running application, not the reading of configuration, so the value the file reads comes
  // from the application's own env file -- the rung the evaluation ladder actually consults.
  await writeFile(join(root, 'service', '.env'), `HTTP_PORT=${port}`)

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
  const server = `{ hostname: '127.0.0.1', port: ${port} }`
  const first = await createApplication(root, 'first', server)
  const second = await createApplication(root, 'second', server)

  // The ports are declared in the configurations, so the conflict is reported before anything starts
  await rejects(
    () => createTestRuntime(t, [first, second]),
    error => {
      strictEqual(error.code, 'PLT_RUNTIME_APPLICATIONS_PORTS_OVERLAP')
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
      strictEqual(error.code, 'PLT_RUNTIME_APPLICATIONS_PORTS_OVERLAP')
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
  const root = await createTemporaryDirectory(t, 'duplicate-port-from-command')
  const port = await getPort()

  // A port bound by the application's own command is invisible to the load time check by
  // construction: the configuration carries no fixed server.port for it to read, and the address is
  // chosen only once the command runs. Two applications bind the same port from their commands, so
  // the conflict appears only when they start -- exactly the case the start time check exists for.
  async function createCommandApplication (id) {
    const directory = join(root, id)
    await mkdir(join(directory, 'node_modules/@platformatic'), { recursive: true })
    await symlink(join(import.meta.dirname, '../../node'), join(directory, 'node_modules/@platformatic/node'), 'dir')
    await writeFile(join(directory, 'package.json'), JSON.stringify({ name: id, type: 'module', main: 'index.mjs' }))
    await writeFile(
      join(directory, 'index.mjs'),
      `import { createServer } from 'node:http'\ncreateServer((_, res) => res.end('ok')).listen(${port}, '127.0.0.1')\n`
    )
    await writeFile(
      join(directory, 'watt.config.mjs'),
      "export default {\n  module: '@platformatic/node',\n" +
        "  application: { commands: { development: 'node index.mjs', production: 'node index.mjs' } }\n}\n"
    )
    return { id, path: directory }
  }

  const first = await createCommandApplication('first')
  const second = await createCommandApplication('second')

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
  const first = await createApplication(root, 'first', `{ hostname: '127.0.0.1', port: ${port} }`)
  const second = await createApplication(root, 'second', `{ hostname: '127.0.0.2', port: ${port} }`)
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
