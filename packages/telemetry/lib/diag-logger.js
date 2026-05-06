import { diag, DiagLogLevel } from '@opentelemetry/api'
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

function callLogger (logger, method, fallback, args) {
  if (typeof logger?.[method] === 'function') {
    if (typeof args[0] === 'string') {
      logger[method](util.format(...args))
    } else {
      logger[method](...args)
    }

    return
  }

  fallback(...args)
}

export function createPlatformaticDiagLogger (logger = globalThis.platformatic?.logger) {
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

export function setupDiagLogger (opts, logger = globalThis.platformatic?.logger) {
  if (opts?.diagLogger !== true) {
    return false
  }

  return diag.setLogger(createPlatformaticDiagLogger(logger), {
    logLevel: getDiagLogLevel(logger),
    suppressOverrideMessage: true
  })
}
