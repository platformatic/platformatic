import getPort from 'get-port'
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
  test(`observes the server options of ${fixture} in ${production ? 'production' : 'development'}`, async t => {
    let port

    const { runtime } = await prepareRuntime({
      t,
      root: resolve(import.meta.dirname, `./fixtures/${fixture}`),
      build: production,
      production,
      async additionalSetup (root) {
        port = await getPort()

        return updateConfigFile(resolve(root, 'services/frontend/platformatic.application.json'), config => {
          config.server ??= {}
          config.server.backlog = 64
          config.server.port = port
        })
      }
    })

    const optionsPromise = waitForServerOptions(runtime)
    await runtime.start()

    // Nitro owns its listener: the runtime observes the options rather than rewriting them,
    // so the configured backlog never reaches the server.
    const serverOptions = await optionsPromise
    strictEqual(serverOptions.backlog, undefined)
    strictEqual(serverOptions.port, port)
  })
}
