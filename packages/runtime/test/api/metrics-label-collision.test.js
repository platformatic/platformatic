import { ok, strictEqual } from 'node:assert'
import { join } from 'node:path'
import { test } from 'node:test'
import { transform } from '../../index.js'
import { createRuntime } from '../helpers.js'

const fixturesDir = join(import.meta.dirname, '..', '..', 'fixtures')

function createRuntimeWithCollidingLabels (t) {
  const configFile = join(fixturesDir, 'management-api', 'platformatic.json')

  return createRuntime(configFile, null, {
    async transform (config, ...args) {
      config = await transform(config, ...args)
      config.metrics = {
        ...config.metrics,
        // Bind the metrics server to a random free port: the default 9090 is a
        // common local port (Prometheus, Docker desktops) and would make the
        // runtime fail to start on developer machines.
        hostname: '127.0.0.1',
        port: 0,
        applicationLabel: 'serviceId',
        labels: { serviceId: 'main', instanceId: 'pod-1', applicationId: 'icc-app-id' }
      }
      return config
    }
  })
}

test('formatted metrics report cpu and rss for every application when a custom label collides with applicationLabel', async t => {
  const app = await createRuntimeWithCollidingLabels(t)
  await app.start()

  t.after(async () => {
    await app.close()
  })

  const { applications } = await app.getFormattedMetrics()

  for (const applicationId of ['service-1', 'service-2', 'service-db']) {
    const applicationMetrics = applications[applicationId]
    ok(applicationMetrics, `Expected formatted metrics for ${applicationId}`)
    ok(applicationMetrics.cpu > 0, `Expected cpu > 0 for ${applicationId}, got ${applicationMetrics.cpu}`)
    ok(applicationMetrics.rss > 0, `Expected rss > 0 for ${applicationId}, got ${applicationMetrics.rss}`)
  }

  strictEqual(applications.main, undefined, 'Expected no phantom "main" application from the static serviceId label')
})

test('runtime-wide process metrics are not attributed to a service when a custom label collides with applicationLabel', async t => {
  const app = await createRuntimeWithCollidingLabels(t)
  await app.start()

  t.after(async () => {
    await app.close()
  })

  const { metrics } = await app.getMetrics('text')
  const rssLines = metrics.split('\n').filter(line => line.startsWith('process_resident_memory_bytes'))

  strictEqual(rssLines.length, 1, 'Expected process_resident_memory_bytes to be reported only once')
  ok(
    !rssLines[0].includes('serviceId='),
    `Expected the runtime-wide process_resident_memory_bytes to have no serviceId label, got: ${rssLines[0]}`
  )
})
