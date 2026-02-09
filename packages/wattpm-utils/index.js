import { createCliLogger, getExecutableId, logFatalError, parseArgs, setVerbose } from '@platformatic/foundation'
import { bold } from 'colorette'
import { createCommand } from './lib/commands/create.js'
import { installCommand, updateCommand } from './lib/commands/dependencies.js'
import { importCommand, resolveCommand } from './lib/commands/external.js'
import { helpCommand } from './lib/commands/help.js'
import { patchConfigCommand } from './lib/commands/patch-config.js'
import { version } from './lib/version.js'

export async function main () {
  globalThis.platformatic = { executable: getExecutableId() }

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

  /* c8 ignore next 3 */
  if (values.verbose) {
    setVerbose(true)
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
      `Unknown command ${bold(requestedCommand)}. Please run ${bold(`"${getExecutableId()} help"`)} to see available commands.`
    )

    return
  }

  await command(logger, unparsed.slice(1))
}
