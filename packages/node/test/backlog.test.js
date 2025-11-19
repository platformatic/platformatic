import { deepStrictEqual } from 'node:assert'
import path, { resolve } from 'node:path'
import { test } from 'node:test'
import { prepareRuntime } from '../../basic/test/helper.js'
import { updateConfigFile } from '../../runtime/test/helpers.js'

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
  test(`node application should properly use backlog option in ${env}`, async t => {
    const { runtime } = await prepareRuntime({
      t,
      root: path.resolve(import.meta.dirname, './fixtures/express-no-build-standalone'),
      build: options.build,
      production: options.production,
      async additionalSetup (root) {
        await updateConfigFile(resolve(root, 'services/frontend/platformatic.application.json'), config => {
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

  test(`node application should properly use backlog option in ${env} when using custom commands`, async t => {
    const { runtime } = await prepareRuntime({
      t,
      root: path.resolve(import.meta.dirname, './fixtures/node-no-build-standalone'),
      build: options.build,
      production: options.production,
      async additionalSetup (root) {
        await updateConfigFile(resolve(root, 'services/frontend/platformatic.application.json'), config => {
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
}
