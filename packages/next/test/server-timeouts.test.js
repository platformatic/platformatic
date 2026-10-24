import { deepStrictEqual } from 'node:assert'
import path, { resolve } from 'node:path'
import { test } from 'node:test'
import { request } from 'undici'
import { prepareRuntime, updateFile } from '../../basic/test/helper.js'
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

for (const [env, options] of Object.entries(envs)) {
  test(`Next.js application should use its server keepAliveTimeout in ${env}`, async t => {
    const { runtime } = await prepareRuntime({
      t,
      root: path.resolve(import.meta.dirname, './fixtures/standalone'),
      build: options.build,
      production: options.production,
      async beforeLoad (root) {
        await updateConfigFile(resolve(root, 'services/frontend/watt.config.mjs'), config => {
          config.server.keepAliveTimeout = 65000
          config.server.headersTimeout = 66000
        })
      }
    })

    const { 'frontend:0': url } = await runtime.start()
    const { headers, body } = await request(url)
    await body.dump()

    deepStrictEqual(headers['keep-alive'], 'timeout=65')
  })
}

test('Next.js standalone output should use its server keepAliveTimeout', async t => {
  const { runtime } = await prepareRuntime({
    t,
    root: path.resolve(import.meta.dirname, './fixtures/server-side-standalone'),
    build: true,
    production: true,
    async beforeLoad (root) {
      await updateFile(resolve(root, 'services/frontend/next.config.js'), () => {
        return 'module.exports = { output: "standalone" }\n'
      })

      await updateConfigFile(resolve(root, 'services/frontend/watt.config.mjs'), config => {
        config.next ??= {}
        config.next.standalone = true
        config.server.keepAliveTimeout = 65000
        config.server.headersTimeout = 66000
      })
    }
  })

  const { 'frontend:0': url } = await runtime.start()
  const { headers, body } = await request(url)
  await body.dump()

  deepStrictEqual(headers['keep-alive'], 'timeout=65')
})
