import { diag, DiagLogLevel } from '@opentelemetry/api'
import { getLogger } from '@platformatic/globals'
import util from 'node:util'

const pinoToDiagLogLevels = {
  silent: DiagLogLevel.NONE,
  fatal: DiagLogLevel.ERROR,
  error: DiagLogLevel.ERROR,
  warn: DiagLogLevel.WARN,
  info: DiagLogLevel.INFO,
  debug: DiagLogLevel.DEBUG,
  trace: DiagLogLevel.VERBOSE
}

function getDiagLogLevel (logger) {
  const logLevel = logger?.level

  if (typeof logLevel === 'string') {
    return pinoToDiagLogLevels[logLevel] ?? DiagLogLevel.INFO
  }

  return DiagLogLevel.INFO
}

function isObjectLike (value) {
  return value !== null && typeof value === 'object'
}

function serializeCustomInspectPayload (value) {
  const customInspect = value[util.inspect.custom]

  if (typeof customInspect !== 'function') {
    return value
  }

  try {
    return customInspect.call(value)
  } catch {
    return value
  }
}

function serializeForDiag (value, seen = new WeakSet()) {
  if (!isObjectLike(value)) {
    return value
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
      ...Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, serializeForDiag(entry, seen)]))
    }
  }

  if (seen.has(value)) {
    return '[Circular]'
  }

  seen.add(value)

  try {
    const inspected = serializeCustomInspectPayload(value)
    if (inspected !== value) {
      return serializeForDiag(inspected, seen)
    }

    if (typeof value.toJSON === 'function') {
      const json = value.toJSON()
      if (json !== value) {
        return serializeForDiag(json, seen)
      }
    }

    if (Array.isArray(value)) {
      return value.map(entry => serializeForDiag(entry, seen))
    }

    if (value instanceof Map) {
      return Object.fromEntries(Array.from(value.entries(), ([key, entry]) => [String(key), serializeForDiag(entry, seen)]))
    }

    if (value instanceof Set) {
      return Array.from(value, entry => serializeForDiag(entry, seen))
    }

    return Object.fromEntries(
      Object.entries(value)
        .filter(([key, entry]) => !key.startsWith('_') && typeof entry !== 'function')
        .map(([key, entry]) => [key, serializeForDiag(entry, seen)])
    )
  } finally {
    seen.delete(value)
  }
}

function callLogger (logger, method, fallback, args) {
  if (typeof logger?.[method] === 'function') {
    if (typeof args[0] === 'string') {
      const [message, ...details] = args
      if (details.length === 0) {
        logger[method](message)
      } else if (details.some(isObjectLike)) {
        logger[method]({ details: details.map(detail => serializeForDiag(detail)) }, message)
      } else {
        logger[method](util.format(...args))
      }
    } else {
      logger[method](...args)
    }

    return
  }

  fallback(...args)
}

export function createPlatformaticDiagLogger (logger) {
  logger ??= getLogger({ throwOnMissing: false })
  let target = logger

  if (typeof target?.child === 'function') {
    try {
      target = target.child({ name: '@platformatic/telemetry/diag' })
    } catch {
      // Ignore child logger creation failures and use the parent logger.
    }
  }

  return {
    error: (...args) => callLogger(target, 'error', console.error.bind(console), args),
    warn: (...args) => callLogger(target, 'warn', console.warn.bind(console), args),
    info: (...args) => callLogger(target, 'info', console.info.bind(console), args),
    debug: (...args) => callLogger(target, 'debug', console.debug.bind(console), args),
    verbose: (...args) => callLogger(target, 'trace', console.debug.bind(console), args)
  }
}

export function setupDiagLogger (opts, logger) {
  logger ??= getLogger({ throwOnMissing: false })
  if (opts?.diagLogger !== true) {
    return false
  }

  return diag.setLogger(createPlatformaticDiagLogger(logger), {
    logLevel: getDiagLogLevel(logger),
    suppressOverrideMessage: true
  })
}
