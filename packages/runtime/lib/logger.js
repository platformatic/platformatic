import { buildPinoFormatters, buildPinoTimestamp, usePrettyPrint } from '@platformatic/foundation'
import { isatty } from 'node:tty'
import pino from 'pino'
import pretty from 'pino-pretty'

export { abstractLogger } from '@platformatic/foundation'

// A valid color in the ANSI 256 color palette - Adiacent colors are purposely different
const colors = [
  196, // bright red
  46, // bright green
  33, // light blue
  226, // bright yellow
  201, // bright magenta
  51, // cyan
  208, // orange
  118, // lime
  39, // deep sky blue
  220, // gold
  129, // violet
  82, // spring green
  33, // blue
  214, // amber
  99, // orchid
  190, // light yellow-green
  45, // turquoise
  197, // rose
  50, // aqua
  202, // orange-red
  141, // lavender
  154, // pale green
  93, // pink
  33, // light blue again (for spacing)
  220, // gold
  201, // magenta
  46, // green
  27, // navy blue
  214, // amber
  99, // orchid
  190, // light yellow-green
  39, // cyan-blue
  200, // violet
  82, // neon green
  208, // orange
  135, // purple
  118, // lime
  33, // bright blue
  220, // gold
  201, // bright magenta
  46, // bright green
  21, // bright blue
  202, // orange-red
  141, // purple
  118, // spring green
  208, // orange
  93, // pink
  190, // yellow-green
  39, // cyan
  196, // bright red
  226 // bright yellow
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

        if (!pretty.isColorSupported && process.env.FORCE_COLOR !== 'true') {
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

      let prefix = ''
      let color = ''

      if (name) {
        prefix = name.match(/:\d+$/) ? name : `${name}:${worker}`
        color = context.colors[prefix] ?? ''
      }

      context.current.prefix = `(${pid}) ` + prefix.padStart(context.maxLength, ' ')
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
        return `${context.current.color}[${time}]`
      },
      level (_u1, _u2, _u3, { label, labelColorized }) {
        // No applications registered yet, no need to pad
        if (context.maxLength === 0) {
          return context.current.prefix + labelColorized
        }

        const current = context.current
        const level = current.caller ? current.caller : labelColorized.replace(label, label.padStart(6, ' '))

        return `${current.prefix} | \u001B[0m ${level}`
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
