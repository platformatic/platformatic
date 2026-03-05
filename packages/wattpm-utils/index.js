import { createCliLogger, logFatalError, parseArgs } from '@platformatic/foundation'
import { bold } from 'colorette'
import { createCommand } from './lib/commands/create.js'
import { installCommand, updateCommand } from './lib/commands/dependencies.js'
import { importCommand, resolveCommand } from './lib/commands/external.js'
import { helpCommand } from './lib/commands/help.js'
import { patchConfigCommand } from './lib/commands/patch-config.js'
import { version } from './lib/version.js'

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

  /* c8 ignore next 3 */
  if (values.verbose) {
    this.verbose = true
  }

  let command
  const requestedCommand = unparsed[0] || 'help'
  switch (requestedCommand) {
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
    /* c8 ignore next 2 - aliases */
    case 'init':
    case 'add':
    case 'create':
      command = createCommand
      break
    case 'help':
      command = helpCommand
      break
  }

  if (!command) {
    logFatalError(
      logger,
      `Unknown command ${bold(requestedCommand)}. Please run ${bold(`"${this.executableId} help"`)} to see available commands.`
    )

    return
  }

  await command.call(this, logger, unparsed.slice(1))
}
