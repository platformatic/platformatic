import { ROOT_CONTEXT, SpanKind, SpanStatusCode, context, propagation, trace } from '@opentelemetry/api'

let tracer = null
let telemetryInitialization = null

function createMessagingSpanName (type, application, messageName) {
  return `ITC ${type} ${application}.${messageName}`
}

function createMessagingAttributes ({ mode, sourceApplication, targetApplication, messageName }) {
  const attributes = {
    'messaging.system': 'platformatic-itc',
    'messaging.operation': mode,
    'messaging.message.name': messageName
  }

  if (targetApplication) {
    attributes['messaging.destination.name'] = targetApplication
    attributes['platformatic.messaging.target'] = targetApplication
  }

  if (sourceApplication) {
    attributes['platformatic.messaging.source'] = sourceApplication
  }

  return attributes
}

function createOutgoingMessagingMeta (mode, sourceApplication, targetApplication, telemetryMetadata) {
  if (!telemetryMetadata || Object.keys(telemetryMetadata).length === 0) {
    return null
  }

  return {
    mode,
    sourceApplication,
    targetApplication,
    telemetry: telemetryMetadata
  }
}

function setSpanError (span, error) {
  span.setAttributes({
    'error.name': error.name,
    'error.message': error.message,
    'error.stack': error.stack
  })

  span.setStatus({
    code: SpanStatusCode.ERROR,
    message: error.message
  })
}

function endSpan (span, error) {
  if (error) {
    setSpanError(span, error)
  } else {
    span.setStatus({ code: SpanStatusCode.OK })
  }

  span.end()
}

function getTracer () {
  if (tracer) {
    return tracer
  }

  const tracerProvider = globalThis.platformatic?.tracerProvider
  if (!tracerProvider) {
    return null
  }

  tracer = tracerProvider.getTracer('@platformatic/itc')
  return tracer
}

export function initializeITCTelemetry () {
  if (telemetryInitialization) {
    return telemetryInitialization
  }

  telemetryInitialization = Promise.resolve(globalThis.platformatic?.telemetryReady)
    .catch(() => {
      // Ignore telemetry initialization failures and fall back to untraced messaging.
    })
    .then(() => getTracer())

  return telemetryInitialization
}

function createNoopOutgoingTelemetry (mode, sourceApplication, targetApplication, telemetryMetadata) {
  const meta = createOutgoingMessagingMeta(mode, sourceApplication, targetApplication, telemetryMetadata)

  if (!meta) {
    return null
  }

  return {
    meta,
    run (callback) {
      return callback()
    },
    end () {}
  }
}

function getParentContext (telemetryContext, telemetryMetadata) {
  if (telemetryContext) {
    return telemetryContext
  }

  if (telemetryMetadata && Object.keys(telemetryMetadata).length > 0) {
    return propagation.extract(ROOT_CONTEXT, telemetryMetadata)
  }

  return context.active()
}

function createOutgoingMessagingSpan (tracer, mode, sourceApplication, targetApplication, messageName, options = {}) {
  const parentContext = getParentContext(options.telemetryContext, options.telemetryMetadata)
  const spanType = mode === 'notify' ? 'notify' : 'send'
  const spanKind = mode === 'notify' ? SpanKind.PRODUCER : SpanKind.CLIENT
  const span = tracer.startSpan(
    createMessagingSpanName(spanType, targetApplication, messageName),
    {
      kind: spanKind,
      attributes: createMessagingAttributes({
        mode,
        sourceApplication,
        targetApplication,
        messageName
      })
    },
    parentContext
  )

  const spanContext = trace.setSpan(parentContext, span)
  const telemetryMetadata = {}
  propagation.inject(spanContext, telemetryMetadata)

  return {
    meta: createOutgoingMessagingMeta(mode, sourceApplication, targetApplication, telemetryMetadata),
    run (callback) {
      return context.with(spanContext, callback)
    },
    end (error) {
      endSpan(span, error)
    }
  }
}

export function startOutgoingMessagingSpan (mode, sourceApplication, targetApplication, messageName, options = {}) {
  const activeTracer = getTracer()
  if (!activeTracer) {
    return createNoopOutgoingTelemetry(mode, sourceApplication, targetApplication, options.telemetryMetadata)
  }

  return createOutgoingMessagingSpan(activeTracer, mode, sourceApplication, targetApplication, messageName, options)
}

export function startOutgoingMessagingSpanSync (mode, sourceApplication, targetApplication, messageName, options = {}) {
  return startOutgoingMessagingSpan(mode, sourceApplication, targetApplication, messageName, options)
}

export function traceIncomingMessagingHandler (applicationId, messageName, handler, data, handlerContext = {}) {
  const activeTracer = getTracer()
  if (!activeTracer) {
    return handler(data, handlerContext)
  }

  const request = handlerContext.message ?? {}
  const metadata = request.meta ?? {}
  const mode = handlerContext.notification ? 'notify' : metadata.mode ?? 'send'
  const sourceApplication = metadata.sourceApplication
  const telemetryCarrier = metadata.telemetry ?? {}
  const parentContext = propagation.extract(ROOT_CONTEXT, telemetryCarrier)
  const spanType = handlerContext.notification ? 'consume' : 'handle'
  const spanKind = handlerContext.notification ? SpanKind.CONSUMER : SpanKind.SERVER
  const span = activeTracer.startSpan(
    createMessagingSpanName(spanType, sourceApplication ?? 'unknown', messageName),
    {
      kind: spanKind,
      attributes: createMessagingAttributes({
        mode,
        sourceApplication,
        targetApplication: applicationId,
        messageName
      })
    },
    parentContext
  )

  const spanContext = trace.setSpan(parentContext, span)
  let result

  try {
    result = context.with(spanContext, () => handler(data, handlerContext))
  } catch (error) {
    endSpan(span, error)
    throw error
  }

  if (result?.then) {
    return result.then(
      value => {
        endSpan(span)
        return value
      },
      error => {
        endSpan(span, error)
        throw error
      }
    )
  }

  endSpan(span)
  return result
}
