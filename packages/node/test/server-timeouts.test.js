import { deepStrictEqual } from 'node:assert'
import path from 'node:path'
import { test } from 'node:test'
import { request } from 'undici'
import { prepareRuntime } from '../../basic/test/helper.js'

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

const fixtures = {
  '': 'express-no-build-standalone',
  ' when using custom commands': 'node-set-connection-string'
}

for (const [env, options] of Object.entries(envs)) {
  for (const [suffix, fixture] of Object.entries(fixtures)) {
    test(`node application should use the runtime server keepAliveTimeout in ${env}${suffix}`, async t => {
      const { runtime } = await prepareRuntime({
        t,
        root: path.resolve(import.meta.dirname, './fixtures', fixture),
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
}
