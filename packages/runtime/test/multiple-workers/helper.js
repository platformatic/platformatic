'use strict'

const { cp, symlink } = require('node:fs/promises')
const { deepStrictEqual } = require('node:assert')
const { join, resolve } = require('node:path')
const { request } = require('undici')
const { createDirectory, safeRemove } = require('@platformatic/utils')

const fixturesDir = join(__dirname, '..', '..', 'fixtures')

const tmpDir = resolve(__dirname, '../../tmp')

async function prepareRuntime (t, name, dependencies) {
  const root = resolve(tmpDir, `plt-multiple-workers-${Date.now()}`)

  await createDirectory(root)
  t.after(() => safeRemove(root))

  await cp(resolve(fixturesDir, name), root, { recursive: true })

  for (const [service, deps] of Object.entries(dependencies)) {
    const depsRoot = resolve(root, service, 'node_modules/@platformatic')
    await createDirectory(depsRoot)

    for (const dep of deps) {
      await symlink(resolve(root, '../../../', dep), resolve(depsRoot, dep))
    }
  }

  process.env.PLT_RUNTIME_LOGGER_STDOUT = resolve(root, 'log.txt')
  return root
}

async function verifyResponse (baseUrl, service, expectedWorker, socket, additionalChecks) {
  const res = await request(baseUrl + `/${service}/hello`)
  const json = await res.body.json()

  deepStrictEqual(res.statusCode, 200)
  deepStrictEqual(res.headers['x-plt-socket'], socket)
  deepStrictEqual(res.headers['x-plt-worker-id'], expectedWorker.toString())
  deepStrictEqual(json, { from: service })
  additionalChecks?.(res, json)
}

async function verifyInject (client, service, expectedWorker, additionalChecks) {
  const res = await client.request({ method: 'GET', path: `/api/v1/services/${service}/proxy/hello` })
  const json = await res.body.json()

  deepStrictEqual(res.statusCode, 200)
  deepStrictEqual(res.headers['x-plt-worker-id'], expectedWorker.toString())
  deepStrictEqual(json, { from: service })
  additionalChecks?.(res, json)
}

module.exports = {
  fixturesDir,
  tmpDir,
  prepareRuntime,
  verifyResponse,
  verifyInject,
}
