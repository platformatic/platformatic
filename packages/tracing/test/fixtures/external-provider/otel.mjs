import { context, propagation, trace } from '@opentelemetry/api'
import { AsyncLocalStorageContextManager } from '@opentelemetry/context-async-hooks'
import { ExportResultCode, W3CTraceContextPropagator } from '@opentelemetry/core'
import { resourceFromAttributes } from '@opentelemetry/resources'
import { SimpleSpanProcessor, TracerProvider } from '@opentelemetry/sdk-trace'
import { appendFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { workerData } from 'node:worker_threads'

// This plays the role of an observability product: it registers its own OpenTelemetry pipeline
// before Platformatic tracing is loaded.
const path = resolve(import.meta.dirname, 'external-spans.log')

const exporter = {
  export (spans, callback) {
    for (const span of spans) {
      const line = {
        id: span.spanContext().spanId,
        traceId: span.spanContext().traceId,
        parentId: span.parentSpanContext?.spanId ?? null,
        name: span.name,
        kind: span.kind,
        scope: span.instrumentationScope.name,
        service: span.resource.attributes['service.name'],
        attributes: span.attributes
      }

      appendFileSync(path, JSON.stringify(line) + '\n')
    }

    callback({ code: ExportResultCode.SUCCESS })
  },
  async shutdown () {},
  async forceFlush () {}
}

const provider = new TracerProvider({
  spanProcessors: [new SimpleSpanProcessor({ exporter })],
  resource: resourceFromAttributes({ 'service.name': `external-${workerData.applicationConfig.id}` })
})

context.setGlobalContextManager(new AsyncLocalStorageContextManager().enable())
propagation.setGlobalPropagator(new W3CTraceContextPropagator())
trace.setGlobalTracerProvider(provider)
