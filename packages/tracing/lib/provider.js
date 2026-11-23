import { context, propagation, ProxyTracerProvider, trace } from '@opentelemetry/api'
import { AsyncLocalStorageContextManager } from '@opentelemetry/context-async-hooks'
import { W3CTraceContextPropagator } from '@opentelemetry/core'
import { TracerProvider } from '@opentelemetry/sdk-trace'

// The proxy returns this singleton until a real provider is registered.
const noopTracerProvider = new ProxyTracerProvider().getDelegate()

/**
 * Returns the TracerProvider registered by another party (an OpenTelemetry SDK set up by the user or an
 * observability product), or null when none is registered.
 *
 * The global provider is always a proxy, so its delegate is what tells whether a real provider exists.
 */
export function getExternalTracerProvider () {
  const provider = trace.getTracerProvider()
  const delegate = typeof provider.getDelegate === 'function' ? provider.getDelegate() : provider

  return delegate === noopTracerProvider ? null : delegate
}

/**
 * Registers the global propagator and context manager, unless another party already did.
 * Returns a function that removes only what this call registered.
 */
export function registerPropagation () {
  const hasPropagator = propagation.setGlobalPropagator(new W3CTraceContextPropagator())

  const contextManager = new AsyncLocalStorageContextManager()
  contextManager.enable()
  const hasContextManager = context.setGlobalContextManager(contextManager)
  if (!hasContextManager) {
    contextManager.disable()
  }

  return function unregisterPropagation () {
    if (hasPropagator) {
      propagation.disable()
    }

    if (hasContextManager) {
      context.disable()
    }
  }
}

/**
 * Creates the Platformatic TracerProvider and registers it globally, so that every instrumentation and the
 * application code obtain their tracers through the OpenTelemetry API rather than through a private provider.
 *
 * This must only be called when getExternalTracerProvider() returns null.
 */
export function registerTracerProvider (options) {
  const provider = new TracerProvider(options)
  const isRegistered = trace.setGlobalTracerProvider(provider)

  function unregisterTracerProvider () {
    // Somebody else might have replaced the provider in the meanwhile, leave it alone in that case.
    if (isRegistered && getExternalTracerProvider() === provider) {
      trace.disable()
    }
  }

  return { provider, unregisterTracerProvider }
}
