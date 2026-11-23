import { context, propagation, SpanKind, trace } from '@opentelemetry/api'
import { AsyncLocalStorageContextManager } from '@opentelemetry/context-async-hooks'
import { W3CTraceContextPropagator } from '@opentelemetry/core'
import { resourceFromAttributes } from '@opentelemetry/resources'
import { InMemorySpanExporter, SimpleSpanProcessor, TracerProvider } from '@opentelemetry/sdk-trace'
import fastify from 'fastify'
import { deepEqual, equal, ok } from 'node:assert'
import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { test } from 'node:test'
import { setTimeout as sleep } from 'node:timers/promises'
import { pathToFileURL } from 'node:url'
import { request } from 'undici'
import { createRuntime, setFixturesDir } from '../../basic/test/helper.js'
import { getExternalTracerProvider } from '../lib/provider.js'
import telemetryPlugin from '../lib/telemetry.js'
import { parseNDJson } from './helper.js'

setFixturesDir(resolve(import.meta.dirname, './fixtures'))

const pluginOptions = {
  applicationName: 'test-application',
  version: '1.0.0',
  exporter: {
    type: 'memory'
  }
}

const injectArgs = {
  method: 'GET',
  url: '/test',
  headers: {
    host: 'test'
  }
}

function registerExternalProvider (t) {
  const exporter = new InMemorySpanExporter()
  const provider = new TracerProvider({
    spanProcessors: [new SimpleSpanProcessor({ exporter })],
    resource: resourceFromAttributes({ 'service.name': 'external' })
  })

  context.setGlobalContextManager(new AsyncLocalStorageContextManager().enable())
  propagation.setGlobalPropagator(new W3CTraceContextPropagator())
  trace.setGlobalTracerProvider(provider)

  t.after(async () => {
    await provider.shutdown()
    trace.disable()
    context.disable()
    propagation.disable()
  })

  return { exporter, provider }
}

async function setupApp (t) {
  const app = fastify()
  await app.register(telemetryPlugin, pluginOptions)
  app.get('/test', async () => ({ foo: 'bar' }))
  t.after(() => app.close())

  return app
}

test('should register a global provider when there is none and release it on close', async t => {
  equal(getExternalTracerProvider(), null)

  const app = await setupApp(t)
  const { provider, exporters } = app.openTelemetry
  equal(getExternalTracerProvider(), provider)

  // The application code obtains a working tracer through the OpenTelemetry API.
  trace.getTracer('test').startSpan('custom').end()
  deepEqual(
    exporters[0].getFinishedSpans().map(span => span.name),
    ['custom']
  )

  await app.close()
  equal(getExternalTracerProvider(), null)
})

test('should use the provider registered by another party without replacing it', async t => {
  const { exporter, provider } = registerExternalProvider(t)

  const app = await setupApp(t)
  equal(app.openTelemetry.provider, provider)
  deepEqual(app.openTelemetry.exporters, [])
  equal(getExternalTracerProvider(), provider)

  const response = await app.inject(injectArgs)
  equal(response.statusCode, 200)
  ok(response.headers.traceparent)

  // The spans reach the external pipeline, with its own resource.
  const spans = exporter.getFinishedSpans()
  equal(spans.length, 1)
  equal(spans[0].name, 'GET /test')
  equal(spans[0].kind, SpanKind.SERVER)
  equal(spans[0].resource.attributes['service.name'], 'external')

  // Closing the application must leave the external pipeline registered and working.
  await app.close()
  equal(getExternalTracerProvider(), provider)

  trace.getTracer('test').startSpan('after-close').end()
  equal(exporter.getFinishedSpans().at(-1).name, 'after-close')
})

test('should create the client and internal spans with the provider registered by another party', async t => {
  const { exporter } = registerExternalProvider(t)

  const app = await setupApp(t)
  const { startHTTPSpanClient, endHTTPSpanClient, startSpan, endSpan } = app.openTelemetry

  const parent = startSpan('parent')
  const parentContext = trace.setSpan(context.active(), parent)
  const { span, telemetryHeaders } = startHTTPSpanClient('http://localhost:3000/test', 'GET', parentContext)
  endHTTPSpanClient(span, { statusCode: 200 })
  endSpan(parent)

  const [client, internal] = exporter.getFinishedSpans()
  equal(client.kind, SpanKind.CLIENT)
  equal(client.parentSpanContext.spanId, internal.spanContext().spanId)
  equal(internal.kind, SpanKind.INTERNAL)
  equal(telemetryHeaders.traceparent, `00-${client.spanContext().traceId}-${client.spanContext().spanId}-01`)
})

test('should not interfere with the provider registered before the tracing is loaded in the runtime', async t => {
  // gateway -> fastify -> node
  //
  // The fastify and node applications register their own OpenTelemetry pipeline before Platformatic tracing
  // is loaded, while the gateway does not.
  function preloadExternalProvider (root, config) {
    for (const application of config.applications) {
      if (application.id !== 'composer') {
        application.execArgv = ['--import', pathToFileURL(resolve(root, 'otel.mjs')).href]
      }
    }
  }
  // The applications are only available once the runtime configuration is loaded.
  preloadExternalProvider.runAfterPrepare = true

  const { url, root } = await createRuntime(
    t,
    'external-provider',
    false,
    true,
    'watt.config.mjs',
    preloadExternalProvider
  )

  const { statusCode } = await request(`${url}/fastify/node`, { method: 'GET' })
  equal(statusCode, 200)
  await sleep(500)

  const externalSpans = await parseNDJson(join(root, 'external-spans.log'))
  const platformaticSpans = await parseNDJson(join(root, 'spans.log'))

  // Platformatic only exports the spans of the application without an external pipeline.
  ok(platformaticSpans.length > 0)
  for (const span of platformaticSpans) {
    equal(span.resource.attributes['service.name'], 'test-runtime-composer')
  }
  ok(!existsSync(join(root, 'web/fastify/spans.log')))
  ok(!existsSync(join(root, 'web/node/spans.log')))

  // The external pipeline receives the spans created by the Platformatic instrumentations, once.
  deepEqual(
    externalSpans.map(span => [span.service, span.kind, span.name, span.scope]).sort(),
    [
      ['external-fastify', SpanKind.CLIENT, 'GET http://node.plt.local/', '@platformatic/instrumentation-thread-interceptor'],
      ['external-fastify', SpanKind.SERVER, 'GET /node', '@platformatic/instrumentation-light-my-request'],
      ['external-node', SpanKind.SERVER, 'GET /', '@platformatic/instrumentation-light-my-request']
    ].sort()
  )

  // The trace is continuous across the pipelines.
  const gatewayClient = platformaticSpans.find(span => span.kind === SpanKind.CLIENT)
  const fastifyServer = externalSpans.find(span => span.service === 'external-fastify' && span.kind === SpanKind.SERVER)
  const fastifyClient = externalSpans.find(span => span.kind === SpanKind.CLIENT)
  const nodeServer = externalSpans.find(span => span.service === 'external-node')

  equal(fastifyServer.parentId, gatewayClient.id)
  equal(fastifyClient.parentId, fastifyServer.id)
  equal(nodeServer.parentId, fastifyClient.id)

  for (const span of [fastifyServer, fastifyClient, nodeServer]) {
    equal(span.traceId, gatewayClient.traceId)
  }
})
