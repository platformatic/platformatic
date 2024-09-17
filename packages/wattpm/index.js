import { bgGreen, black } from 'colorette'
import pino from 'pino'
import pinoPretty from 'pino-pretty'
import { buildCommand } from './lib/commands/build.js'
import { devCommand, reloadCommand, restartCommand, startCommand, stopCommand } from './lib/commands/execution.js'
import { importCommand, resolveCommand } from './lib/commands/external.js'
import { initCommand } from './lib/commands/init.js'
import { injectCommand } from './lib/commands/inject.js'
import { logsCommand } from './lib/commands/logs.js'
import { configCommand, envCommand, psCommand, servicesCommand } from './lib/commands/management.js'
import { parseArgs, setVerbose } from './lib/utils.js'

export async function main () {
  const logger = pino(
    {
      level: 'info',
      customLevels: {
        done: 35
      }
    },
    pinoPretty({
      colorize: true,
      customPrettifiers: {
        level (logLevel, _u1, _u2, { label, labelColorized, colors }) {
          return logLevel === 35 ? bgGreen(black(label)) : labelColorized
        }
      }
    })
  )

  const originalFatal = logger.fatal.bind(logger)
  logger.fatal = function (...args) {
    originalFatal(...args)
    process.exit(1)
  }

  const options = {
    verbose: {
      short: 'v',
      type: 'boolean'
    }
  }

  const { values, unparsed } = parseArgs(process.argv.slice(2), options)

  if (values.verbose) {
    setVerbose(true)
  }

  let command
  switch (unparsed[0]) {
    case 'init':
      command = initCommand
      break
    case 'dev':
      command = devCommand
      break
    case 'build':
      command = buildCommand
      break
    case 'start':
      command = startCommand
      break
    case 'stop':
      command = stopCommand
      break
    case 'restart':
      command = restartCommand
      break
    case 'reload':
      command = reloadCommand
      break
    case 'ps':
      command = psCommand
      break
    case 'services':
      command = servicesCommand
      break
    case 'config':
      command = configCommand
      break
    case 'env':
      command = envCommand
      break
    case 'logs':
      command = logsCommand
      break
    case 'inject':
      command = injectCommand
      break
    case 'import':
      command = importCommand
      break
    case 'resolve':
      command = resolveCommand
      break
    case 'help':
      break
    default:
      // TODO
      break
  }

  await command(logger, unparsed.slice(1))
}

export * from './lib/schema.js'
