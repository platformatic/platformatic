import { deepStrictEqual } from 'node:assert'
import path, { resolve } from 'node:path'
import { test } from 'node:test'
import {
  copyCommonApplication,
  prepareRuntime,
  updateFile,
  updateTargetApplicationConfig
} from '../../basic/test/helper.js'
import { updateConfigFile } from '../../runtime/test/helpers.js'
import { copyServerEntrypoint } from './helper.js'

// It reads the loaded configuration rather than the project directory, so it runs after the load.
// The update still lands before start, which is when the worker is handed its configuration.
const setBacklog = async (root, config) => {
  return updateTargetApplicationConfig(config, applicationConfig => {
    applicationConfig.server ??= {}
    applicationConfig.server.backlog = 100
  })
}

setBacklog.runAfterPrepare = true

const envs = {
  dev: {
    build: false,
    production: false
  },
  production: {
    build: true,
    production: true
  }
}

function waitServerOptions (runtime) {
  const { promise, resolve } = Promise.withResolvers()

  function listener (payload, _, application) {
    if (application === 'frontend') {
      runtime.removeListener('application:worker:event:serverOptions', listener)
      resolve(payload)
    }
  }

  runtime.on('application:worker:event:serverOptions', listener)

  return promise
}

for (const [env, options] of Object.entries(envs)) {
  test(`vite application should properly use backlog option in ${env}`, async t => {
    const { runtime } = await prepareRuntime({
      t,
      root: path.resolve(import.meta.dirname, './fixtures/standalone'),
      port: 0,
      build: options.build,
      production: options.production,
      additionalSetup: setBacklog
    })

    const promise = waitServerOptions(runtime)

    await runtime.start()
    const serverOptions = await promise
    deepStrictEqual(serverOptions.backlog, options.production ? 100 : undefined)
  })

  test(`vite application should properly use backlog option in ${env} (SSR)`, async t => {
    const { runtime } = await prepareRuntime({
      t,
      root: path.resolve(import.meta.dirname, './fixtures/ssr-standalone'),
      port: 0,
      build: options.build,
      production: options.production,
      async additionalSetup (root) {
        await copyServerEntrypoint(root)
        return updateConfigFile(resolve(root, 'services/frontend/platformatic.application.json'), config => {
          config.server ??= {}
          config.server.backlog = 100
        })
      }
    })

    const promise = waitServerOptions(runtime)

    await runtime.start()
    const serverOptions = await promise
    deepStrictEqual(serverOptions.backlog, 100)
  })

  test(`vite application should properly use backlog option in ${env} when using custom commands`, async t => {
    const { runtime } = await prepareRuntime({
      t,
      root: path.resolve(import.meta.dirname, './fixtures/composer-custom-commands'),
      build: options.build,
      production: options.production,
      async additionalSetup (root, config) {
        for (const type of ['backend', 'composer']) {
          await copyCommonApplication(root, type)
        }

        await updateFile(resolve(root, 'services/composer/routes/root.js'), contents => {
          return contents.replace('$PREFIX', '/frontend')
        })

        await updateConfigFile(resolve(root, 'services/frontend/platformatic.application.json'), config => {
          config.server ??= {}
          config.server.backlog = 100
        })
      }
    })

    const promise = waitServerOptions(runtime)

    await runtime.start()
    const serverOptions = await promise
    deepStrictEqual(serverOptions.backlog, undefined)
  })
}
