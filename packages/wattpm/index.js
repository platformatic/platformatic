import { createCliLogger, logFatalError, parseArgs } from '@platformatic/foundation'
import { loadApplicationsCommands } from '@platformatic/runtime'
import * as colorette from 'colorette'
import { bold } from 'colorette'
import { adminCommand } from './lib/commands/admin.js'
import { applicationsAddCommand, applicationsRemoveCommand } from './lib/commands/applications.js'
import { buildCommand } from './lib/commands/build.js'
import { createCommand } from './lib/commands/create.js'
import { devCommand, reloadCommand, restartCommand, startCommand, stopCommand } from './lib/commands/execution.js'
import { helpCommand } from './lib/commands/help.js'
import { injectCommand } from './lib/commands/inject.js'
import { logsCommand } from './lib/commands/logs.js'
import { applicationsCommand, configCommand, envCommand, psCommand } from './lib/commands/management.js'
import { metricsCommand } from './lib/commands/metrics.js'
import { pprofCommand } from './lib/commands/pprof.js'
import { replCommand } from './lib/commands/repl.js'
import { heapSnapshotCommand } from './lib/commands/snapshot.js'
import { version } from './lib/schema.js'

export * from './lib/schema.js'

export async function main () {
  globalThis.platformatic = { executable: this.executableId }

  const options = {
    'no-pretty': {
      short: 'r',
      type: 'boolean'
    },
    verbose: {
      short: 'v',
      type: 'boolean'
    },
    socket: {
      short: 'S',
      type: 'string'
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

  const logger = createCliLogger('info', values['no-pretty'])
  this.logger = logger

  if (values.version || unparsed[0] === 'version') {
    console.log(version)
    process.exit(0)
  }

  if (values.help) {
    helpCommand.call(this, logger, [])
    return
  } else if (unparsed.includes('-h') || unparsed.includes('--help')) {
    helpCommand.call(this, logger, unparsed)
    return
  }

  if (values.verbose) {
    this.verbose = true
  }

  if (values.socket) {
    this.socket = values.socket
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
    case 'pprof':
      command = pprofCommand
      break
    case 'heap-snapshot':
      command = heapSnapshotCommand
      break
    case 'repl':
      command = replCommand
      break
    case 'applications:add':
      command = applicationsAddCommand
      break
    case 'applications:remove':
      command = applicationsRemoveCommand
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
        const applicationsCommands = await loadApplicationsCommands(this.executableName)
        console.log(applicationsCommands)
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
      `Unknown command ${bold(requestedCommand)}. Please run ${bold(`"${this.executableId} help"`)} to see available commands.`
    )

    return
  }

  if (applicationCommandContext) {
    process.chdir(applicationCommandContext.path)
    return command.call(this, logger, applicationCommandContext.config, unparsed.slice(1), {
      colorette,
      parseArgs,
      logFatalError
    })
  } else {
    await command.call(this, logger, unparsed.slice(1))
  }
}
