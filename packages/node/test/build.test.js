import { equal, ok, rejects } from 'node:assert'
import { on } from 'node:events'
import { existsSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { test } from 'node:test'
import { executeWithTimeout, kTimeout } from '@platformatic/foundation'
import {
  createRuntime,
  getLogsFromFile,
  prepareRuntime,
  setFixturesDir,
  startRuntime,
  updateFile
} from '../../basic/test/helper.js'
import { updateConfigFile } from '../../runtime/test/helpers.js'

setFixturesDir(resolve(import.meta.dirname, './fixtures'))

async function waitForApplicationEvent (events, application) {
  for await (const [event] of events) {
    if (event.application === application) {
      return event
    }
  }
}

test('should inject Platformatic code by default when building', async t => {
  const { runtime, root } = await prepareRuntime(t, 'fastify-with-build-standalone', false, null, async root => {
    await updateConfigFile(resolve(root, 'services/frontend/platformatic.application.json'), contents => {
      contents.application = { commands: { build: 'node build.js' } }
    })

    return writeFile(
      resolve(root, 'services/frontend/build.js'),
      "import { getLogger } from '@platformatic/globals'\nlet injected = true\ntry { getLogger() } catch { injected = false }\nconsole.log('INJECTED ' + injected)",
      'utf-8'
    )
  })

  await runtime.init()
  await runtime.buildApplication('frontend')
  await runtime.close()

  const logs = await getLogsFromFile(root)
  ok(logs.find(l => l.msg === 'INJECTED true'))
})

test('should not inject Platformatic code when building if asked to', async t => {
  const { runtime, root } = await prepareRuntime(t, 'fastify-with-build-standalone', false, null, async root => {
    await updateConfigFile(resolve(root, 'services/frontend/platformatic.application.json'), contents => {
      contents.application = { commands: { build: 'node build.js' } }
      contents.node = { disablePlatformaticInBuild: true }
    })

    return writeFile(
      resolve(root, 'services/frontend/build.js'),
      "import { getLogger } from '@platformatic/globals'\nlet injected = true\ntry { getLogger() } catch { injected = false }\nconsole.log('INJECTED ' + injected)",
      'utf-8'
    )
  })

  await runtime.init()
  await runtime.buildApplication('frontend')
  await runtime.close()

  const logs = await getLogsFromFile(root)
  ok(logs.find(l => l.msg === 'INJECTED false'))
})

test('should build the applications on start in dev', async t => {
  const runtime = await createRuntime({
    t,
    root: resolve(import.meta.dirname, 'fixtures/dev-ts-build'),
    build: false,
    production: false
  })

  ok(existsSync(resolve(runtime.root, 'services/app-no-config/dist/index.js')))
})

// Only this needs the loaded configuration; everything else the setup does is files on disk.
const setRestartOnError = async (root, config) => {
  config.restartOnError = 0
}

setRestartOnError.runAfterPrepare = true

test('should not try to stop the application when build failed on start in dev', async t => {
  const { root, runtime } = await prepareRuntime({
    t,
    root: resolve(import.meta.dirname, 'fixtures/dev-ts-build'),
    build: false,
    production: false,
    additionalSetup: setRestartOnError,
    async beforeLoad (root) {
      await updateFile(resolve(root, 'services/app-no-config/src/index.ts'), () => 'this is not valid typescript')

      await writeFile(
        resolve(root, 'services/app-no-config/watt.config.mjs'),
        `export default ${JSON.stringify({ module: '@platformatic/node', logger: { timestamp: 'isoTime' } }, null, 2)}\n`,
        'utf-8'
      )

      await writeFile(
        resolve(root, 'services/app-no-config/logger-formatters.js'),
        `
        module.exports = {
          timestamp: () => \`,"time":"${new Date(Date.now()).toISOString()}"\`
        }
        `,
        'utf-8'
      )
    }
  })

  await rejects(
    () => startRuntime(t, runtime),
    /Error while building application "app-no-config": Process exited with non zero exit code 1./
  )

  const logs = await getLogsFromFile(root)
  ok(!logs.find(l => l.caller === 'STDOUT' && typeof l.stdout?.level === 'number' && typeof l.stdout?.msg === 'string'))
})

test('should not hang if the runtime forcefully stops during start in case of errors', async t => {
  const { runtime } = await prepareRuntime({
    t,
    root: resolve(import.meta.dirname, 'fixtures/dev-ts-build'),
    build: false,
    production: false,
    additionalSetup: setRestartOnError,
    async beforeLoad (root) {
      // Delay the actual fixture listen call and avoid localhost's asynchronous secondary bindings during stop.
      await updateFile(resolve(root, 'services/app-no-config/src/index.ts'), content =>
        content.replace('app.listen({ port: 0 })', "setTimeout(() => app.listen({ port: 0, host: '127.0.0.1' }), 2000)"))

      await writeFile(
        resolve(root, 'services/app-no-config/watt.config.mjs'),
        `export default ${JSON.stringify({ module: '@platformatic/node', logger: { timestamp: 'isoTime' } }, null, 2)}\n`,
        'utf-8'
      )
    }
  })

  const startingEvent = Promise.withResolvers()
  runtime.on('application:worker:starting', event => {
    if (event.application === 'app-no-config') {
      startingEvent.resolve()
    }
  })

  const promise = startRuntime(t, runtime)
  runtime.error = new Error('This should not happen')
  await startingEvent.promise

  await runtime.stopApplication('app-no-config')
  await rejects(() => promise, { code: 'PLT_RUNTIME_RUNTIME_ABORT' })
})

for (const application of ['app-no-config', 'app-with-config']) {
  test(`should rebuild the applications on reload in dev, application ${application}`, async t => {
    const { runtime, root } = await prepareRuntime(t, 'dev-ts-build', false)
    await startRuntime(t, runtime)

    // Both listeners must be registered before the write because a cached restart can complete
    // immediately -- more so now that the compile cache is on by default.
    const changedEvents = on(runtime, 'application:worker:changed')
    const startedEvents = on(runtime, 'application:worker:started')
    const events = executeWithTimeout(Promise.all([
      waitForApplicationEvent(changedEvents, application),
      waitForApplicationEvent(startedEvents, application)
    ]), 30000)

    // Keep re-touching the file until the change is picked up: a single filesystem-watch event can
    // be dropped (seen on Windows), and without a fresh one the watcher never fires.
    const triggerPath = resolve(root, `services/${application}/reload.ts`)
    const retrigger = setInterval(() => {
      writeFile(triggerPath, `// reload ${Date.now()}\n`, 'utf-8').catch(() => {})
    }, 2000)

    let result
    try {
      await writeFile(triggerPath, '// reload\n', 'utf-8')
      result = await events
    } finally {
      clearInterval(retrigger)
      await Promise.all([changedEvents.return(), startedEvents.return()])
    }

    ok(result !== kTimeout, `application ${application} did not reload within 30 seconds`)
    const [changedEvent, startedEvent] = result
    equal(changedEvent.application, application)
    equal(startedEvent.application, application)
  })
}
