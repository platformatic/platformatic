import { context, propagation, SpanKind, SpanStatusCode, trace } from '@opentelemetry/api'
import { AsyncLocalStorageContextManager } from '@opentelemetry/context-async-hooks'
import { W3CTraceContextPropagator } from '@opentelemetry/core'
import { registerInstrumentations } from '@opentelemetry/instrumentation'
import { InMemorySpanExporter, SimpleSpanProcessor, TracerProvider } from '@opentelemetry/sdk-trace'
import { deepStrictEqual, strictEqual } from 'node:assert'
import { once } from 'node:events'
import { register } from 'node:module'
import { after, afterEach, test } from 'node:test'
import { Worker } from 'node:worker_threads'
import { Agent, request } from 'undici'
import { ThreadInterceptorInstrumentation } from '../lib/index.js'

const exporter = new InMemorySpanExporter()
const provider = new TracerProvider({ spanProcessors: [new SimpleSpanProcessor({ exporter })] })

context.setGlobalContextManager(new AsyncLocalStorageContextManager().enable())
propagation.setGlobalPropagator(new W3CTraceContextPropagator())
trace.setGlobalTracerProvider(provider)

// undici-thread-interceptor is an ES module, which can only be patched through the OpenTelemetry loader hook.
register('@opentelemetry/instrumentation/hook.mjs', import.meta.url)

const instrumentation = new ThreadInterceptorInstrumentation()
const unregister = registerInstrumentations({ instrumentations: [instrumentation] })

// The module must be loaded after the registration in order to be patched.
const { createCoordinator, createInterceptor } = await import('undici-thread-interceptor')

const meshId = 'test'
const coordinator = createCoordinator({ meshId })

afterEach(() => {
  exporter.reset()
})

after(async () => {
  coordinator.destroy()
  unregister()
  await provider.shutdown()
  trace.disable()
  context.disable()
  propagation.disable()
})

async function createDispatcher (t, options = {}) {
  const worker = new Worker(new URL('./fixtures/worker.js', import.meta.url), {
    workerData: { meshId, coordinatorThreadId: 0 }
  })
  await once(worker, 'message')

  const interceptor = createInterceptor({ meshId, domain: '.local', ...options })
  await interceptor.ready

  const dispatcher = new Agent().compose(interceptor)
  t.after(async () => {
    await dispatcher.close()
    await interceptor.close()
    await worker.terminate()
  })

  return dispatcher
}

test('should trace a request and propagate the trace context', async t => {
  const dispatcher = await createDispatcher(t)

  const response = await request('http://myserver.local/hello?foo=bar', { dispatcher })
  const headers = await response.body.json()
  strictEqual(response.statusCode, 200)

  const spans = exporter.getFinishedSpans()
  strictEqual(spans.length, 1)

  const [span] = spans
  strictEqual(span.name, 'GET http://myserver.local/hello')
  strictEqual(span.kind, SpanKind.CLIENT)
  strictEqual(span.status.code, SpanStatusCode.OK)
  deepStrictEqual(span.attributes, {
    'http.request.method': 'GET',
    'http.response.status_code': 200,
    'server.address': 'myserver.local',
    'url.full': 'http://myserver.local/hello?foo=bar',
    'url.path': '/hello',
    'url.scheme': 'http'
  })

  const { traceId, spanId } = span.spanContext()
  strictEqual(headers.traceparent, `00-${traceId}-${spanId}-01`)
})

test('should use the active span as the parent', async t => {
  const dispatcher = await createDispatcher(t)
  const parent = trace.getTracer('test').startSpan('parent')

  await context.with(trace.setSpan(context.active(), parent), async () => {
    const response = await request('http://myserver.local/hello', { dispatcher })
    await response.body.dump()
  })
  parent.end()

  const [span] = exporter.getFinishedSpans()
  strictEqual(span.parentSpanContext.spanId, parent.spanContext().spanId)
  strictEqual(span.spanContext().traceId, parent.spanContext().traceId)
})

test('should mark the span as failed on error responses', async t => {
  const dispatcher = await createDispatcher(t)

  const response = await request('http://myserver.local/error', { dispatcher })
  await response.body.dump()

  const [span] = exporter.getFinishedSpans()
  strictEqual(span.attributes['http.response.status_code'], 500)
  strictEqual(span.status.code, SpanStatusCode.ERROR)
})

test('should not duplicate the spans when the hooks are passed explicitly', async t => {
  let customHookCalls = 0
  const hooks = instrumentation.createHooks()
  const dispatcher = await createDispatcher(t, {
    ...hooks,
    onRequest: [
      () => {
        customHookCalls++
      },
      hooks.onRequest
    ]
  })

  const response = await request('http://myserver.local/hello', { dispatcher })
  await response.body.dump()

  strictEqual(customHookCalls, 1)
  strictEqual(exporter.getFinishedSpans().length, 1)
})

test('should preserve the hooks defined by the caller', async t => {
  let customHookCalls = 0
  const dispatcher = await createDispatcher(t, {
    onRequest () {
      customHookCalls++
    }
  })

  const response = await request('http://myserver.local/hello', { dispatcher })
  await response.body.dump()

  strictEqual(customHookCalls, 1)
  strictEqual(exporter.getFinishedSpans().length, 1)
})

test('should not trace when disabled', async t => {
  const dispatcher = await createDispatcher(t)

  instrumentation.disable()
  t.after(() => instrumentation.enable())

  const response = await request('http://myserver.local/hello', { dispatcher })
  const headers = await response.body.json()

  strictEqual(headers.traceparent, undefined)
  strictEqual(exporter.getFinishedSpans().length, 0)
})
