import { createCliLogger, logFatalError, parseArgs } from '@platformatic/foundation'
import { updateGlobals } from '@platformatic/globals'
import { loadApplicationsCommands } from '@platformatic/runtime'
import * as colorette from 'colorette'
import { bold } from 'colorette'
import { adminCommand } from './commands/admin.js'
import { applicationsAddCommand, applicationsRemoveCommand } from './commands/applications.js'
import { buildCommand } from './commands/build.js'
import { createCommand } from './commands/create.js'
import { devCommand, reloadCommand, restartCommand, startCommand, stopCommand } from './commands/execution.js'
import { helpCommand } from './commands/help.js'
import { injectCommand } from './commands/inject.js'
import { logsCommand } from './commands/logs.js'
import { applicationsCommand, envCommand, psCommand } from './commands/management.js'
import { metricsCommand } from './commands/metrics.js'
import { pprofCommand } from './commands/pprof.js'
import { replCommand } from './commands/repl.js'
import { schedulerCommand, schedulerPauseCommand, schedulerResumeCommand, schedulerRunCommand } from './commands/scheduler.js'
import { heapSnapshotCommand } from './commands/snapshot.js'
import { version } from './schema.js'

export * from './schema.js'

// Extract the -c/--config option from application command arguments, leaving
// all the other arguments for the application command itself
function extractConfigOption (args) {
  const remaining = []
  let config = null

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]

    if (arg === '-c' || arg === '--config') {
      config = args[i + 1]
      i++
    } else if (arg.startsWith('--config=')) {
      config = arg.slice('--config='.length)
    } else {
      remaining.push(arg)
    }
  }

  return { config, remaining }
}

export async function main () {
  updateGlobals({ executable: this.executableId })

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
  let applicationCommandArgs
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
    case 'scheduler':
      command = schedulerCommand
      break
    case 'scheduler:pause':
      command = schedulerPauseCommand
      break
    case 'scheduler:resume':
      command = schedulerResumeCommand
      break
    case 'scheduler:run':
      command = schedulerRunCommand
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
        // Extract the -c/--config option, which selects the runtime configuration file
        const { config: runtimeConfigFile, remaining } = extractConfigOption(unparsed.slice(1))
        const applicationsCommands = await loadApplicationsCommands(this.executableName, runtimeConfigFile)
        const applicationCommand = applicationsCommands.commands[requestedCommand]

        if (applicationCommand) {
          applicationCommandContext = applicationsCommands.applications[requestedCommand]
          applicationCommandArgs = remaining
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
    const invocationCwd = process.cwd()
    process.chdir(applicationCommandContext.path)
    return command.call(this, logger, applicationCommandContext.config, applicationCommandArgs, {
      application: applicationCommandContext,
      cwd: invocationCwd,
      colorette,
      parseArgs,
      logFatalError
    })
  } else {
    await command.call(this, logger, unparsed.slice(1))
  }
}
