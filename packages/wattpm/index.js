import { bold } from 'colorette'
import { adminCommand } from './lib/commands/admin.js'
import { buildCommand, installCommand, updateCommand } from './lib/commands/build.js'
import { devCommand, reloadCommand, restartCommand, startCommand, stopCommand } from './lib/commands/execution.js'
import { importCommand, resolveCommand } from './lib/commands/external.js'
import { helpCommand } from './lib/commands/help.js'
import { initCommand } from './lib/commands/init.js'
import { injectCommand } from './lib/commands/inject.js'
import { logsCommand } from './lib/commands/logs.js'
import { configCommand, envCommand, psCommand, servicesCommand } from './lib/commands/management.js'
import { metricsCommand } from './lib/commands/metrics.js'
import { patchConfigCommand } from './lib/commands/patch-config.js'
import { version } from './lib/schema.js'
import { createLogger, overrideFatal, parseArgs, setVerbose } from './lib/utils.js'

export async function main () {
  globalThis.platformatic = { executable: 'watt' }

  const logger = createLogger('info')

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

  if (values.version || unparsed[0] === 'version') {
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
    case 'patch-config':
      command = patchConfigCommand
      break
    case 'install':
      command = installCommand
      break
    case 'update':
      command = updateCommand
      break
    case 'help':
      command = helpCommand
      break
    case 'metrics':
      command = metricsCommand
      break
    case 'admin':
      command = adminCommand
      break
    /* c8 ignore next 5 */
    default:
      logger.fatal(
        `Unknown command ${bold(unparsed[0])}. Please run ${bold("'wattpm help'")} to see available commands.`
      )
      return
  }

  await command(logger, unparsed.slice(1))
}

export * from './lib/schema.js'

export { resolveServices } from './lib/commands/external.js'
export { patchConfig } from './lib/commands/patch-config.js'
