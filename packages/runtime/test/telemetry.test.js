import { SpanKind, SpanStatusCode } from '@opentelemetry/api'
import { ok, strictEqual } from 'node:assert'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { test } from 'node:test'
import { request } from 'undici'
import { createRuntime, createTemporaryDirectory } from './helpers.js'
const fixturesDir = join(import.meta.dirname, '..', 'fixtures')

async function readSpans (path) {
  const contents = await readFile(path, 'utf-8')
  return contents
    .split('\n')
    .filter(line => line.trim() !== '')
    .map(line => JSON.parse(line))
}

test('propagate the traceId correctly to runtime applications', async t => {
  const configFile = join(fixturesDir, 'telemetry', 'platformatic.runtime.json')
  const app = await createRuntime(configFile)

  t.after(async () => {
    await app.close()
  })

  const entryUrl = await app.start()

  const traceId = '5e994e8fb53b27c91dcd2fec22771d15'
  const spanId = '166f3ab30f21800b'
  const traceparent = `00-${traceId}-${spanId}-01`
  const res = await request(entryUrl, {
    method: 'GET',
    path: '/',
    headers: {
      traceparent
    }
  })

  strictEqual(res.statusCode, 200)
  const response = await res.body.json()
  strictEqual(response.traceId, traceId)
})

test('attach x-plt-telemetry-id header', async t => {
  const configFile = join(fixturesDir, 'telemetry', 'platformatic.runtime.json')
  const app = await createRuntime(configFile)

  t.after(async () => {
    await app.close()
  })

  const entryUrl = await app.start()

  const res = await request(entryUrl, {
    method: 'GET',
    path: '/service-1/echo-headers'
  })

  strictEqual(res.statusCode, 200)
  const response = await res.body.json()

  const echoReqHeaders = response.headers
  const telemetryIdHeader = echoReqHeaders['x-plt-telemetry-id']
  strictEqual(telemetryIdHeader, 'test-runtime-echo')
})

test('disabled telemetry', async t => {
  const configFile = join(fixturesDir, 'telemetry', 'disabled-telemetry.runtime.json')
  const app = await createRuntime(configFile)

  t.after(async () => {
    await app.close()
  })

  const entryUrl = await app.start()

  const traceId = '5e994e8fb53b27c91dcd2fec22771d15'
  const spanId = '166f3ab30f21800b'
  const traceparent = `00-${traceId}-${spanId}-01`
  const res = await request(entryUrl, {
    method: 'GET',
    path: '/',
    headers: {
      traceparent
    }
  })

  strictEqual(res.statusCode, 200)
  const response = await res.body.json()
  strictEqual(response.traceId, undefined)
})

test('propagate telemetry over messaging to pure ITC applications', async t => {
  const spansDir = await createTemporaryDirectory(t, 'telemetry-messaging')
  const spansPath = join(spansDir, 'spans.ndjson')
  const configFile = join(fixturesDir, 'telemetry-messaging', 'platformatic.runtime.json')
  const originalSpansPath = process.env.PLT_TELEMETRY_SPANS_PATH
  process.env.PLT_TELEMETRY_SPANS_PATH = spansPath

  t.after(() => {
    if (typeof originalSpansPath === 'undefined') {
      delete process.env.PLT_TELEMETRY_SPANS_PATH
    } else {
      process.env.PLT_TELEMETRY_SPANS_PATH = originalSpansPath
    }
  })

  const app = await createRuntime(configFile)
  let response

  try {
    const entryUrl = await app.start()
    const res = await request(entryUrl, {
      method: 'GET',
      path: '/send/abcde'
    })

    strictEqual(res.statusCode, 200)

    response = await res.body.json()
    strictEqual(response.value, 'edcba')
    ok(response.traceId)
  } finally {
    await app.close()
  }

  const spans = await readSpans(spansPath)
  const clientSpan = spans.find(span => span.name === 'ITC send ipc.reverse')
  const serverSpan = spans.find(span => span.name === 'ITC handle entrypoint.reverse')
  const internalSpan = spans.find(span => span.name === 'pure itc work')

  ok(clientSpan)
  ok(serverSpan)
  ok(internalSpan)

  strictEqual(clientSpan.kind, SpanKind.CLIENT)
  strictEqual(serverSpan.kind, SpanKind.SERVER)
  strictEqual(internalSpan.kind, SpanKind.INTERNAL)

  strictEqual(clientSpan.status.code, SpanStatusCode.OK)
  strictEqual(serverSpan.status.code, SpanStatusCode.OK)

  strictEqual(clientSpan.traceId, response.traceId)
  strictEqual(serverSpan.traceId, clientSpan.traceId)
  strictEqual(serverSpan.parentSpanContext.spanId, clientSpan.id)
  strictEqual(internalSpan.traceId, clientSpan.traceId)
  strictEqual(internalSpan.parentSpanContext.spanId, serverSpan.id)

  strictEqual(clientSpan.attributes['messaging.system'], 'platformatic-itc')
  strictEqual(clientSpan.attributes['messaging.operation'], 'send')
  strictEqual(clientSpan.attributes['platformatic.messaging.source'], 'entrypoint')
  strictEqual(clientSpan.attributes['platformatic.messaging.target'], 'ipc')
})

test('allow custom telemetry metadata for ITC messaging', async t => {
  const spansDir = await createTemporaryDirectory(t, 'telemetry-messaging-manual')
  const spansPath = join(spansDir, 'spans.ndjson')
  const configFile = join(fixturesDir, 'telemetry-messaging', 'platformatic.runtime.json')
  const originalSpansPath = process.env.PLT_TELEMETRY_SPANS_PATH
  process.env.PLT_TELEMETRY_SPANS_PATH = spansPath

  t.after(() => {
    if (typeof originalSpansPath === 'undefined') {
      delete process.env.PLT_TELEMETRY_SPANS_PATH
    } else {
      process.env.PLT_TELEMETRY_SPANS_PATH = originalSpansPath
    }
  })

  const app = await createRuntime(configFile)
  const traceId = '5e994e8fb53b27c91dcd2fec22771d15'
  const spanId = '166f3ab30f21800b'
  const traceparent = `00-${traceId}-${spanId}-01`
  let response

  try {
    const entryUrl = await app.start()
    const res = await request(entryUrl, {
      method: 'GET',
      path: '/send-manual/abcde',
      headers: {
        'x-manual-traceparent': traceparent
      }
    })

    strictEqual(res.statusCode, 200)

    response = await res.body.json()
    strictEqual(response.value, 'edcba')
    strictEqual(response.traceId, traceId)
  } finally {
    await app.close()
  }

  const spans = await readSpans(spansPath)
  const clientSpan = spans.find(span => span.name === 'ITC send ipc.reverse')
  const serverSpan = spans.find(span => span.name === 'ITC handle entrypoint.reverse')

  ok(clientSpan)
  ok(serverSpan)

  strictEqual(clientSpan.traceId, traceId)
  strictEqual(clientSpan.parentSpanContext.spanId, spanId)
  strictEqual(serverSpan.traceId, traceId)
  strictEqual(serverSpan.parentSpanContext.spanId, clientSpan.id)
  strictEqual(response.traceId, serverSpan.traceId)
})

test('mark messaging spans as errors when pure ITC handlers fail', async t => {
  const spansDir = await createTemporaryDirectory(t, 'telemetry-messaging-error')
  const spansPath = join(spansDir, 'spans.ndjson')
  const configFile = join(fixturesDir, 'telemetry-messaging', 'platformatic.runtime.json')
  const originalSpansPath = process.env.PLT_TELEMETRY_SPANS_PATH
  process.env.PLT_TELEMETRY_SPANS_PATH = spansPath

  t.after(() => {
    if (typeof originalSpansPath === 'undefined') {
      delete process.env.PLT_TELEMETRY_SPANS_PATH
    } else {
      process.env.PLT_TELEMETRY_SPANS_PATH = originalSpansPath
    }
  })

  const app = await createRuntime(configFile)

  try {
    const entryUrl = await app.start()
    const res = await request(entryUrl, {
      method: 'GET',
      path: '/fail'
    })

    strictEqual(res.statusCode, 500)

    const response = await res.body.json()
    strictEqual(response.message, 'Handler failed with error: Handler Kaboom!')
  } finally {
    await app.close()
  }

  const spans = await readSpans(spansPath)
  const clientSpan = spans.find(span => span.name === 'ITC send ipc.fail')
  const serverSpan = spans.find(span => span.name === 'ITC handle entrypoint.fail')

  ok(clientSpan)
  ok(serverSpan)

  strictEqual(clientSpan.kind, SpanKind.CLIENT)
  strictEqual(serverSpan.kind, SpanKind.SERVER)

  strictEqual(clientSpan.status.code, SpanStatusCode.ERROR)
  strictEqual(serverSpan.status.code, SpanStatusCode.ERROR)

  strictEqual(serverSpan.traceId, clientSpan.traceId)
  strictEqual(serverSpan.parentSpanContext.spanId, clientSpan.id)
  strictEqual(clientSpan.attributes['error.message'], 'Handler failed with error: Handler Kaboom!')
  strictEqual(serverSpan.attributes['error.message'], 'Handler Kaboom!')
})
