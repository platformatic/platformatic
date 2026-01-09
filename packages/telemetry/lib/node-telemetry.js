import { context, propagation } from '@opentelemetry/api'
import { AsyncLocalStorageContextManager } from '@opentelemetry/context-async-hooks'
import { registerInstrumentations } from '@opentelemetry/instrumentation'
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http'
import { UndiciInstrumentation } from '@opentelemetry/instrumentation-undici'
import { W3CTraceContextPropagator } from '@opentelemetry/core'
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node'
import { resourceFromAttributes } from '@opentelemetry/resources'
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions'
import { AsyncLocalStorage } from 'node:async_hooks'
import { readFileSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import process from 'node:process'
import util from 'node:util'
import { workerData } from 'node:worker_threads'
import { getInstrumentations } from './pluggable-instrumentations.js'
import { getSpanProcessors } from './span-processors.js'

const debuglog = util.debuglog('@platformatic/telemetry')

// See: https://www.npmjs.com/package/@opentelemetry/instrumentation-http
// When this is fixed we should set this to 'http' and fix the tests
// https://github.com/open-telemetry/opentelemetry-js/issues/5103
process.env.OTEL_SEMCONV_STABILITY_OPT_IN = 'http/dup'

// Set up global propagator EARLY for trace context propagation via HTTP headers
// This must be set before any HTTP operations occur
propagation.setGlobalPropagator(new W3CTraceContextPropagator())

// Set up global context manager for async context propagation
// Context manager MUST be global for instrumentations to work
const contextManager = new AsyncLocalStorageContextManager()
contextManager.enable()
context.setGlobalContextManager(contextManager)

const setupNodeHTTPTelemetry = async (opts, applicationDir) => {
  const { applicationName, instrumentations = [] } = opts
  const additionalInstrumentations = await getInstrumentations(instrumentations, applicationDir)

  const { spanProcessors } = getSpanProcessors(opts)

  const clientSpansAls = new AsyncLocalStorage()
  globalThis.platformatic = globalThis.platformatic || {}
  globalThis.platformatic.clientSpansAls = clientSpansAls

  const tracerProvider = new NodeTracerProvider({
    spanProcessors, // https://github.com/open-telemetry/opentelemetry-js/issues/4881#issuecomment-2358059714
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: applicationName
    })
  })
  globalThis.platformatic.tracerProvider = tracerProvider

  // Register instrumentations with our TracerProvider
  registerInstrumentations({
    tracerProvider,
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
    ]
  })

  process.on('SIGTERM', async () => {
    try {
      await tracerProvider.shutdown()
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
