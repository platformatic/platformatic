'use strict'

const { createContextKey } = require('@opentelemetry/api')

// Unfortunately, these kesy are not exported by the OpenTelemetry API :()
// And we HAVE to use these keys because are used by the propagators
const SPAN_KEY = createContextKey('OpenTelemetry Context Key SPAN')

// This is basicaklly the same as https://github.com/open-telemetry/opentelemetry-js/blob/main/api/src/context/context.ts#L85
// (so just a wrapper around a Map)
// Note that mutating the context is not allowed by the OpenTelemetry spec.
class PlatformaticContext {
  _currentContext

  constructor (parentContext) {
    this._currentContext = parentContext ? new Map(parentContext) : new Map()

    this.getValue = (key) => this._currentContext.get(key)

    // Must create and return a new context
    this.setValue = (key, value) => {
      const context = new PlatformaticContext(this._currentContext)
      context._currentContext.set(key, value)
      return context
    }

    // Must return a new context
    /* istanbul ignore next */
    this.deleteValue = (key) => {
      const context = new PlatformaticContext(this._currentContext)
      context._currentContext.delete(key)
      return context
    }

    this.setSpan = (span) => {
      return this.setValue(SPAN_KEY, span)
    }
  }
}

module.exports = { PlatformaticContext }
