import { equal, ok, rejects } from 'node:assert'
import { once } from 'node:events'
import { existsSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { test } from 'node:test'
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
      await updateFile(resolve(root, 'services/app-no-config/src/index.ts'), content =>
        content.replace('app.listen({ port: 1 })', 'setTimeout(() => app.listen({ port: 1 }), 2000)'))

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
  await rejects(() => promise, /exited prematurely/)
})

// Wait for a runtime event about a specific application, but with a bound: a dev reload hinges on
// a filesystem-watch notification, and the OS can drop one -- notably on Windows, where a single
// write may never reach the watcher. An unbounded `once` there hangs the whole file until the job
// timeout; this fails in seconds instead, and names what it was waiting for.
async function waitForApplicationEvent (runtime, event, application, timeoutMs = 60000) {
  const deadline = Date.now() + timeoutMs

  for (;;) {
    const remaining = deadline - Date.now()
    if (remaining <= 0) {
      throw new Error(`Timed out after ${timeoutMs}ms waiting for ${event} on application ${application}`)
    }

    const ac = new AbortController()
    const timer = setTimeout(() => ac.abort(), remaining)
    let payload
    try {
      payload = await once(runtime, event, { signal: ac.signal })
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error(`Timed out after ${timeoutMs}ms waiting for ${event} on application ${application}`)
      }
      throw error
    } finally {
      clearTimeout(timer)
    }

    if (payload[0].application === application) {
      return payload[0]
    }
  }
}

for (const application of ['app-no-config', 'app-with-config']) {
  test(`should rebuild the applications on reload in dev, application ${application}`, async t => {
    const { runtime, root } = await prepareRuntime(t, 'dev-ts-build', false)
    await startRuntime(t, runtime)

    // Trigger a reload, and keep re-touching the file until the change is picked up: a single
    // filesystem-watch event can be dropped (seen on Windows), and without a fresh one the watcher
    // never fires. Re-writing gives it another event rather than waiting forever on the first.
    const triggerPath = resolve(root, `services/${application}/reload.ts`)
    const retrigger = setInterval(() => {
      writeFile(triggerPath, `// reload ${Date.now()}\n`, 'utf-8').catch(() => {})
    }, 2000)
    t.after(() => clearInterval(retrigger))

    await writeFile(triggerPath, '// reload\n', 'utf-8')

    // reload the application
    const changed = await waitForApplicationEvent(runtime, 'application:worker:changed', application)
    equal(changed.application, application)

    // The change was seen; stop re-touching so the restart is not disturbed by another reload.
    clearInterval(retrigger)

    // restart the application
    const started = await waitForApplicationEvent(runtime, 'application:worker:started', application)
    equal(started.application, application)
  })
}
