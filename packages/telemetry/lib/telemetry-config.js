'use strict'

const {
  ConsoleSpanExporter,
  BatchSpanProcessor,
  SimpleSpanProcessor,
  InMemorySpanExporter,
} = require('@opentelemetry/sdk-trace-base')
const {
  SemanticResourceAttributes,
} = require('@opentelemetry/semantic-conventions')
const { Resource } = require('@opentelemetry/resources')
const { PlatformaticTracerProvider } = require('./platformatic-trace-provider')

const { name: moduleName, version: moduleVersion } = require('../package.json')

const setupTelemetry = (opts, logger) => {
  const { serviceName, version } = opts
  let exporter = opts.exporter
  if (!exporter) {
    logger.warn('No exporter configured, defaulting to console.')
    exporter = { type: 'console' }
  }

  const exporters = Array.isArray(exporter) ? exporter : [exporter]

  logger.debug(
    `Setting up platforamtic telemetry for service: ${serviceName}${version ? ' version: ' + version : ''} with exporter of type ${exporter.type}`
  )

  const provider = new PlatformaticTracerProvider({
    resource: new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: serviceName,
      [SemanticResourceAttributes.SERVICE_VERSION]: version,
    }),
  })

  const exporterObjs = []
  const spanProcessors = []
  for (const exporter of exporters) {
    // Exporter config:
    // https://open-telemetry.github.io/opentelemetry-js/interfaces/_opentelemetry_exporter_zipkin.ExporterConfig.html
    const exporterOptions = { ...exporter.options, serviceName }

    let exporterObj
    if (exporter.type === 'console') {
      exporterObj = new ConsoleSpanExporter(exporterOptions)
    } else if (exporter.type === 'otlp') {
      // We require here because this require (and only the require!) creates some issue with c8 on some mjs tests on other modules. Since we need an assignemet here, we don't use a switch.
      const {
        OTLPTraceExporter,
      } = require('@opentelemetry/exporter-trace-otlp-proto')
      exporterObj = new OTLPTraceExporter(exporterOptions)
    } else if (exporter.type === 'zipkin') {
      const { ZipkinExporter } = require('@opentelemetry/exporter-zipkin')
      exporterObj = new ZipkinExporter(exporterOptions)
    } else if (exporter.type === 'memory') {
      exporterObj = new InMemorySpanExporter()
    } else {
      logger.warn(
        `Unknown exporter type: ${exporter.type}, defaulting to console.`
      )
      exporterObj = new ConsoleSpanExporter(exporterOptions)
    }

    // We use a SimpleSpanProcessor for the console/memory exporters and a BatchSpanProcessor for the others.
    const spanProcessor = ['memory', 'console'].includes(exporter.type)
      ? new SimpleSpanProcessor(exporterObj)
      : new BatchSpanProcessor(exporterObj)
    spanProcessors.push(spanProcessor)
    exporterObjs.push(exporterObj)
  }

  provider.addSpanProcessor(spanProcessors)
  const tracer = provider.getTracer(moduleName, moduleVersion)
  const propagator = provider.getPropagator()

  return { tracer, exporters: exporterObjs, propagator, provider, spanProcessors }
}

module.exports = setupTelemetry
