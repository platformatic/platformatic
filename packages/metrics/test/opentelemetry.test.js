import assert from 'node:assert'
import { test } from 'node:test'
import { openTelemetryITCMessage, OpenTelemetryExporter } from '../index.js'

test('OpenTelemetryExporter relays resource metrics with Platformatic attributes', async () => {
  let notification
  const exporter = new OpenTelemetryExporter({
    applicationId: 'test-app',
    workerId: 7,
    itc: {
      notify (name, payload) {
        notification = { name, payload }
      }
    }
  })

  const resourceMetrics = {
    resource: {
      attributes: {
        'service.name': 'user-service'
      }
    },
    scopeMetrics: []
  }

  const result = await new Promise(resolve => {
    exporter.export(resourceMetrics, resolve)
  })

  assert.strictEqual(result.code, 0)
  assert.strictEqual(notification.name, openTelemetryITCMessage)
  assert.deepStrictEqual(notification.payload.resource.attributes, {
    'service.name': 'user-service',
    applicationId: 'test-app',
    workerId: 7
  })
  assert.deepStrictEqual(resourceMetrics.resource.attributes, {
    'service.name': 'user-service'
  })
})

test('OpenTelemetryExporter fails after shutdown', async () => {
  const exporter = new OpenTelemetryExporter({
    itc: {
      notify () {}
    }
  })

  await exporter.shutdown()

  const result = await new Promise(resolve => {
    exporter.export({ resource: { attributes: {} }, scopeMetrics: [] }, resolve)
  })

  assert.strictEqual(result.code, 1)
})
