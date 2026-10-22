import { createNoopMeter } from '@opentelemetry/api'
import { CompositePropagator, merge, W3CTraceContextPropagator } from '@opentelemetry/core'
import { emptyResource } from '@opentelemetry/resources'
import { AlwaysOnSampler, RandomIdGenerator } from '@opentelemetry/sdk-trace'
import { createRequire } from 'node:module'
import { MultiSpanProcessor } from './multispan-processor.js'

const require = createRequire(import.meta.url)
// We need to import the Tracer to write our own TracerProvider that does NOT extend the OpenTelemetry one.
const { Tracer } = require('@opentelemetry/sdk-trace/build/src/Tracer')

const noopMeterProvider = {
  getMeter () {
    return createNoopMeter()
  }
}

export class PlatformaticTracerProvider {
  activeSpanProcessor = null
  _registeredSpanProcessors = []
  resource = null
  _config = null

  constructor (config = {}) {
    const mergedConfig = merge(
      {},
      {
        sampler: new AlwaysOnSampler(),
        spanLimits: {
          attributeCountLimit: 128,
          attributeValueLengthLimit: Infinity,
          eventCountLimit: 128,
          linkCountLimit: 128,
          attributePerEventCountLimit: 128,
          attributePerLinkCountLimit: 128
        },
        idGenerator: new RandomIdGenerator(),
        meterProvider: noopMeterProvider
      },
      config
    )
    this.resource = mergedConfig.resource ?? emptyResource
    this._config = Object.assign({}, mergedConfig, {
      resource: this.resource
    })
  }

  // This is the only mandatory API: https://github.com/open-telemetry/opentelemetry-specification/blob/main/specification/trace/api.md#get-a-tracer
  getTracer (name, version) {
    return new Tracer({ name, version }, { ...this._config, spanProcessor: this.activeSpanProcessor })
  }

  addSpanProcessor (spanProcessor) {
    if (Array.isArray(spanProcessor)) {
      this._registeredSpanProcessors.push(...spanProcessor)
    } else {
      this._registeredSpanProcessors.push(spanProcessor)
    }
    this.activeSpanProcessor = new MultiSpanProcessor(this._registeredSpanProcessors)
  }

  getActiveSpanProcessor () {
    return this.activeSpanProcessor
  }

  getPropagator () {
    return new CompositePropagator({
      propagators: [
        new W3CTraceContextPropagator() // see: https://www.w3.org/TR/trace-context/
      ]
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
