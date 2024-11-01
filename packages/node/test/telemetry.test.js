import { ok } from 'node:assert'
import { resolve } from 'node:path'
import { test } from 'node:test'
import {
  createProductionRuntime,
  createRuntime,
  getLogs,
  setFixturesDir,
  verifyJSONViaHTTP
} from '../../basic/test/helper.js'

process.setMaxListeners(100)

setFixturesDir(resolve(import.meta.dirname, './fixtures'))

test('should start telemetry using main', async t => {
  const { runtime, url } = await createRuntime(t, 'express-api-with-telemetry')

  await verifyJSONViaHTTP(url, '/test', 200, { foo: 'bar' })

  const logs = await getLogs(runtime)
  ok(logs.map(m => m.msg).includes('Setting up Node.js HTTP telemetry for service: test-service-api'))
})

test('should start telemetry using script', async t => {
  const { runtime, url } = await createProductionRuntime(t, 'express-api-with-telemetry-script')

  await verifyJSONViaHTTP(url, '/test', 200, { foo: 'bar' })

  const logs = await getLogs(runtime)
  ok(logs.map(m => m.msg).includes('Setting up Node.js HTTP telemetry for service: test-service-api'))
})
