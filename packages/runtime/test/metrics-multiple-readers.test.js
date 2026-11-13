import { strictEqual } from 'node:assert'
import { join } from 'node:path'
import { test } from 'node:test'
import getPort from 'get-port'
import { request } from 'undici'
import { createRuntime } from './helpers.js'

const fixturesDir = join(import.meta.dirname, '..', 'fixtures')
const REQUESTS = 5

function countRequests (metrics, applicationId) {
  // Each worker reports its own entry for the same metric family
  let count = 0
  for (const metric of metrics) {
    if (metric.name !== 'http_request_all_duration_seconds') continue

    for (const value of metric.values) {
      if (
        value.metricName === 'http_request_all_duration_seconds_count' &&
        value.labels.applicationId === applicationId
      ) {
        count += value.value
      }
    }
  }

  return count
}

async function scrape (port) {
  const { statusCode, body } = await request(`http://127.0.0.1:${port}`, {
    method: 'GET',
    path: '/metrics',
    headers: { accept: 'application/json' }
  })
  strictEqual(statusCode, 200)
  return body.json()
}

async function startRuntime (t) {
  const port = await getPort()

  const app = await createRuntime(join(fixturesDir, 'prom-server'), {
    $schema: 'https://schemas.platformatic.dev/@platformatic/runtime/2.48.0.json',
    entrypoint: 'main',
    watch: false,
    autoload: {
      path: './services'
    },
    server: {
      hostname: '127.0.0.1',
      port: 0
    },
    metrics: {
      hostname: '127.0.0.1',
      port
    },
    workers: 1
  })

  const entryUrl = await app.start()

  t.after(async () => {
    await app.close()
  })

  return { app, entryUrl, port }
}

async function sendRequests (entryUrl) {
  for (let i = 0; i < REQUESTS; i++) {
    const { statusCode, body } = await request(entryUrl + '/service-1/hello')
    strictEqual(statusCode, 200)
    await body.dump()
  }
}

test('a Prometheus scrape sees all the requests when it is the only reader', async t => {
  const { entryUrl, port } = await startRuntime(t)

  await sendRequests(entryUrl)

  const scraped = await scrape(port)
  strictEqual(countRequests(scraped, 'service-1'), REQUESTS)
})

test('another getMetrics() reader must not hide requests from the Prometheus scrape', async t => {
  const { app, entryUrl, port } = await startRuntime(t)

  // Prometheus is scraping: the first scrape makes it the reader of the metrics
  await scrape(port)

  await sendRequests(entryUrl)

  // A second reader, e.g. `wattpm metrics` or a management ITC application.
  // It gets the last scrape, so it does not reset the HTTP metrics.
  const { metrics } = await app.getMetrics('json')
  strictEqual(countRequests(metrics, 'service-1'), 0)

  const scraped = await scrape(port)
  strictEqual(countRequests(scraped, 'service-1'), REQUESTS)
})
