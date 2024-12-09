'use strict'

const process = require('node:process')
const { AsyncLocalStorage } = require('node:async_hooks')
const opentelemetry = require('@opentelemetry/sdk-node')
const { Resource } = require('@opentelemetry/resources')
const FileSpanExporter = require('./file-span-exporter')
const { ATTR_SERVICE_NAME } = require('@opentelemetry/semantic-conventions')
const { workerData } = require('node:worker_threads')
const { resolve } = require('node:path')
const { tmpdir } = require('node:os')
const logger = require('abstract-logging')
const { fileURLToPath } = require('node:url')
const { statSync, readFileSync } = require('node:fs') // We want to have all this synch
const util = require('node:util')

const ConfigManager = require('@platformatic/config')
const debuglog = util.debuglog('@platformatic/telemetry')
const {
  ConsoleSpanExporter,
  BatchSpanProcessor,
  SimpleSpanProcessor,
  InMemorySpanExporter,
} = require('@opentelemetry/sdk-trace-base')

const { HttpInstrumentation } = require('@opentelemetry/instrumentation-http')
const { UndiciInstrumentation } = require('@opentelemetry/instrumentation-undici')

// See: https://www.npmjs.com/package/@opentelemetry/instrumentation-http
// When this is fixed we should set this to 'http' and fixe the tests
// https://github.com/open-telemetry/opentelemetry-js/issues/5103
process.env.OTEL_SEMCONV_STABILITY_OPT_IN = 'http/dup'

// We need to specify the supported instrumentations.
// Currently, only `pg` is supported.
const resolveInstrumentation = (instrumentation) => {
  if (instrumentation === 'pg') {
    const { PgInstrumentation } = require('@opentelemetry/instrumentation-pg')
    return new PgInstrumentation()
  }
  return null
}

const setupNodeHTTPTelemetry = (opts, otelInstrumentations = []) => {
  const { serviceName } = opts

  const additionalInstrumentations = otelInstrumentations.map(resolveInstrumentation)

  let exporter = opts.exporter
  if (!exporter) {
    logger.warn('No exporter configured, defaulting to console.')
    exporter = { type: 'console' }
  }
  const exporters = Array.isArray(exporter) ? exporter : [exporter]
  const spanProcessors = []
  for (const exporter of exporters) {
    // Exporter config:
    // https://open-telemetry.github.io/opentelemetry-js/interfaces/_opentelemetry_exporter_zipkin.ExporterConfig.html
    const exporterOptions = { ...exporter.options, serviceName }

    let exporterObj
    if (exporter.type === 'console') {
      exporterObj = new ConsoleSpanExporter(exporterOptions)
    } else if (exporter.type === 'otlp') {
      const {
        OTLPTraceExporter,
      } = require('@opentelemetry/exporter-trace-otlp-proto')
      exporterObj = new OTLPTraceExporter(exporterOptions)
    } else if (exporter.type === 'zipkin') {
      const { ZipkinExporter } = require('@opentelemetry/exporter-zipkin')
      exporterObj = new ZipkinExporter(exporterOptions)
    } else if (exporter.type === 'memory') {
      exporterObj = new InMemorySpanExporter()
    } else if (exporter.type === 'file') {
      exporterObj = new FileSpanExporter(exporterOptions)
    } else {
      logger.warn(
        `Unknown exporter type: ${exporter.type}, defaulting to console.`
      )
      exporterObj = new ConsoleSpanExporter(exporterOptions)
    }

    let spanProcessor
    // We use a SimpleSpanProcessor for the console/memory exporters and a BatchSpanProcessor for the others.
    // , unless "processor" is set to "simple" (used only in tests)
    if (exporter.processor === 'simple' || ['memory', 'console', 'file'].includes(exporter.type)) {
      spanProcessor = new SimpleSpanProcessor(exporterObj)
    } else {
      spanProcessor = new BatchSpanProcessor(exporterObj)
    }
    spanProcessors.push(spanProcessor)
  }

  const clientSpansAls = new AsyncLocalStorage()
  globalThis.platformatic = globalThis.platformatic || {}
  globalThis.platformatic.clientSpansAls = clientSpansAls

  const sdk = new opentelemetry.NodeSDK({
    spanProcessors, // https://github.com/open-telemetry/opentelemetry-js/issues/4881#issuecomment-2358059714
    instrumentations: [
      new UndiciInstrumentation({
        responseHook: (span) => {
          const store = clientSpansAls.getStore()
          if (store) {
            store.span = span
          }
        }
      }),
      new HttpInstrumentation(),
      ...additionalInstrumentations
    ],
    resource: new Resource({
      [ATTR_SERVICE_NAME]: serviceName
    })
  })
  sdk.start()

  process.on('SIGTERM', () => {
    sdk.shutdown()
      .then(() => debuglog('Tracing terminated'))
      .catch((error) => debuglog('Error terminating tracing', error))
  })
}

const parseNodeConfigOTELIntrumentations = async (servicePath) => {
  if (!servicePath) {
    return []
  }

  const configFilename = await ConfigManager.findConfigFile(servicePath)
  if (!configFilename) {
    return []
  }
  const manager = new ConfigManager({ source: resolve(servicePath, configFilename) })
  await manager.parse()
  const config = manager.current

  if (config?.node?.otelInstrumentations) {
    return config.node.otelInstrumentations
  }
  return []
}

const main = async () => {
  let data = null
  const useWorkerData = !!workerData

  if (useWorkerData) {
    data = workerData
  } else if (process.env.PLT_MANAGER_ID) {
    try {
      const dataPath = resolve(tmpdir(), 'platformatic', 'runtimes', `${process.env.PLT_MANAGER_ID}.json`)
      statSync(dataPath)
      const jsonData = JSON.parse(readFileSync(dataPath, 'utf8'))
      data = jsonData.data
      debuglog(`Loaded data from ${dataPath}`)
    } catch (e) {
      debuglog('Error reading data from file %o', e)
    }
  }

  if (data) {
    debuglog('Setting up telemetry %o', data)
    const telemetryConfig = useWorkerData ? data?.serviceConfig?.telemetry : data?.telemetryConfig
    let servicePath = data?.serviceConfig?.path
    if (!servicePath && data?.root) {
      // when running commands, we don't have path :(
      servicePath = fileURLToPath(data?.root)
    }

    const otelInstrumentations = await parseNodeConfigOTELIntrumentations(servicePath)
    if (telemetryConfig) {
      debuglog('telemetryConfig %o', telemetryConfig)
      setupNodeHTTPTelemetry(telemetryConfig, otelInstrumentations)
    }
  }
}

try {
  main()
} catch (e) {
  debuglog('Error in telemetry setup %o', e)
}
