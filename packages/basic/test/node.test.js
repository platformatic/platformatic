import { deepStrictEqual, ifError } from 'node:assert'
import { test } from 'node:test'
import { createRuntime, getLogs, verifyViaHTTP, verifyViaInject } from './helper.js'

test('can detect and start a Node.js application with no configuration files', async t => {
  const { runtime, url } = await createRuntime(t, 'nodejs/no-configuration/platformatic.as-entrypoint.runtime.json')

  await verifyViaHTTP(url, '/direct', 200, { ok: true })
  await verifyViaInject(runtime, 'main', 'GET', '/direct', 200, { ok: true })

  const logs = await getLogs(runtime)
  deepStrictEqual(
    logs.map(m => m.msg),
    ['The service main had no valid entrypoint defined in the package.json file. Falling back to the file index.js.']
  )
})

test('can detect and start a Node.js application with no configuration files and when not the entrypoint', async t => {
  const { runtime, url } = await createRuntime(t, 'nodejs/no-configuration/platformatic.no-entrypoint.runtime.json')

  await verifyViaHTTP(url, '/mesh', 200, { ok: true })
  await verifyViaInject(runtime, 'main', 'GET', '/mesh', 200, { ok: true })

  const logs = await getLogs(runtime)

  deepStrictEqual(
    logs.map(m => m.msg),
    [
      'The service internal had no valid entrypoint defined in the package.json file. Falling back to the file index.js.',
    ]
  )
})

test('can detect and start a Node.js application with no build function defined', async t => {
  const { runtime, url } = await createRuntime(t, 'nodejs/no-build/platformatic.as-entrypoint.runtime.json')

  await verifyViaHTTP(url, '/direct', 200, { ok: true })
  await verifyViaInject(runtime, 'main', 'GET', '/direct', 200, { ok: true })

  const logs = await getLogs(runtime)
  deepStrictEqual(logs, [])
})

test('can detect and start a Node.js application with no build function and when not the entrypoint', async t => {
  const { runtime, url } = await createRuntime(t, 'nodejs/no-build/platformatic.no-entrypoint.runtime.json')

  await verifyViaHTTP(url, '/mesh', 200, { ok: true })
  await verifyViaInject(runtime, 'main', 'GET', '/mesh', 200, { ok: true })
})

test('can detect and start a Node.js application with build function defined', async t => {
  const { runtime, url } = await createRuntime(t, 'nodejs/with-build/platformatic.as-entrypoint.runtime.json')

  await verifyViaHTTP(url, '/direct', 200, { ok: true })
  await verifyViaInject(runtime, 'main', 'GET', '/direct', 200, { ok: true })
})

test('can detect and start a Node.js application with build function defined and when not the entrypoint', async t => {
  const { runtime, url } = await createRuntime(t, 'nodejs/no-build/platformatic.no-entrypoint.runtime.json')

  await verifyViaHTTP(url, '/mesh', 200, { ok: true })
  await verifyViaInject(runtime, 'main', 'GET', '/mesh', 200, { ok: true })

  const details = await runtime.getServiceDetails('internal')
  ifError(details.url)
})
