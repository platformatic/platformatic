'use strict'

const path = require('node:path')
const { hostname } = require('node:os')
const pino = require('pino')
const { createRequire } = require('./modules')

// Utilities to build pino options from a config object
// There are many variants to fit better the different use cases

function setPinoFormatters(options) {
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

function buildPinoFormatters(formatters) {
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

function setPinoTimestamp(options) {
  options.timestamp = stdTimeFunctions[options.timestamp]
}

function buildPinoTimestamp(timestamp) {
  return stdTimeFunctions[timestamp]
}

function buildPinoOptions(loggerConfig, serverConfig, serviceId, workerId, serviceOptions, root) {
  const pinoOptions = {
    level: loggerConfig?.level ?? serverConfig?.level ?? 'trace'
  }

  if (serviceId) {
    pinoOptions.name = serviceId
  }

  if (typeof serviceOptions.context.worker?.index !== 'undefined') {
    pinoOptions.base = { pid: process.pid, hostname: hostname(), worker: workerId }
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

  return pinoOptions
}

function loadFormatters(require, file) {
  try {
    // Check if the file is a valid path
    const resolvedPath = require.resolve(file)

    // Load the module
    return require(resolvedPath)
  } catch (error) {
    throw new Error(`Failed to load function from ${file}: ${error.message}`)
  }
}

const stdTimeFunctions = {
  epochTime: pino.stdTimeFunctions.epochTime,
  unixTime: pino.stdTimeFunctions.unixTime,
  nullTime: pino.stdTimeFunctions.nullTime,
  isoTime: pino.stdTimeFunctions.isoTime
}

module.exports = {
  buildPinoOptions,
  loadFormatters,
  setPinoFormatters,
  setPinoTimestamp,
  buildPinoFormatters,
  buildPinoTimestamp
}
