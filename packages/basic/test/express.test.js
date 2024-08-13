import { ifError } from 'node:assert'
import { test } from 'node:test'
import { createRuntime, verifyViaHTTP, verifyViaInject } from './helper.js'

test('can detect and start an express application with no build function defined', async t => {
  const { runtime, url } = await createRuntime(t, 'express/no-build/platformatic.as-entrypoint.runtime.json')

  await verifyViaHTTP(url, '/direct', 200, { ok: true })
  await verifyViaInject(runtime, 'main', 'GET', '/direct', 200, { ok: true })
})

test('can detect and start an express application with no build function and when not the entrypoint', async t => {
  const { runtime, url } = await createRuntime(t, 'express/no-build/platformatic.no-entrypoint.runtime.json')

  await verifyViaHTTP(url, '/mesh', 200, { ok: true })
  await verifyViaInject(runtime, 'main', 'GET', '/mesh', 200, { ok: true })
})

test('can detect and start an express application with build function defined', async t => {
  const { runtime, url } = await createRuntime(t, 'express/with-build/platformatic.as-entrypoint.runtime.json')

  await verifyViaHTTP(url, '/direct', 200, { ok: true })
  await verifyViaInject(runtime, 'main', 'GET', '/direct', 200, { ok: true })
})

test('can detect and start an express applicationwith build function defined and when not the entrypoint', async t => {
  const { runtime, url } = await createRuntime(t, 'express/no-build/platformatic.no-entrypoint.runtime.json')

  await verifyViaHTTP(url, '/mesh', 200, { ok: true })
  await verifyViaInject(runtime, 'main', 'GET', '/mesh', 200, { ok: true })

  const details = await runtime.getServiceDetails('internal')
  ifError(details.url)
})
