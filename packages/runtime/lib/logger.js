'use strict'

const { once } = require('node:events')
const { join } = require('node:path')
const { isatty } = require('node:tty')
const pino = require('pino')
const pretty = require('pino-pretty')
const { buildPinoFormatters, buildPinoTimestamp } = require('@platformatic/utils')

function noop () {}

const abstractLogger = {
  fatal: noop,
  error: noop,
  warn: noop,
  info: noop,
  debug: noop,
  trace: noop,
  child () {
    return abstractLogger
  }
}

const customPrettifiers = {
  name (name, _, obj) {
    if (typeof obj.worker !== 'undefined') {
      name += ':' + obj.worker
      obj.worker = undefined // Do not show the worker in a separate line
    }

    return name
  }
}

// Create the runtime logger
async function createLogger (config, runtimeLogsDir) {
  const loggerConfig = { ...config.logger, transport: undefined }
  if (config.logger.base === null) {
    loggerConfig.base = undefined
  }

  // PLT_RUNTIME_LOGGER_STDOUT is used in test to reduce verbosity
  let cliStream = process.env.PLT_RUNTIME_LOGGER_STDOUT
    ? pino.destination(process.env.PLT_RUNTIME_LOGGER_STDOUT)
    : isatty(1)
      ? pretty({ customPrettifiers })
      : pino.destination(1)

  if (config.logger.transport) {
    cliStream = pino.transport(config.logger.transport)
  }

  if (loggerConfig.formatters) {
    loggerConfig.formatters = buildPinoFormatters(loggerConfig.formatters)
  }
  if (loggerConfig.timestamp) {
    loggerConfig.timestamp = buildPinoTimestamp(loggerConfig.timestamp)
  }

  if (!config.managementApi) {
    return [pino(loggerConfig, cliStream), cliStream]
  }

  const multiStream = pino.multistream([{ stream: cliStream, level: loggerConfig.level }])

  const logsFileMb = 5
  const logsLimitMb = config.managementApi?.logs?.maxSize || 200

  let logsLimitCount = Math.ceil(logsLimitMb / logsFileMb) - 1
  if (logsLimitCount < 1) {
    logsLimitCount = 1
  }

  const pinoRoll = pino.transport({
    target: 'pino-roll',
    options: {
      file: join(runtimeLogsDir, 'logs'),
      mode: 0o600,
      size: logsFileMb + 'm',
      mkdir: true,
      fsync: true,
      limit: {
        count: logsLimitCount
      }
    }
  })

  multiStream.add({ level: loggerConfig.level, stream: pinoRoll })

  // Make sure there is a file before continuing otherwise the management API log endpoint might bail out
  await once(pinoRoll, 'ready')

  return [pino(loggerConfig, multiStream), multiStream]
}

module.exports = { abstractLogger, createLogger }
