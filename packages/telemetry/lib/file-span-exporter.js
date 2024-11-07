const {
  ExportResultCode,
  hrTimeToMicroseconds,
} = require('@opentelemetry/core')
const { accessSync, constants, appendFileSync } = require('node:fs')
const { dirname } = require('node:path')

// Export spans to a file, mostly for testing purposes.
// It just check that the path is writable and then appends the spans to the file as ndjson.
class FileSpanExporter {
  #path
  constructor (opts) {
    if (!opts.path) {
      throw new Error('FileSpanExporter requires a path')
    }
    accessSync(dirname(opts.path), constants.R_OK | constants.W_OK)
    this.#path = opts.path
  }

  export (spans, resultCallback) {
    for (const span of spans) {
      appendFileSync(this.#path, JSON.stringify(this.#exportInfo(span)) + '\n')
    }
    resultCallback(ExportResultCode.SUCCESS)
  }

  shutdown () {
    this._sendSpans([])
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
    }
  }
}

module.exports = FileSpanExporter
