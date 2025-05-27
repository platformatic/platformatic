import assert from 'node:assert'
import path from 'node:path'
import { test } from 'node:test'
import { request } from 'undici'
import { fullSetupRuntime } from '../../basic/test/helper.js'
import { assertMetric, expectedMetrics } from '../../metrics/test/helper.js'

export const cliPath = path.join(import.meta.dirname, '../../cli', 'cli.js')

const envs = {
  production: {
    build: true,
    production: true
  },
  dev: {
    build: false,
    production: false
  }
}

for (const [env, options] of Object.entries(envs)) {
  test(`NestJS service properly collects metrics ${env}`, async t => {
    const { url } = await fullSetupRuntime({
      t,
      configRoot: path.resolve(import.meta.dirname, './fixtures/metrics'),
      build: options.build,
      production: options.production
    })

    {
      const res = await request(`${url}/`)
      const body = await res.body.text()

      assert.ok(body.length > 0)
      assert.strictEqual(res.statusCode, 200)
    }

    {
      const hostname = new URL(url).hostname
      const res = await request(`http://${hostname}:9090/metrics`)
      const metrics = await res.body.text()

      for (const metric of expectedMetrics) {
        assertMetric(metrics, metric)
      }
    }
  })
}
