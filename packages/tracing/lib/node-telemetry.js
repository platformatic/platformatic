import { registerInstrumentations } from '@opentelemetry/instrumentation'
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http'
import { UndiciInstrumentation } from '@opentelemetry/instrumentation-undici'
import { resourceFromAttributes } from '@opentelemetry/resources'
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions'
import { getLogger, updateGlobals } from '@platformatic/globals'
import { LightMyRequestInstrumentation } from '@platformatic/instrumentation-light-my-request'
import { AsyncLocalStorage } from 'node:async_hooks'
import { readFileSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { setupDiagLogger } from './diag-logger.js'
import { resolve } from 'node:path'
import process from 'node:process'
import util from 'node:util'
import { workerData } from 'node:worker_threads'
import { getInstrumentations } from './pluggable-instrumentations.js'
import { getExternalTracerProvider, registerPropagation, registerTracerProvider } from './provider.js'
import { getSampler } from './samplers.js'
import { getSpanProcessors } from './span-processors.js'

const debuglog = util.debuglog('@platformatic/tracing')

// See: https://www.npmjs.com/package/@opentelemetry/instrumentation-http
// When this is fixed we should set this to 'http' and fix the tests
// https://github.com/open-telemetry/opentelemetry-js/issues/5103
process.env.OTEL_SEMCONV_STABILITY_OPT_IN = 'http/dup'

// A provider registered before this module is loaded (by an OpenTelemetry SDK set up by the user or by an
// observability product) owns the telemetry pipeline. In that case Platformatic only contributes its own
// instrumentations and never registers a provider, a propagator or a context manager.
const externalTracerProvider = getExternalTracerProvider()

// The propagator and the context manager must be registered EARLY, before any HTTP operation occurs and
// before any instrumentation is enabled, otherwise the trace context is not propagated.
if (!externalTracerProvider) {
  registerPropagation()
}

// This instrumentation only uses the OpenTelemetry API, so it works with whatever provider is (or will be)
// registered. It is registered synchronously because it must patch light-my-request before it is loaded.
registerInstrumentations({ instrumentations: [new LightMyRequestInstrumentation()] })

// The calls between applications are traced by the thread interceptor hooks. Since it publishes
// the undici diagnostics events too, the undici instrumentation would create a second client span.
function isInternalMeshRequest (request) {
  return typeof request.origin === 'string' && request.origin.endsWith('.plt.local')
}

const setupNodeHTTPTelemetry = async (opts, applicationDir, usesPlatformaticDispatcher) => {
  setupDiagLogger(opts)

  const { applicationName, instrumentations = [] } = opts
  const additionalInstrumentations = await getInstrumentations(instrumentations, applicationDir)

  if (externalTracerProvider) {
    // This is the expected setup when an observability product is in use, so it must not be reported on
    // the standard error, which the runtime logs as an error.
    const message =
      'An OpenTelemetry TracerProvider is already registered, the exporters configured in the Platformatic tracing are ignored.'
    const logger = getLogger({ throwOnMissing: false })
    if (opts.exporter && logger) {
      logger.warn(message)
    } else {
      debuglog(message)
    }

    // The HTTP and undici instrumentations are left to the owner of the provider: registering them here
    // as well would duplicate every span. The ones explicitly listed in the configuration are honored.
    updateGlobals({ tracerProvider: externalTracerProvider })
    registerInstrumentations({ instrumentations: additionalInstrumentations })
    return
  }

  const { spanProcessors } = getSpanProcessors(opts)
  // The node capability builds its own provider, so the sampler has to be
  // applied here too or the option would only work for the other capabilities.
  const sampler = await getSampler({ ...opts, applicationDir })

  const clientSpansAls = new AsyncLocalStorage()

  const { provider: tracerProvider } = registerTracerProvider({
    spanProcessors, // https://github.com/open-telemetry/opentelemetry-js/issues/4881#issuecomment-2358059714
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: applicationName
    }),
    ...(sampler ? { sampler } : {})
  })
  updateGlobals({ clientSpansAls, tracerProvider })

  // Register instrumentations with our TracerProvider
  const defaultInstrumentations = [new HttpInstrumentation(), ...additionalInstrumentations]
  if (!usesPlatformaticDispatcher) {
    defaultInstrumentations.unshift(
      new UndiciInstrumentation({
        ignoreRequestHook: isInternalMeshRequest,
        responseHook: span => {
          const store = clientSpansAls.getStore()
          if (store) {
            store.span = span
          }
        }
      })
    )
  }

  registerInstrumentations({
    tracerProvider,
    instrumentations: defaultInstrumentations
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
const { promise: tracingReadyPromise, resolve: resolveTracingReady } = Promise.withResolvers()
updateGlobals({ tracingReady: tracingReadyPromise })

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
    const tracingConfig = useWorkerData ? data?.applicationConfig?.tracing : data?.tracingConfig
    if (tracingConfig) {
      debuglog('tracingConfig %o', tracingConfig)
      await setupNodeHTTPTelemetry(tracingConfig, applicationDir, data.applicationConfig?.type === '@platformatic/next')
      resolveTracingReady()
    } else {
      resolveTracingReady()
    }
  } else {
    resolveTracingReady()
  }
}

main().catch(e => {
  debuglog('Error in main %o', e)
  // Always resolve the promise even on error to prevent hanging
  resolveTracingReady()
})
