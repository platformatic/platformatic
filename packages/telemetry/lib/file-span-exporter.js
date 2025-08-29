import { ExportResultCode, hrTimeToMicroseconds } from '@opentelemetry/core'
import { appendFileSync } from 'node:fs'
import { resolve as resolvePath } from 'node:path'
import { workerData } from 'node:worker_threads'

// Export spans to a file, mostly for testing purposes.
export class FileSpanExporter {
  #path
  constructor (opts) {
    this.#path = resolvePath(workerData?.dirname ?? process.cwd(), opts.path ?? 'spans.log')
  }

  export (spans, resultCallback) {
    for (const span of spans) {
      appendFileSync(this.#path, JSON.stringify(this.#exportInfo(span)) + '\n')
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
    return {
      traceId: span.spanContext().traceId,
      // parentId has been removed from otel 2.0, we need to get it from parentSpanContext
      parentSpanContext: {
        traceId: span.parentSpanContext?.traceId,
        spanId: span.parentSpanContext?.spanId
      },
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
      resource: span.resource,
      // instrumentationLibrary is deprecated in otel 2.0, we need to use instrumentationScope
      instrumentationScope: span.instrumentationLibrary || span.instrumentationScope
    }
  }
}
