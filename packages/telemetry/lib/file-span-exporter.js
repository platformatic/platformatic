'use strict'

const {
  ExportResultCode,
  hrTimeToMicroseconds,
} = require('@opentelemetry/core')
const path = require('node:path')
const { appendFileSync } = require('node:fs')

// Export spans to a file, mostly for testing purposes.
class FileSpanExporter {
  #path
  constructor (opts) {
    if (!opts.path) {
      this.#path = path.resolve('spans.log')
    } else {
      this.#path = opts.path
    }
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
      parentId: span.parentSpanId,
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
      instrumentationLibrary: span.instrumentationLibrary,
    }
  }
}

module.exports = FileSpanExporter
