import { deepStrictEqual } from 'node:assert'
import path, { resolve } from 'node:path'
import { test } from 'node:test'
import { request } from 'undici'
import { prepareRuntime, updateFile } from '../../basic/test/helper.js'

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

for (const [env, options] of Object.entries(envs)) {
  test(`Next.js application should use the runtime server keepAliveTimeout in ${env}`, async t => {
    const { runtime } = await prepareRuntime({
      t,
      root: path.resolve(import.meta.dirname, './fixtures/standalone'),
      build: options.build,
      production: options.production,
      // The runtime configuration is already loaded at this point, so it is updated in place
      async additionalSetup (_, config) {
        config.server.keepAliveTimeout = 65000
        config.server.headersTimeout = 66000
      }
    })

    const url = await runtime.start()
    const { headers, body } = await request(url)
    await body.dump()

    deepStrictEqual(headers['keep-alive'], 'timeout=65')
  })
}

test('Next.js standalone output should use the runtime server keepAliveTimeout', async t => {
  const { runtime } = await prepareRuntime({
    t,
    root: path.resolve(import.meta.dirname, './fixtures/server-side-standalone'),
    build: true,
    production: true,
    async additionalSetup (root, config) {
      await updateFile(resolve(root, 'services/frontend/next.config.js'), () => {
        return 'module.exports = { output: "standalone" }\n'
      })

      await updateFile(resolve(root, 'services/frontend/platformatic.application.json'), raw => {
        const json = JSON.parse(raw)
        json.next ??= {}
        json.next.standalone = true
        return JSON.stringify(json, null, 2)
      })

      config.server.keepAliveTimeout = 65000
      config.server.headersTimeout = 66000
    }
  })

  const url = await runtime.start()
  const { headers, body } = await request(url)
  await body.dump()

  deepStrictEqual(headers['keep-alive'], 'timeout=65')
})
