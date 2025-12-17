console.error('[node-telemetry] TOP OF FILE')

import { context } from '@opentelemetry/api'
import { AsyncLocalStorageContextManager } from '@opentelemetry/context-async-hooks'
import { FastifyOtelInstrumentation } from '@fastify/otel'
import { registerInstrumentations } from '@opentelemetry/instrumentation'
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http'
import { UndiciInstrumentation } from '@opentelemetry/instrumentation-undici'
import { LightMyRequestInstrumentation } from '@platformatic/instrumentation-light-my-request'
import { resourceFromAttributes } from '@opentelemetry/resources'
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node'
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

// Write marker file to verify module loads
try {
  const fs = require('node:fs')
  const path = require('node:path')
  const os = require('node:os')
  const worker_threads = require('node:worker_threads')
  const marker = path.join(os.tmpdir(), `node-telemetry-${process.pid}.txt`)
  fs.writeFileSync(marker, `Loaded ${new Date().toISOString()} thread=${worker_threads.threadId}\n`)
  console.error('[node-telemetry] Wrote marker to:', marker)
} catch (e) {
  console.error('[node-telemetry] Failed to write marker:', e.message)
}

const setupNodeHTTPTelemetry = async (opts, applicationDir, applicationId) => {
  const worker_threads = require('node:worker_threads')
  const fs = require('node:fs')
  const path = require('node:path')
  const os = require('node:os')
  const logFile = path.join(os.tmpdir(), `telemetry-setup-${process.pid}-${worker_threads.threadId}.log`)
  fs.appendFileSync(logFile, `[${new Date().toISOString()}] setupNodeHTTPTelemetry called for ${opts.applicationName}\n`)

  const { applicationName, instrumentations = [] } = opts
  const additionalInstrumentations = await getInstrumentations(instrumentations, applicationDir)

  // Construct service name from runtime applicationName and service applicationId
  let serviceName = applicationName
  if (applicationId && !applicationName.endsWith(`-${applicationId}`)) {
    serviceName = `${applicationName}-${applicationId}`
  }

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
    const exporterOptions = { ...exporter.options, applicationName: serviceName }

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

  // Create TracerProvider with resource and span processors
  const resource = resourceFromAttributes({
    [ATTR_SERVICE_NAME]: serviceName
  })

  const tracerProvider = new NodeTracerProvider({
    resource,
    spanProcessors  // Pass span processors to constructor
  })

  // Set up global context manager for async context propagation
  // Context manager MUST be global for instrumentations to work
  const contextManager = new AsyncLocalStorageContextManager()
  contextManager.enable()
  context.setGlobalContextManager(contextManager)

  // Check if http module is already loaded
  fs.appendFileSync(logFile, `[${new Date().toISOString()}] http module loaded: ${!!require.cache[require.resolve('node:http')]}\n`)
  fs.appendFileSync(logFile, `[${new Date().toISOString()}] https module loaded: ${!!require.cache[require.resolve('node:https')]}\n`)

  // Create instrumentations and manually set tracer provider
  // This avoids using NodeSDK or registerInstrumentations which set globals
  const undiciInstrumentation = new UndiciInstrumentation({
    responseHook: (span, { response }) => {
      // Store span for clientSpansAls
      const store = clientSpansAls.getStore()
      if (store) {
        store.span = span
      }

      // Add HTTP cache attributes
      if (response?.headers) {
        const httpCacheId = response.headers['x-plt-http-cache-id']
        const isCacheHit = response.headers.age !== undefined
        if (httpCacheId) {
          span.setAttributes({
            'http.cache.id': httpCacheId,
            'http.cache.hit': isCacheHit.toString()
          })
        }
      }
    }
  })

  const httpInstrumentation = new HttpInstrumentation()
  const fastifyInstrumentation = new FastifyOtelInstrumentation({ registerOnInitialization: true })
  const lmrInstrumentation = new LightMyRequestInstrumentation()

  const allInstrumentations = [
    undiciInstrumentation,
    httpInstrumentation,
    fastifyInstrumentation,
    lmrInstrumentation,
    ...additionalInstrumentations
  ]

  // Set our TracerProvider on each instrumentation and enable it
  fs.appendFileSync(logFile, `[${new Date().toISOString()}] Setting TracerProvider and enabling ${allInstrumentations.length} instrumentations\n`)
  for (const instrumentation of allInstrumentations) {
    instrumentation.setTracerProvider(tracerProvider)
    instrumentation.enable()
    fs.appendFileSync(logFile, `[${new Date().toISOString()}]   - ${instrumentation.instrumentationName || instrumentation.constructor.name}\n`)
  }

  // Store our isolated provider for access by other parts of the system
  globalThis.platformatic.tracerProvider = tracerProvider
  globalThis.platformatic.contextManager = contextManager

  process.on('SIGTERM', async () => {
    try {
      await tracerProvider.shutdown()
      contextManager.disable()
      debuglog('Tracing terminated')
    } catch (error) {
      debuglog('Error terminating tracing', error)
    }
  })
}

// Create a promise that will be resolved when telemetry is initialized
// This allows other parts of the system to wait for telemetry to be ready
globalThis.platformatic = globalThis.platformatic || {}
const { promise: telemetryReadyPromise, resolve: resolveTelemetryReady } = Promise.withResolvers()
globalThis.platformatic.telemetryReady = telemetryReadyPromise

async function main () {
  console.error('[node-telemetry] Loading in process:', process.pid, 'isWorker:', !!workerData, 'threadId:', require('node:worker_threads').threadId)

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
    const applicationId = data.applicationConfig?.id
    const telemetryConfig = useWorkerData ? data?.applicationConfig?.telemetry : data?.telemetryConfig
    if (telemetryConfig) {
      debuglog('telemetryConfig %o', telemetryConfig)
      await setupNodeHTTPTelemetry(telemetryConfig, applicationDir, applicationId)
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
