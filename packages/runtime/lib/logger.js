'use strict'

const { join } = require('node:path')
const { isatty } = require('node:tty')

const pino = require('pino')
const pretty = require('pino-pretty')

const customPrettifiers = {
  name (name, _, obj) {
    if (typeof obj.worker !== 'undefined') {
      name += ':' + obj.worker
      obj.worker = undefined // Do not show the worker in a separate line
    }

    return name
  }
}

function createLogger (config, runtimeLogsDir) {
  const loggerConfig = { ...config.logger }

  // PLT_RUNTIME_LOGGER_STDOUT is used in test to reduce verbosity
  const cliStream = process.env.PLT_RUNTIME_LOGGER_STDOUT
    ? pino.destination(process.env.PLT_RUNTIME_LOGGER_STDOUT)
    : isatty(1)
      ? pretty({ customPrettifiers })
      : pino.destination(1)

  if (!config.managementApi) {
    return [pino(loggerConfig, cliStream), cliStream]
  }

  const multiStream = pino.multistream([{ stream: cliStream, level: loggerConfig.level || 'info' }])

  if (loggerConfig.transport) {
    const transport = pino.transport(loggerConfig.transport)
    multiStream.add({ level: loggerConfig.level || 'info', stream: transport })
  }

  if (config.managementApi) {
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

    multiStream.add({ level: 'trace', stream: pinoRoll })
  }

  return [pino({ level: 'trace' }, multiStream), multiStream]
}

module.exports = { createLogger }
