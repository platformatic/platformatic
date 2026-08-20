import assert from 'node:assert'
import { join } from 'node:path'
import { test } from 'node:test'
import { request } from 'undici'
import { buildConfig, createFromConfig } from './helper.js'

const fixturesDir = join(import.meta.dirname, 'fixtures')
const plugins = { paths: [join(fixturesDir, 'throwing-plugin.js')] }

function buildServerConfig (errorHandler) {
  return { hostname: '127.0.0.1', port: 0, logger: { level: 'fatal' }, errorHandler }
}

test('server.errorHandler shapes the errors of the application routes', async t => {
  const app = await createFromConfig(
    t,
    buildConfig({ server: buildServerConfig(join(fixturesDir, 'error-handler.js')), plugins })
  )

  t.after(() => app.stop())
  await app.start({ listen: true })

  const failure = await request(`${app.url}/boom`)
  assert.strictEqual(failure.statusCode, 500)
  assert.deepStrictEqual(await failure.body.json(), {
    envelope: true,
    statusCode: 500,
    message: 'Internal Server Error'
  })

  const notFound = await request(`${app.url}/not-found`)
  assert.strictEqual(notFound.statusCode, 404)
  assert.deepStrictEqual(await notFound.body.json(), { envelope: true, statusCode: 404, message: 'nope' })
})

test('server.errorHandler does not prevent plugins from overriding it in their own context', async t => {
  const app = await createFromConfig(
    t,
    buildConfig({ server: buildServerConfig(join(fixturesDir, 'error-handler.js')), plugins })
  )

  t.after(() => app.stop())
  await app.start({ listen: true })

  const res = await request(`${app.url}/scoped/boom`)
  assert.strictEqual(res.statusCode, 500)
  assert.deepStrictEqual(await res.body.json(), { envelope: 'scoped' })
})

test('server.errorHandler supports modules exporting a named errorHandler function', async t => {
  const app = await createFromConfig(
    t,
    buildConfig({ server: buildServerConfig(join(fixturesDir, 'named-error-handler.js')), plugins })
  )

  t.after(() => app.stop())
  await app.start({ listen: true })

  const res = await request(`${app.url}/boom`)
  assert.strictEqual(res.statusCode, 500)
  assert.deepStrictEqual(await res.body.json(), { envelope: 'named' })
})

test('server.errorHandler throws if the module does not export a function', async t => {
  await assert.rejects(
    createFromConfig(
      t,
      buildConfig({ server: buildServerConfig(join(fixturesDir, 'invalid-error-handler.js')), plugins })
    ),
    {
      code: 'PLT_SERVICE_INVALID_ERROR_HANDLER'
    }
  )
})

test('the default error handler is used when server.errorHandler is not set', async t => {
  const app = await createFromConfig(t, buildConfig({ server: buildServerConfig(undefined), plugins }))

  t.after(() => app.stop())
  await app.start({ listen: true })

  const res = await request(`${app.url}/boom`)
  assert.strictEqual(res.statusCode, 500)
  assert.deepStrictEqual(await res.body.json(), {
    statusCode: 500,
    error: 'Internal Server Error',
    message: 'relation "public.users" does not exist'
  })
})
