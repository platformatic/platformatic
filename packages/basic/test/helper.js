import { deepStrictEqual, strictEqual } from 'node:assert'
import { resolve } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'
import { Client, request } from 'undici'
import { loadConfig } from '../../config/index.js'
import { buildServer, platformaticRuntime } from '../../runtime/index.js'

export const fixturesDir = resolve(import.meta.dirname, './fixtures')

export async function createRuntime (t, path) {
  const configFile = resolve(fixturesDir, path)
  const config = await loadConfig({}, ['-c', configFile], platformaticRuntime)
  const runtime = await buildServer(config.configManager.current)
  const url = await runtime.start()

  t.after(async () => {
    await runtime.close()
  })

  return { runtime, url }
}

export async function verifyViaHTTP (baseUrl, path, expectedCode, expectedContent) {
  const { statusCode, body } = await request(baseUrl + path)
  strictEqual(statusCode, expectedCode)
  deepStrictEqual(await body.json(), expectedContent)
}

export async function verifyViaInject (app, serviceId, method, url, expectedCode, expectedContent) {
  const { statusCode, body } = await app.inject(serviceId, { method, url })
  strictEqual(statusCode, expectedCode)
  deepStrictEqual(JSON.parse(body), expectedContent)
}

export async function getLogs (app) {
  const client = new Client(
    {
      hostname: 'localhost',
      protocol: 'http:',
    },
    {
      socketPath: app.getManagementApiUrl(),
      keepAliveTimeout: 10,
      keepAliveMaxTimeout: 10,
    }
  )

  // Wait for logs to be written
  await sleep(3000)

  const { statusCode, body } = await client.request({
    method: 'GET',
    path: '/api/v1/logs/all',
  })

  strictEqual(statusCode, 200)

  const rawLogs = await body.text()

  return rawLogs
    .trim()
    .split('\n')
    .filter(l => l)
    .map(m => JSON.parse(m))
}
