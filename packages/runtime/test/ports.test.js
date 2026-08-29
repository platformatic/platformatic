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
  await writeFile(
    join(directory, 'watt.config.mjs'),
    `export default {\n  module: '@platformatic/service'${server ? `,\n  server: ${server}` : ''}\n}\n`
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

test('runtime stops when applications listen on the same port', async t => {
  const root = await createTemporaryDirectory(t, 'duplicate-port')
  const port = await getPort()
  const server = `{ hostname: '127.0.0.1', port: ${port} }`
  const first = await createApplication(root, 'first', server)
  const second = await createApplication(root, 'second', server)
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
