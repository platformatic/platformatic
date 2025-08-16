'use strict'

const { emptyResource } = require('@opentelemetry/resources')
const { merge, CompositePropagator, W3CTraceContextPropagator } = require('@opentelemetry/core')
const { AlwaysOnSampler } = require('@opentelemetry/sdk-trace-base')
// We need to import the Tracer to write our own TracerProvider that does NOT extend the OpenTelemetry one.
const { Tracer } = require('@opentelemetry/sdk-trace-base/build/src/Tracer')
const { MultiSpanProcessor } = require('./multispan-processor')

class PlatformaticTracerProvider {
  activeSpanProcessor = null
  _registeredSpanProcessors = []
  // This MUST be called `resource`, see: https://github.com/open-telemetry/opentelemetry-js/blob/main/packages/opentelemetry-sdk-trace-base/src/Tracer.ts#L57
  resource = null
  _config = null

  constructor (config = {}) {
    const mergedConfig = merge(
      {},
      {
        sampler: new AlwaysOnSampler(),
      },
      config
    )
    this.resource = mergedConfig.resource ?? emptyResource
    this._config = Object.assign({}, mergedConfig, {
      resource: this.resource,
    })
  }

  // This is the only mandatory API: https://github.com/open-telemetry/opentelemetry-specification/blob/main/specification/trace/api.md#get-a-tracer
  getTracer (name, version) {
    return new Tracer({ name, version }, this._config, this.resource, this.activeSpanProcessor)
  }

  addSpanProcessor (spanProcessor) {
    if (Array.isArray(spanProcessor)) {
      this._registeredSpanProcessors.push(...spanProcessor)
    } else {
      this._registeredSpanProcessors.push(spanProcessor)
    }
    this.activeSpanProcessor = new MultiSpanProcessor(
      this._registeredSpanProcessors
    )
  }

  getActiveSpanProcessor () {
    return this.activeSpanProcessor
  }

  getPropagator () {
    return new CompositePropagator({
      propagators: [
        new W3CTraceContextPropagator(), // see: https://www.w3.org/TR/trace-context/
      ],
    })
  }

  forceFlush () {
    // Let's do a fire-and-forget of forceFlush on all the processor for the time being.
    this._registeredSpanProcessors.forEach(spanProcessor => spanProcessor.forceFlush())
  }

  shutdown () {
    return this.activeSpanProcessor.shutdown()
  }
}

module.exports = { PlatformaticTracerProvider }
