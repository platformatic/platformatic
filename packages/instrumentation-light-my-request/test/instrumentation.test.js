import { context, propagation, SpanKind, SpanStatusCode, trace } from '@opentelemetry/api'
import { AsyncLocalStorageContextManager } from '@opentelemetry/context-async-hooks'
import { getRPCMetadata, W3CTraceContextPropagator } from '@opentelemetry/core'
import { registerInstrumentations } from '@opentelemetry/instrumentation'
import { InMemorySpanExporter, SimpleSpanProcessor, TracerProvider } from '@opentelemetry/sdk-trace'
import { deepStrictEqual, notStrictEqual, ok, rejects, strictEqual } from 'node:assert'
import { createRequire } from 'node:module'
import { after, afterEach, test } from 'node:test'
import { LightMyRequestInstrumentation } from '../lib/index.js'

const exporter = new InMemorySpanExporter()
const provider = new TracerProvider({ spanProcessors: [new SimpleSpanProcessor({ exporter })] })

context.setGlobalContextManager(new AsyncLocalStorageContextManager().enable())
propagation.setGlobalPropagator(new W3CTraceContextPropagator())
trace.setGlobalTracerProvider(provider)

const instrumentation = new LightMyRequestInstrumentation()
const unregister = registerInstrumentations({ instrumentations: [instrumentation] })

// The modules must be loaded after the registration in order to be patched.
const require = createRequire(import.meta.url)
const inject = require('light-my-request')
const fastify = require('fastify')

afterEach(() => {
  exporter.reset()
})

after(async () => {
  unregister()
  await provider.shutdown()
  trace.disable()
  context.disable()
  propagation.disable()
})

test('should trace a request injected with a callback', async () => {
  const { promise, resolve, reject } = Promise.withResolvers()

  inject(
    (_request, response) => {
      response.end('ok')
    },
    { method: 'GET', url: '/hello?foo=bar', headers: { host: 'example.com:3000' } },
    (error, response) => (error ? reject(error) : resolve(response))
  )

  const response = await promise
  strictEqual(response.statusCode, 200)

  const spans = exporter.getFinishedSpans()
  strictEqual(spans.length, 1)
  strictEqual(spans[0].name, 'GET /hello')
  strictEqual(spans[0].kind, SpanKind.SERVER)
  strictEqual(spans[0].status.code, SpanStatusCode.UNSET)
  deepStrictEqual(spans[0].attributes, {
    'http.request.method': 'GET',
    'http.response.status_code': 200,
    'server.address': 'example.com',
    'server.port': 3000,
    'url.full': 'http://example.com:3000/hello?foo=bar',
    'url.path': '/hello',
    'url.query': 'foo=bar',
    'url.scheme': 'http'
  })
})

test('should trace a request injected with a promise and make the span active', async () => {
  let activeSpan

  const response = await inject(
    (_request, response) => {
      activeSpan = trace.getActiveSpan()
      response.end('ok')
    },
    { method: 'POST', url: '/hello', payload: { foo: 'bar' } }
  )

  strictEqual(response.statusCode, 200)

  const spans = exporter.getFinishedSpans()
  strictEqual(spans.length, 1)
  strictEqual(spans[0].name, 'POST /hello')
  strictEqual(activeSpan.spanContext().spanId, spans[0].spanContext().spanId)
})

test('should trace a request injected with the chained and the bound APIs', async () => {
  const dispatch = (_request, response) => {
    response.end('ok')
  }

  await inject(dispatch).get('/chained').end()
  await inject.bindInject(dispatch, { method: 'GET' })({ url: '/bound' })

  deepStrictEqual(
    exporter.getFinishedSpans().map(span => span.name),
    ['GET /chained', 'GET /bound']
  )
})

test('should continue the trace received in the request headers', async () => {
  const traceId = '5e994e8fb53b27c91dcd2fec22771d15'
  const parentId = '166f3ab30f21800b'

  await inject(
    (_request, response) => {
      response.end('ok')
    },
    { method: 'GET', url: '/hello', headers: { traceparent: `00-${traceId}-${parentId}-01` } }
  )

  const [span] = exporter.getFinishedSpans()
  strictEqual(span.spanContext().traceId, traceId)
  strictEqual(span.parentSpanContext.spanId, parentId)
})

test('should use the route reported through the RPC metadata', async () => {
  await inject(
    (_request, response) => {
      getRPCMetadata(context.active()).route = '/users/:id'
      response.end('ok')
    },
    { method: 'GET', url: '/users/123' }
  )

  const [span] = exporter.getFinishedSpans()
  strictEqual(span.name, 'GET /users/:id')
  strictEqual(span.attributes['http.route'], '/users/:id')
  strictEqual(span.attributes['url.path'], '/users/123')
})

test('should mark the span as failed on server errors only', async () => {
  for (const statusCode of [404, 503]) {
    await inject(
      (_request, response) => {
        response.statusCode = statusCode
        response.end('ko')
      },
      { method: 'GET', url: '/hello' }
    )
  }

  const spans = exporter.getFinishedSpans()
  strictEqual(spans[0].attributes['http.response.status_code'], 404)
  strictEqual(spans[0].status.code, SpanStatusCode.UNSET)
  strictEqual(spans[1].attributes['http.response.status_code'], 503)
  strictEqual(spans[1].status.code, SpanStatusCode.ERROR)
})

test('should record the exception thrown by the dispatch function', async () => {
  await rejects(
    inject(
      () => {
        throw new Error('kaboom')
      },
      { method: 'GET', url: '/hello' }
    ),
    { message: 'kaboom' }
  )

  const [span] = exporter.getFinishedSpans()
  strictEqual(span.status.code, SpanStatusCode.ERROR)
  strictEqual(span.status.message, 'kaboom')
  strictEqual(span.events[0].name, 'exception')
})

test('should trace fastify.inject', async t => {
  const app = fastify()
  app.get('/users/:id', async request => ({ id: request.params.id }))
  t.after(() => app.close())

  const response = await app.inject({ method: 'GET', url: '/users/123' })
  deepStrictEqual(response.json(), { id: '123' })

  const spans = exporter.getFinishedSpans()
  strictEqual(spans.length, 1)
  strictEqual(spans[0].name, 'GET /users/123')
  strictEqual(spans[0].attributes['http.response.status_code'], 200)
})

test('should preserve the Express application detection', async () => {
  const requestPrototype = {}
  const responsePrototype = {}

  function app (_request, response) {
    response.end('ok')
  }
  app.request = Object.create(requestPrototype, { app: { configurable: true, writable: true, value: app } })
  app.response = Object.create(responsePrototype)

  const response = await inject(app, { method: 'GET', url: '/hello' })
  strictEqual(response.statusCode, 200)

  // light-my-request reparents the prototypes of the detected Express application.
  notStrictEqual(Object.getPrototypeOf(requestPrototype), Object.prototype)
  notStrictEqual(Object.getPrototypeOf(responsePrototype), Object.prototype)
  strictEqual(exporter.getFinishedSpans().length, 1)
})

test('should not validate or trace an invalid dispatch function differently', async () => {
  let error
  try {
    inject('invalid', { method: 'GET', url: '/hello' }, () => {})
  } catch (e) {
    error = e
  }

  ok(error.message.includes('dispatchFunc should be a function'))
  strictEqual(exporter.getFinishedSpans().length, 0)
})

test('should not trace when disabled', async t => {
  instrumentation.disable()
  t.after(() => instrumentation.enable())

  const response = await inject(
    (_request, response) => {
      response.end('ok')
    },
    { method: 'GET', url: '/hello' }
  )

  strictEqual(response.statusCode, 200)
  strictEqual(exporter.getFinishedSpans().length, 0)
})
