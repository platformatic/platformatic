import { bgGreen, black, bold } from 'colorette'
import pino from 'pino'
import pinoPretty from 'pino-pretty'
import { buildCommand } from './lib/commands/build.js'
import { devCommand, reloadCommand, restartCommand, startCommand, stopCommand } from './lib/commands/execution.js'
import { importCommand, resolveCommand } from './lib/commands/external.js'
import { helpCommand } from './lib/commands/help.js'
import { initCommand } from './lib/commands/init.js'
import { injectCommand } from './lib/commands/inject.js'
import { logsCommand } from './lib/commands/logs.js'
import { configCommand, envCommand, psCommand, servicesCommand } from './lib/commands/management.js'
import { version } from './lib/schema.js'
import { overrideFatal, parseArgs, setVerbose } from './lib/utils.js'

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

  overrideFatal(logger)

  const options = {
    verbose: {
      short: 'v',
      type: 'boolean'
    },
    version: {
      short: 'V',
      type: 'boolean'
    },
    help: {
      type: 'boolean'
    }
  }

  const { values, unparsed } = parseArgs(process.argv.slice(2), options)

  if (values.version) {
    console.log(version)
    process.exit(0)
  }

  if (values.help) {
    helpCommand([])
    return
  }

  if (values.verbose) {
    setVerbose(true)
  }

  let command
  switch (unparsed[0]) {
    case 'init':
      command = initCommand
      break
    case 'build':
      command = buildCommand
      break
    case 'dev':
      command = devCommand
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
      command = helpCommand
      break
    default:
      logger.fatal(`Unknown command ${bold(unparsed[0])}. Please run ${bold('wattpm help')} to see available commands.`)
      break
  }

  await command(logger, unparsed.slice(1))
}

export * from './lib/schema.js'
