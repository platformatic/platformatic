import { ok } from 'node:assert'
import { resolve } from 'node:path'
import { test } from 'node:test'
import { dirname, join } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import {
  createRuntime,
  fixturesDir,
  getLogs,
  setFixturesDir,
  verifyJSONViaHTTP,
} from '../../basic/test/helper.js'

import {
  createProductionRuntime,
  prepareWorkingDirectorySingleRuntime
} from '../../cli/test/helper.js'

import { mkdtempSync } from 'node:fs'

import { safeRemove } from '../../utils/index.js'

process.setMaxListeners(100)

const packageRoot = resolve(import.meta.dirname, '..')

// Make sure no temporary files exist after execution
test.afterEach(() => {
  if (fixturesDir) {
    return Promise.all([
      safeRemove(resolve(fixturesDir, 'node_modules')),
    ])
  }
})

test('should start telemetry using main', async t => {
  const configuration = 'express-api-with-telemetry'

  const settingUpNodeJSTelemetryMessage =
    'Setting up Node.js HTTP telemetry for service: test-service-api'

  setFixturesDir(resolve(import.meta.dirname, `./fixtures/${configuration}`))
  const { runtime, url } = await createRuntime(t, 'platformatic.runtime.json', packageRoot)
  await verifyJSONViaHTTP(url, '/test', 200, { foo: 'bar' })
  const logs = await getLogs(runtime)
  ok(logs.map(m => m.msg).includes(settingUpNodeJSTelemetryMessage))
})

test('should start telemetry using script', async (t) => {
  const configuration = 'express-api-with-telemetry-script'
  const dest = mkdtempSync(join(tmpdir(), `test-node-telemetry-${process.pid}`))
  t.after(() => safeRemove(dest))

  const source = join(dirname(fileURLToPath(import.meta.url)), 'fixtures', configuration)
  await prepareWorkingDirectorySingleRuntime(t, source, dest)
  const configFile = resolve(dest, 'platformatic.runtime.json')

  const { runtime, url } = await createProductionRuntime(t, configFile)
  await verifyJSONViaHTTP(url, '/test', 200, { foo: 'bar' })
  const logs = await getLogs(runtime)
  const settingUpNodeJSTelemetryMessage =
    'Setting up Node.js HTTP telemetry for service: test-service-api'
  ok(logs.map(m => m.msg).includes(settingUpNodeJSTelemetryMessage))
})
