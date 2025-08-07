import { getExecutableId, getExecutableName, logFatalError, logo } from '@platformatic/foundation'
import { loadServicesCommands } from '@platformatic/runtime'
import { bold } from 'colorette'

function sanitizeHelp (raw) {
  return (typeof raw === 'function' ? raw() : raw).trim()
}

async function loadCommands () {
  const commands = {}

  for (const file of ['create', 'dependencies', 'external', 'patch-config']) {
    const category = await import(`./${file}.js`)
    Object.assign(commands, category.help)
  }

  Object.assign(commands, help)

  return commands
}

export async function showGeneralHelp (logger) {
  if (typeof logger !== 'function') {
    logger = console.log
  }

  const executableId = getExecutableId()
  const commands = Object.values(await loadCommands())
  const servicesCommands = Object.values((await loadServicesCommands()).help)

  const options = [
    { usage: '-V, --version', description: `Show ${executableId} version` },
    { usage: '-v, --verbose', description: 'Show more information' },
    { usage: '--help', description: 'Show this help' }
  ]

  logger(logo())
  logger(`\nUsage: ${executableId} [options] [command]\n`)

  // Compute the maximum length of options or commands
  const maximumLength =
    Math.max(
      ...options.map(c => c.usage.length),
      ...commands.map(c => c.usage.length),
      ...servicesCommands.map(c => c.usage.length)
    ) + 5

  // Print all options
  logger('Options:\n')
  for (const { usage, description } of options) {
    logger(`  ${usage.padEnd(maximumLength, ' ')} ${sanitizeHelp(description)}`)
  }
  logger('')

  // Print all commands
  logger('Commands:\n')
  for (const { usage, description } of commands) {
    logger(`  ${usage.padEnd(maximumLength, ' ')} ${sanitizeHelp(description)}`)
  }
  logger('')
}

export function showHelp (command, logger) {
  if (typeof logger !== 'function') {
    logger = console.log
  }

  logger(`\nUsage: ${getExecutableId()} ${sanitizeHelp(command.usage)}\n\n${sanitizeHelp(command.description)}.\n`)

  let { options, args } = command
  options ??= []
  args ??= []

  // Compute the maximum length of options or args
  const maximumLength = Math.max(...options.map(c => c.usage.length), ...args.map(c => c.name.length)) + 5

  // Print all options
  if (options.length) {
    logger('Options:\n')
    for (const { usage, description } of options) {
      logger(`  ${usage.padEnd(maximumLength, ' ')} ${sanitizeHelp(description)}`)
    }
    logger('')
  }

  // Print all arguments
  if (args.length) {
    logger('Arguments:\n')
    for (const { name, description } of args) {
      logger(`  ${name.padEnd(maximumLength, ' ')} ${sanitizeHelp(description)}`)
    }
    logger('')
  }

  if (command.footer) {
    logger(sanitizeHelp(command.footer) + '\n')
  }
}

export async function helpCommand (logger, args) {
  const command = args?.[0]

  if (!command) {
    return showGeneralHelp()
  }

  const commands = await loadCommands()
  if (!commands[command]) {
    return logFatalError(
      logger,
      `Unknown command ${bold(command)}. Please run ${bold(`"${getExecutableId()} help"`)} to see available commands.`
    )
  }

  showHelp(commands[command])
}

export const help = {
  help: {
    usage: 'help [command]',
    description () {
      return `Show help about ${getExecutableName()} or one of its commands`
    }
  },
  version: {
    usage: 'version',
    description () {
      return `Show current ${getExecutableName()} version`
    }
  }
}
