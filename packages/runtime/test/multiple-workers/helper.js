'use strict'

const { cp, symlink, readFile, writeFile } = require('node:fs/promises')
const { deepStrictEqual } = require('node:assert')
const { on } = require('node:events')
const { platform } = require('node:os')
const { join, resolve } = require('node:path')
const WebSocket = require('ws')
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

async function updateFile (path, update) {
  const contents = await readFile(path, 'utf-8')
  await writeFile(path, await update(contents), 'utf-8')
}

async function updateConfigFile (path, update) {
  const contents = JSON.parse(await readFile(path, 'utf-8'))
  await update(contents)
  await writeFile(path, JSON.stringify(contents, null, 2), 'utf-8')
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

async function openLogsWebsocket (app) {
  const protocol = platform() === 'win32' ? 'ws+unix:' : 'ws+unix://'
  const managementApiWebsocket = new WebSocket(protocol + app.getManagementApiUrl() + ':/api/v1/logs/live')

  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Timeout'))
    }, 3000)

    managementApiWebsocket.on('error', reject)

    managementApiWebsocket.on('open', () => {
      clearTimeout(timeout)
      resolve()
    })
  })

  return managementApiWebsocket
}

async function waitForLogs (socket, ...exprs) {
  const toMatch = new Set(exprs)
  const messages = []

  for await (const [msg] of on(socket, 'message')) {
    for (const line of msg.toString().trim().split('\n')) {
      const message = JSON.parse(line)
      messages.push(message)

      for (const expr of toMatch) {
        const matches = typeof expr === 'string' ? message.msg.startsWith(expr) : message.msg.match(expr)

        if (matches) {
          toMatch.delete(expr)

          if (toMatch.size === 0) {
            return messages
          }
        }
      }
    }
  }
}

module.exports = {
  fixturesDir,
  tmpDir,
  prepareRuntime,
  updateFile,
  updateConfigFile,
  verifyResponse,
  verifyInject,
  openLogsWebsocket,
  waitForLogs
}
