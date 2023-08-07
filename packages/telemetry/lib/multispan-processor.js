'use strict'

// This implements the SpanProcessor interface:
// https://github.com/open-telemetry/opentelemetry-js/blob/main/packages/opentelemetry-sdk-trace-base/src/SpanProcessor.ts
class MultiSpanProcessor {
  constructor (_spanProcessors = []) {
    this._spanProcessors = _spanProcessors
  }

  async forceFlush () {
    const promises = []
    for (const spanProcessor of this._spanProcessors) {
      promises.push(spanProcessor.forceFlush())
    }
    return Promise.all(promises)
  }

  onStart (span, context) {
    for (const spanProcessor of this._spanProcessors) {
      spanProcessor.onStart(span, context)
    }
  }

  onEnd (span) {
    for (const spanProcessor of this._spanProcessors) {
      spanProcessor.onEnd(span)
    }
  }

  async shutdown () {
    const promises = []
    for (const spanProcessor of this._spanProcessors) {
      promises.push(spanProcessor.shutdown())
    }
    return Promise.all(promises)
  }
}

module.exports = { MultiSpanProcessor }
