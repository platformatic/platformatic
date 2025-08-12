import { deepEqual, equal, ok } from 'node:assert'
import { once } from 'node:events'
import { existsSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { test } from 'node:test'
import {
  createRuntime,
  getLogsFromFile,
  LOGS_TIMEOUT,
  prepareRuntime,
  setFixturesDir,
  sleep,
  startRuntime,
  updateFile
} from '../../basic/test/helper.js'

setFixturesDir(resolve(import.meta.dirname, './fixtures'))

test('should inject Platformatic code by default when building', async t => {
  const { runtime, root } = await prepareRuntime(t, 'fastify-with-build-standalone', false, null, async root => {
    await updateFile(resolve(root, 'services/frontend/platformatic.application.json'), contents => {
      const json = JSON.parse(contents)
      json.application = { commands: { build: 'node build.js' } }

      return JSON.stringify(json, null, 2)
    })

    return writeFile(
      resolve(root, 'services/frontend/build.js'),
      // eslint-disable-next-line no-template-curly-in-string
      "console.log(`INJECTED ${typeof globalThis.platformatic !== 'undefined'}`)",
      'utf-8'
    )
  })

  await runtime.init()
  await runtime.buildService('frontend')

  // Wait for logs to be flushed
  await sleep(LOGS_TIMEOUT)
  const logs = await getLogsFromFile(root)
  deepEqual(logs[1].msg, 'INJECTED true')
})

test('should not inject Platformatic code when building if asked to', async t => {
  const { runtime, root } = await prepareRuntime(t, 'fastify-with-build-standalone', false, null, async root => {
    await updateFile(resolve(root, 'services/frontend/platformatic.application.json'), contents => {
      const json = JSON.parse(contents)
      json.application = { commands: { build: 'node build.js' } }
      json.node = { disablePlatformaticInBuild: true }

      return JSON.stringify(json, null, 2)
    })

    return writeFile(
      resolve(root, 'services/frontend/build.js'),
      // eslint-disable-next-line no-template-curly-in-string
      "console.log(`INJECTED ${typeof globalThis.platformatic !== 'undefined'}`)",
      'utf-8'
    )
  })

  await runtime.init()
  await runtime.buildService('frontend')

  // Wait for logs to be flushed
  await sleep(LOGS_TIMEOUT)
  const logs = await getLogsFromFile(root)
  deepEqual(logs[1].msg, 'INJECTED false')
})

test('should build the services on start in dev', async t => {
  const runtime = await createRuntime({
    t,
    root: resolve(import.meta.dirname, 'fixtures/dev-ts-build'),
    build: false,
    production: false
  })

  ok(existsSync(resolve(runtime.root, 'services/app-no-config/dist/index.js')))
})

for (const service of ['app-no-config', 'app-with-config']) {
  test(`should rebuild the services on reload in dev, service ${service}`, async t => {
    const { runtime, root } = await prepareRuntime(t, 'dev-ts-build', false)
    await startRuntime(t, runtime)

    // write the file to trigger a reload
    await writeFile(resolve(root, `services/${service}/reload.ts`), '// reload', 'utf-8')

    // reload the service
    {
      const event = await once(runtime, 'service:worker:changed')
      equal(event[0].service, service)
    }
    // restart the service
    {
      const event = await once(runtime, 'service:worker:started')
      equal(event[0].service, service)
    }
  })
}
