import { strictEqual } from 'node:assert'
import { resolve } from 'node:path'
import { test } from 'node:test'
import { prepareRuntime, setAdditionalDependencies } from '../../basic/test/helper.js'
import { updateConfigFile } from '../../runtime/test/helpers.js'

setAdditionalDependencies(['nitro', 'nitropack', 'vite'])

function waitForServerOptions (runtime) {
  const { promise, resolve } = Promise.withResolvers()

  function listener (options, _, application) {
    if (application === 'frontend') {
      runtime.removeListener('application:worker:event:serverOptions', listener)
      resolve(options)
    }
  }

  runtime.on('application:worker:event:serverOptions', listener)
  return promise
}

for (const [fixture, production] of [
  ['standalone', false],
  ['standalone', true],
  ['standalone-nitro', true]
]) {
  test(`passes backlog to ${fixture} in ${production ? 'production' : 'development'}`, async t => {
    const { runtime } = await prepareRuntime({
      t,
      root: resolve(import.meta.dirname, `./fixtures/${fixture}`),
      build: production,
      production,
      additionalSetup (root) {
        return updateConfigFile(resolve(root, 'services/frontend/platformatic.application.json'), config => {
          config.server ??= {}
          config.server.backlog = 64
        })
      }
    })

    const optionsPromise = waitForServerOptions(runtime)
    await runtime.start()
    strictEqual((await optionsPromise).backlog, 64)
  })
}
