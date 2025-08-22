import { createCliLogger, getExecutableId, logFatalError, parseArgs, setVerbose } from '@platformatic/foundation'
import { loadApplicationsCommands } from '@platformatic/runtime'
import * as colorette from 'colorette'
import { bold } from 'colorette'
import { adminCommand } from './lib/commands/admin.js'
import { buildCommand } from './lib/commands/build.js'
import { createCommand } from './lib/commands/create.js'
import { devCommand, reloadCommand, restartCommand, startCommand, stopCommand } from './lib/commands/execution.js'
import { helpCommand } from './lib/commands/help.js'
import { injectCommand } from './lib/commands/inject.js'
import { logsCommand } from './lib/commands/logs.js'
import { applicationsCommand, configCommand, envCommand, psCommand } from './lib/commands/management.js'
import { metricsCommand } from './lib/commands/metrics.js'
import { version } from './lib/schema.js'

export * from './lib/schema.js'

export async function main () {
  globalThis.platformatic = { executable: getExecutableId() }

  const logger = createCliLogger('info')

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
      short: 'h',
      type: 'boolean'
    }
  }

  const { values, unparsed } = parseArgs(process.argv.slice(2), options)

  if (values.version || unparsed[0] === 'version') {
    console.log(version)
    process.exit(0)
  }

  if (values.help) {
    helpCommand(logger, [])
    return
  } else if (unparsed.includes('-h') || unparsed.includes('--help')) {
    helpCommand(logger, unparsed)
    return
  }

  if (values.verbose) {
    setVerbose(true)
  }

  let command
  const requestedCommand = unparsed[0] || 'help'
  let applicationCommandContext
  switch (requestedCommand) {
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
    case 'applications':
      command = applicationsCommand
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
    case 'metrics':
      command = metricsCommand
      break
    case 'admin':
      command = adminCommand
      break
    /* c8 ignore next 2 - aliases */
    case 'init':
    case 'add':
    case 'create':
      command = createCommand
      break
    case 'help':
      command = helpCommand
      break
    default:
      if (requestedCommand) {
        const applicationsCommands = await loadApplicationsCommands()
        const applicationCommand = applicationsCommands.commands[requestedCommand]

        if (applicationCommand) {
          applicationCommandContext = applicationsCommands.applications[requestedCommand]
          command = applicationCommand
        }
      }

      break
  }

  if (!command) {
    logFatalError(
      logger,
      `Unknown command ${bold(requestedCommand)}. Please run ${bold(`"${getExecutableId()} help"`)} to see available commands.`
    )

    return
  }

  if (applicationCommandContext) {
    process.chdir(applicationCommandContext.path)
    return command(logger, applicationCommandContext.config, unparsed.slice(1), { colorette, parseArgs, logFatalError })
  } else {
    await command(logger, unparsed.slice(1))
  }
}
