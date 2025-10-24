import { buildPinoFormatters, buildPinoTimestamp, usePrettyPrint } from '@platformatic/foundation'
import { isatty } from 'node:tty'
import pino from 'pino'
import pretty from 'pino-pretty'

export { abstractLogger } from '@platformatic/foundation'

// Extracted from https://github.com/debug-js/debug/blob/master/src/node.js
const colors = [
  20, 21, 26, 27, 32, 33, 38, 39, 40, 41, 42, 43, 44, 45, 56, 57, 62, 63, 68, 69, 74, 75, 76, 77, 78, 79, 80, 81, 92,
  93, 98, 99, 112, 113, 128, 129, 134, 135, 148, 149, 160, 161, 162, 163, 164, 165, 166, 167, 168, 169, 170, 171, 172,
  173, 178, 179, 184, 185, 196, 197, 198, 199, 200, 201, 202, 203, 204, 205, 206, 207, 208, 209, 214, 215, 220, 221
]

function createLoggerContext () {
  const context = {
    colors: {},
    maxLength: 0,
    updatePrefixes (ids) {
      context.colors = {}
      context.maxLength = 0

      for (const id of ids) {
        context.maxLength = Math.max(context.maxLength, id.length)
        let hash = 0

        if (!pretty.isColorSupported) {
          context.colors[id] = ''
          continue
        }

        // Calculate the hash of the id to pick a color
        for (const char of id) {
          for (let i = 0; i < char.length; i++) {
            hash = ((hash << 5) - hash) ^ char.charCodeAt(i)
            hash = Math.abs(hash) % Number.MAX_SAFE_INTEGER
          }
        }

        context.colors[id] = `\u001B[38;5;${colors[hash % colors.length]}m`
      }
    }
  }

  return context
}

function createPrettifier (context) {
  return pretty({
    messageFormat (log, key) {
      const { name, pid, hostname, caller, worker } = log

      context.current = {
        name,
        pid,
        hostname,
        caller,
        worker
      }

      const pidString = `${pid}]`
      let prefix = pidString
      let color = ''

      if (name) {
        prefix = `${pidString} ${name}:${worker}`
        color = context.colors[`${name}:${worker}`] ?? ''
      }

      context.current.prefix = prefix.padEnd(context.maxLength + pidString.length + 1, ' ')
      context.current.color = color

      // We need to nullify all these so that prettifierMetadata in pino-pretty returns an empty string
      log.name = undefined
      log.pid = undefined
      log.hostname = undefined
      log.caller = undefined
      log.worker = undefined

      return log[key]
    },
    customPrettifiers: {
      time (time) {
        return `${context.current.color}[${time}`
      },
      level (_u1, _u2, _u3, { label, labelColorized, colors }) {
        const current = context.current
        const level = current.caller
          ? colors.gray(current.caller)
          : labelColorized.replace(label, label.padStart(6, ' '))

        return `${current.prefix}\u001B[0m ${level}${current.color}`
      }
    }
  })
}

// Create the runtime logger
export async function createLogger (config) {
  const context = createLoggerContext()

  const loggerConfig = { ...config.logger, transport: undefined }
  if (config.logger.base === null) {
    loggerConfig.base = undefined
  }

  let cliStream

  if (config.logger.transport) {
    cliStream = pino.transport(config.logger.transport)
  } else if ((process.env.FORCE_TTY || isatty(1)) && usePrettyPrint()) {
    cliStream = createPrettifier(context)
  } else {
    cliStream = pino.destination(1)
  }

  if (loggerConfig.formatters) {
    loggerConfig.formatters = buildPinoFormatters(loggerConfig.formatters)
  }

  if (loggerConfig.timestamp) {
    loggerConfig.timestamp = buildPinoTimestamp(loggerConfig.timestamp)
  }

  if (!config.managementApi) {
    return [pino(loggerConfig, cliStream), cliStream, context]
  }

  const multiStream = pino.multistream([{ stream: cliStream, level: loggerConfig.level }])

  const logsFileMb = 5
  const logsLimitMb = config.managementApi?.logs?.maxSize || 200

  let logsLimitCount = Math.ceil(logsLimitMb / logsFileMb) - 1
  if (logsLimitCount < 1) {
    logsLimitCount = 1
  }

  return [pino(loggerConfig, multiStream), multiStream, context]
}
