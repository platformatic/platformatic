import assert from 'node:assert'
import { join } from 'node:path'
import { test } from 'node:test'
import { request } from 'undici'
import { buildConfig, createFromConfig } from './helper.js'

const plugins = { paths: [join(import.meta.dirname, 'fixtures', 'ajv-coercion-plugin.js')] }

test('server.ajv.customOptions configures the request-validation Ajv instance (coerceTypes off)', async t => {
  const app = await createFromConfig(
    t,
    buildConfig({
      server: {
        hostname: '127.0.0.1',
        port: 0,
        logger: { level: 'fatal' },
        ajv: { customOptions: { coerceTypes: false } }
      },
      plugins
    })
  )

  t.after(async () => {
    await app.stop()
  })
  await app.start({ listen: true })

  const res = await request(`${app.url}/echo`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ capacity: '' })
  })

  // Without coercion the empty string is not a valid number and is rejected.
  assert.strictEqual(res.statusCode, 400)
})

test('by default an empty string is coerced to null on a number|null field', async t => {
  const app = await createFromConfig(
    t,
    buildConfig({
      server: {
        hostname: '127.0.0.1',
        port: 0,
        logger: { level: 'fatal' }
      },
      plugins
    })
  )

  t.after(async () => {
    await app.stop()
  })
  await app.start({ listen: true })

  const res = await request(`${app.url}/echo`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ capacity: '' })
  })

  // Locks in (and documents) the current default: Fastify's Ajv coerces '' to
  // null on a field that allows the null type, so validation passes as null.
  assert.strictEqual(res.statusCode, 200)
  const body = await res.body.json()
  assert.strictEqual(body.capacity, null)
})

test('server.ajv rejects unknown keys at config-load time (additionalProperties: false)', async t => {
  await assert.rejects(
    createFromConfig(
      t,
      buildConfig({
        server: {
          hostname: '127.0.0.1',
          port: 0,
          logger: { level: 'fatal' },
          ajv: { unknownKey: true }
        }
      }),
      undefined,
      { skipCleanup: true }
    )
  )
})
