import getPort from 'get-port'
import { deepStrictEqual } from 'node:assert'
import { cp } from 'node:fs/promises'
import path, { resolve } from 'node:path'
import { test } from 'node:test'
import { commonFixturesRoot, prepareRuntime, updateFile } from '../../basic/test/helper.js'
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
  test(`Nuxt application should properly use backlog option in ${env}`, async t => {
    let port
    const { runtime } = await prepareRuntime({
      t,
      root: path.resolve(import.meta.dirname, './fixtures/standalone'),
      build: options.build,
      production: options.production,
      async additionalSetup (root) {
        port = await getPort()
        return updateConfigFile(resolve(root, 'services/frontend/platformatic.application.json'), config => {
          config.server ??= {}
          config.server.backlog = 100
          config.server.port = port
        })
      }
    })

    const promise = waitServerOptions(runtime)

    await runtime.start()
    const serverOptions = await promise
    deepStrictEqual(serverOptions.backlog, undefined)
    deepStrictEqual(serverOptions.port, port)
  })

  test(`Nuxt application should properly use backlog option in ${env} when using custom commands`, async t => {
    const { runtime } = await prepareRuntime({
      t,
      root: path.resolve(import.meta.dirname, './fixtures/composer-custom-commands'),
      build: options.build,
      production: options.production,
      async additionalSetup (root, config) {
        for (const type of ['backend', 'composer']) {
          await cp(resolve(commonFixturesRoot, `${type}-js`), resolve(root, `services/${type}`), {
            recursive: true
          })
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
