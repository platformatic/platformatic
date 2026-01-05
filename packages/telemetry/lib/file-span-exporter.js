import { ExportResultCode, hrTimeToMicroseconds } from '@opentelemetry/core'
import { appendFileSync } from 'node:fs'
import { resolve as resolvePath } from 'node:path'
import { workerData } from 'node:worker_threads'

// Export spans to a file, mostly for testing purposes.
export class FileSpanExporter {
  #path
  constructor (opts) {
    // Try to get dirname from workerData first, then globalThis.platformatic, then fall back to process.cwd()
    const dirname = workerData?.dirname ?? globalThis.platformatic?.dirname ?? process.cwd()
    this.#path = resolvePath(dirname, opts.path ?? 'spans.log')
  }

  export (spans, resultCallback) {
    for (const span of spans) {
      const spanInfo = this.#exportInfo(span)
      appendFileSync(this.#path, JSON.stringify(spanInfo) + '\n')
    }
    resultCallback(ExportResultCode.SUCCESS)
  }

  shutdown () {
    return this.forceFlush()
  }

  forceFlush () {
    return Promise.resolve()
  }

  #exportInfo (span) {
    // OpenTelemetry 2.0+ resources need to be serialized with their attributes
    const resource = {
      attributes: span.resource?.attributes || {}
    }

    // In OTel 2.0, spans have parentSpanContext property directly
    // Map it to the format expected by tests (with just traceId and spanId)
    const parentSpanContext = span.parentSpanContext
      ? {
          traceId: span.parentSpanContext.traceId,
          spanId: span.parentSpanContext.spanId
        }
      : {
          traceId: undefined,
          spanId: undefined
        }

    return {
      traceId: span.spanContext().traceId,
      parentSpanContext,
      traceState: span.spanContext().traceState?.serialize(),
      name: span.name,
      id: span.spanContext().spanId,
      kind: span.kind,
      timestamp: hrTimeToMicroseconds(span.startTime),
      duration: hrTimeToMicroseconds(span.duration),
      attributes: span.attributes,
      status: span.status,
      events: span.events,
      links: span.links,
      resource,
      // instrumentationLibrary is deprecated in otel 2.0, we need to use instrumentationScope
      instrumentationScope: span.instrumentationLibrary || span.instrumentationScope
    }
  }
}
