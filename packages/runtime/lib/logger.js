import { buildPinoFormatters, buildPinoTimestamp } from '@platformatic/foundation'
import { isatty } from 'node:tty'
import pino from 'pino'
import pretty from 'pino-pretty'

export { abstractLogger } from '@platformatic/foundation'

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
export async function createLogger (config) {
  const loggerConfig = { ...config.logger, transport: undefined }
  if (config.logger.base === null) {
    loggerConfig.base = undefined
  }

  let cliStream

  if (config.logger.transport) {
    cliStream = pino.transport(config.logger.transport)
  } else {
    cliStream = isatty(1) ? pretty({ customPrettifiers }) : pino.destination(1)
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

  return [pino(loggerConfig, multiStream), multiStream]
}
