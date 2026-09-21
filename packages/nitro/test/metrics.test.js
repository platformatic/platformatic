import { ok, strictEqual } from 'node:assert'
import { resolve } from 'node:path'
import { test } from 'node:test'
import { request } from 'undici'
import { createRuntime, setAdditionalDependencies } from '../../basic/test/helper.js'
import { assertMetric, expectedMetrics } from '../../metrics/test/helper.js'

setAdditionalDependencies(['nitro', 'nitropack', 'vite'])

for (const fixture of ['standalone', 'standalone-nitro']) {
  for (const production of [false, true]) {
    test(`collects ${fixture} metrics in ${production ? 'production' : 'development'}`, async t => {
      const { url } = await createRuntime({
        t,
        root: resolve(import.meta.dirname, `./fixtures/${fixture}`),
        build: production,
        production,
        additionalSetup (_root, config) {
          config.metrics = true
        }
      })

      const response = await request(`${url}/`)
      strictEqual(response.statusCode, 200)

      const metricsResponse = await request(`http://${new URL(url).hostname}:9090/metrics`)
      const metrics = await metricsResponse.body.text()
      ok(metrics.length > 0)
      for (const metric of expectedMetrics) {
        assertMetric(metrics, metric)
      }
    })
  }
}
