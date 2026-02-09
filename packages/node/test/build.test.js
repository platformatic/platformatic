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
import { version } from '../index.js'

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
  await runtime.buildApplication('frontend')
  await runtime.close()

  const logs = await getLogsFromFile(root)
  ok(logs.find(l => l.msg === 'INJECTED true'))
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

test('should not try to stop the application when build failed on start in dev', async t => {
  const { root, runtime } = await prepareRuntime({
    t,
    root: resolve(import.meta.dirname, 'fixtures/dev-ts-build'),
    build: false,
    production: false,
    async additionalSetup (root, config) {
      config.restartOnError = 0
      await updateFile(resolve(root, 'services/app-no-config/src/index.ts'), () => 'this is not valid typescript')

      await writeFile(
        resolve(root, 'services/app-no-config/platformatic.json'),
        JSON.stringify(
          {
            $schema: `https://schemas.platformatic.dev/@platformatic/node/${version}.json`,
            logger: { timestamp: 'isoTime' }
          },
          null,
          2
        ),
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
    async additionalSetup (root, config) {
      config.restartOnError = 0
      await updateFile(resolve(root, 'services/app-no-config/src/index.ts'), content =>
        content.replace('app.listen({ port: 1 })', 'setTimeout(() => app.listen({ port: 1 }), 2000)'))

      await writeFile(
        resolve(root, 'services/app-no-config/platformatic.json'),
        JSON.stringify(
          {
            $schema: `https://schemas.platformatic.dev/@platformatic/node/${version}.json`,
            logger: { timestamp: 'isoTime' }
          },
          null,
          2
        ),
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
  await promise
})

for (const application of ['app-no-config', 'app-with-config']) {
  test(`should rebuild the applications on reload in dev, application ${application}`, async t => {
    const { runtime, root } = await prepareRuntime(t, 'dev-ts-build', false)
    await startRuntime(t, runtime)

    // write the file to trigger a reload
    await writeFile(resolve(root, `services/${application}/reload.ts`), '// reload', 'utf-8')

    // reload the application
    {
      const event = await once(runtime, 'application:worker:changed')
      equal(event[0].application, application)
    }
    // restart the application
    {
      const event = await once(runtime, 'application:worker:started')
      equal(event[0].application, application)
    }
  })
}
