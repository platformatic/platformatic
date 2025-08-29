import { createRequire } from 'node:module'
import { hostname } from 'node:os'
import path from 'node:path'
import pino from 'pino'

// Utilities to build pino options from a config object
// There are many variants to fit better the different use cases

export function setPinoFormatters (options) {
  const r = createRequire(path.dirname(options.formatters.path))
  const formatters = loadFormatters(r, options.formatters.path)
  if (formatters.bindings) {
    if (typeof formatters.bindings === 'function') {
      options.formatters.bindings = formatters.bindings
    } else {
      throw new Error('logger.formatters.bindings must be a function')
    }
  }
  if (formatters.level) {
    if (typeof formatters.level === 'function') {
      options.formatters.level = formatters.level
    } else {
      throw new Error('logger.formatters.level must be a function')
    }
  }
}

export function buildPinoFormatters (formatters) {
  const r = createRequire(path.dirname(formatters.path))
  const f = loadFormatters(r, formatters.path)
  const pinoFormatters = {}
  if (f.bindings) {
    if (typeof f.bindings === 'function') {
      pinoFormatters.bindings = f.bindings
    } else {
      throw new Error('logger.formatters.bindings must be a function')
    }
  }
  if (f.level) {
    if (typeof f.level === 'function') {
      pinoFormatters.level = f.level
    } else {
      throw new Error('logger.formatters.level must be a function')
    }
  }
  return pinoFormatters
}

export function setPinoTimestamp (options) {
  options.timestamp = stdTimeFunctions[options.timestamp]
}

export function buildPinoTimestamp (timestamp) {
  return stdTimeFunctions[timestamp]
}

export function buildPinoOptions (loggerConfig, serverConfig, applicationId, workerId, context, root) {
  const pinoOptions = {
    level: loggerConfig?.level ?? serverConfig?.level ?? 'trace'
  }

  if (applicationId) {
    pinoOptions.name = applicationId
  }

  if (loggerConfig?.base) {
    for (const [key, value] of Object.entries(loggerConfig.base)) {
      if (typeof value !== 'string') {
        throw new Error(`logger.base.${key} must be a string`)
      }
    }
    /* c8 ignore next - else */
  } else if (loggerConfig?.base === null) {
    pinoOptions.base = undefined
  }

  if (typeof context.worker?.index !== 'undefined' && loggerConfig?.base !== null) {
    pinoOptions.base = {
      ...(pinoOptions.base ?? {}),
      pid: process.pid,
      hostname: hostname(),
      worker: workerId
    }
  }

  if (loggerConfig?.formatters) {
    pinoOptions.formatters = {}
    const formatters = loadFormatters(createRequire(root), loggerConfig.formatters.path)
    if (formatters.bindings) {
      if (typeof formatters.bindings === 'function') {
        pinoOptions.formatters.bindings = formatters.bindings
      } else {
        throw new Error('logger.formatters.bindings must be a function')
      }
    }
    if (formatters.level) {
      if (typeof formatters.level === 'function') {
        pinoOptions.formatters.level = formatters.level
      } else {
        throw new Error('logger.formatters.level must be a function')
      }
    }
  }

  if (loggerConfig?.timestamp !== undefined) {
    pinoOptions.timestamp = stdTimeFunctions[loggerConfig.timestamp]
  }

  if (loggerConfig?.redact) {
    pinoOptions.redact = {
      paths: loggerConfig.redact.paths,
      censor: loggerConfig.redact.censor
    }
  }

  if (loggerConfig?.messageKey) {
    pinoOptions.messageKey = loggerConfig.messageKey
  }

  if (loggerConfig?.customLevels) {
    for (const [key, value] of Object.entries(loggerConfig.customLevels)) {
      if (typeof value !== 'number') {
        throw new Error(`logger.customLevels.${key} must be a number`)
      }
    }
    pinoOptions.customLevels = loggerConfig.customLevels
  }

  // This is used by standalone CLI like start-platformatic-node in @platformatic/node
  if (loggerConfig?.pretty) {
    pinoOptions.transport = { target: 'pino-pretty' }
  }

  return pinoOptions
}

export function loadFormatters (require, file) {
  try {
    // Check if the file is a valid path
    const resolvedPath = require.resolve(file)

    // Load the module
    const loaded = require(resolvedPath)

    return loaded?.default ?? loaded
  } catch (error) {
    throw new Error(`Failed to load function from ${file}: ${error.message}`)
  }
}

// This is needed so that pino detects a tampered stdout and avoid writing directly to the FD.
// Writing directly to the FD would bypass worker.stdout, which is currently piped in the parent process.
// See: https://github.com/pinojs/pino/blob/ad864b7ae02b314b9a548614f705a437e0db78c3/lib/tools.js#L330
export function disablePinoDirectWrite () {
  process.stdout.write = process.stdout.write.bind(process.stdout)
}

/* c8 ignore start - Nothing to test */
export function noop () {}

export const abstractLogger = {
  fatal: noop,
  error: noop,
  warn: noop,
  info: noop,
  debug: noop,
  trace: noop,
  done: noop,
  child () {
    return abstractLogger
  }
}
/* c8 ignore end */

export const stdTimeFunctions = {
  epochTime: pino.stdTimeFunctions.epochTime,
  unixTime: pino.stdTimeFunctions.unixTime,
  nullTime: pino.stdTimeFunctions.nullTime,
  isoTime: pino.stdTimeFunctions.isoTime
}
