import {
  BatchSpanProcessor,
  ConsoleSpanExporter,
  InMemorySpanExporter,
  SimpleSpanProcessor
} from '@opentelemetry/sdk-trace-base'
import { abstractLogger } from '@platformatic/foundation'
import { createRequire } from 'node:module'
import { FileSpanExporter } from './file-span-exporter.js'

const require = createRequire(import.meta.url)

export function getSpanProcessors (opts = {}, logger = abstractLogger) {
  const { applicationName, version } = opts

  // Set up exporters
  let exporter = opts.exporter
  if (!exporter) {
    logger.warn?.('No exporter configured, defaulting to console.')
    exporter = { type: 'console' }
  }

  const exporters = Array.isArray(exporter) ? exporter : [exporter]

  logger.debug?.(
    `Setting up platformatic telemetry for application: ${applicationName}${version ? ' version: ' + version : ''} with exporter of type ${exporter.type}`
  )

  const exporterObjs = []
  const spanProcessors = []
  for (const exp of exporters) {
    const exporterOptions = { ...exp.options, applicationName }

    let exporterObj
    if (exp.type === 'console') {
      exporterObj = new ConsoleSpanExporter(exporterOptions)
    } else if (exp.type === 'otlp') {
      const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-proto')
      exporterObj = new OTLPTraceExporter(exporterOptions)
    } else if (exp.type === 'zipkin') {
      const { ZipkinExporter } = require('@opentelemetry/exporter-zipkin')
      exporterObj = new ZipkinExporter(exporterOptions)
    } else if (exp.type === 'memory') {
      exporterObj = new InMemorySpanExporter()
    } else if (exp.type === 'file') {
      exporterObj = new FileSpanExporter(exporterOptions)
    } else {
      logger.warn?.(`Unknown exporter type: ${exp.type}, defaulting to console.`)
      exporterObj = new ConsoleSpanExporter(exporterOptions)
    }
    exporterObjs.push(exporterObj)

    let spanProcessor
    // We use a SimpleSpanProcessor for the console/memory exporters and a BatchSpanProcessor for the others.
    // unless "processor" is set to "simple" (used only in tests)
    if (exp.processor === 'simple' || ['memory', 'console', 'file'].includes(exp.type)) {
      spanProcessor = new SimpleSpanProcessor(exporterObj)
    } else {
      spanProcessor = new BatchSpanProcessor(exporterObj)
    }
    spanProcessors.push(spanProcessor)
  }

  return { exporters: exporterObjs, spanProcessors }
}
