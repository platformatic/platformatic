import { HttpInstrumentation } from '@opentelemetry/instrumentation-http'
import { UndiciInstrumentation } from '@opentelemetry/instrumentation-undici'
import { resourceFromAttributes } from '@opentelemetry/resources'
import * as opentelemetry from '@opentelemetry/sdk-node'
import {
  BatchSpanProcessor,
  ConsoleSpanExporter,
  InMemorySpanExporter,
  SimpleSpanProcessor
} from '@opentelemetry/sdk-trace-base'
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions'
import { abstractLogger } from '@platformatic/foundation'
import { AsyncLocalStorage } from 'node:async_hooks'
import { readFileSync, statSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import process from 'node:process'
import util from 'node:util'
import { workerData } from 'node:worker_threads'
import { FileSpanExporter } from './file-span-exporter.js'
import { getInstrumentations } from './pluggable-instrumentations.js'

const debuglog = util.debuglog('@platformatic/telemetry')
const require = createRequire(import.meta.url)

// See: https://www.npmjs.com/package/@opentelemetry/instrumentation-http
// When this is fixed we should set this to 'http' and fixe the tests
// https://github.com/open-telemetry/opentelemetry-js/issues/5103
process.env.OTEL_SEMCONV_STABILITY_OPT_IN = 'http/dup'

const setupNodeHTTPTelemetry = async (opts, applicationDir) => {
  const { applicationName, instrumentations = [] } = opts
  const additionalInstrumentations = await getInstrumentations(instrumentations, applicationDir)

  let exporter = opts.exporter
  if (!exporter) {
    abstractLogger.warn('No exporter configured, defaulting to console.')
    exporter = { type: 'console' }
  }
  const exporters = Array.isArray(exporter) ? exporter : [exporter]
  const spanProcessors = []
  for (const exporter of exporters) {
    // Exporter config:
    // https://open-telemetry.github.io/opentelemetry-js/interfaces/_opentelemetry_exporter_zipkin.ExporterConfig.html
    const exporterOptions = { ...exporter.options, applicationName }

    let exporterObj
    if (exporter.type === 'console') {
      exporterObj = new ConsoleSpanExporter(exporterOptions)
    } else if (exporter.type === 'otlp') {
      const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-proto')
      exporterObj = new OTLPTraceExporter(exporterOptions)
    } else if (exporter.type === 'zipkin') {
      const { ZipkinExporter } = require('@opentelemetry/exporter-zipkin')
      exporterObj = new ZipkinExporter(exporterOptions)
    } else if (exporter.type === 'memory') {
      exporterObj = new InMemorySpanExporter()
    } else if (exporter.type === 'file') {
      exporterObj = new FileSpanExporter(exporterOptions)
    } else {
      abstractLogger.warn(`Unknown exporter type: ${exporter.type}, defaulting to console.`)
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
        responseHook: span => {
          const store = clientSpansAls.getStore()
          if (store) {
            store.span = span
          }
        }
      }),
      new HttpInstrumentation(),
      ...additionalInstrumentations
    ],
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: applicationName
    })
  })
  sdk.start()

  process.on('SIGTERM', () => {
    sdk
      .shutdown()
      .then(() => debuglog('Tracing terminated'))
      .catch(error => debuglog('Error terminating tracing', error))
  })
}

// Create a promise that will be resolved when telemetry is initialized
// This allows other parts of the system to wait for telemetry to be ready
globalThis.platformatic = globalThis.platformatic || {}
const { promise: telemetryReadyPromise, resolve: resolveTelemetryReady } = Promise.withResolvers()
globalThis.platformatic.telemetryReady = telemetryReadyPromise

async function main () {
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
    const applicationDir = data.applicationConfig?.path
    const telemetryConfig = useWorkerData ? data?.applicationConfig?.telemetry : data?.telemetryConfig
    if (telemetryConfig) {
      debuglog('telemetryConfig %o', telemetryConfig)
      await setupNodeHTTPTelemetry(telemetryConfig, applicationDir)
      resolveTelemetryReady()
    } else {
      resolveTelemetryReady()
    }
  } else {
    resolveTelemetryReady()
  }
}

main().catch(e => {
  debuglog('Error in main %o', e)
  // Always resolve the promise even on error to prevent hanging
  resolveTelemetryReady()
})
