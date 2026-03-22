import { logFatalError, logo } from '@platformatic/foundation'
import { loadApplicationsCommands } from '@platformatic/runtime'
import { bold } from 'colorette'

function sanitizeHelp (context, raw) {
  return (typeof raw === 'function' ? raw.call(context) : raw).trim()
}

async function loadCommands () {
  const commands = {}

  for (const file of [
    'build',
    'create',
    'execution',
    'applications',
    'management',
    'admin',
    'logs',
    'inject',
    'metrics',
    'pprof',
    'repl',
    'snapshot'
  ]) {
    const category = await import(`./${file}.js`)
    Object.assign(commands, category.help)
  }

  Object.assign(commands, help)

  return commands
}

export async function showGeneralHelp (context, logger) {
  if (typeof logger !== 'function') {
    logger = console.log
  }

  const executableId = context.executableId
  const commands = Object.values(await loadCommands())
  const applicationsCommands = Object.values((await loadApplicationsCommands(context.executableName)).help)

  const options = [
    { usage: '-V, --version', description: `Show ${executableId} version` },
    { usage: '-v, --verbose', description: 'Show more information' },
    {
      usage: '-S, --socket <path>',
      description: 'Path for the control socket. If not specified, the default platform-specific location is used.'
    },
    { usage: '--help', description: 'Show this help' }
  ]

  logger(logo.call(context))
  logger(`\nUsage: ${executableId} [options] [command]\n`)

  // Compute the maximum length of options or commands
  const maximumLength =
    Math.max(
      ...options.map(c => c.usage.length),
      ...commands.map(c => c.usage.length),
      ...applicationsCommands.map(c => c.usage.length)
    ) + 5

  // Print all options
  logger('Options:\n')
  for (const { usage, description } of options) {
    logger(`  ${usage.padEnd(maximumLength, ' ')} ${sanitizeHelp(context, description)}`)
  }
  logger('')

  // Print all commands
  logger('Commands:\n')
  for (const { usage, description } of commands) {
    logger(`  ${usage.padEnd(maximumLength, ' ')} ${sanitizeHelp(context, description)}`)
  }
  logger('')

  if (applicationsCommands.length) {
    logger('Applications Commands:\n')
    for (const { usage, description } of applicationsCommands) {
      logger(`  ${usage.padEnd(maximumLength, ' ')} ${sanitizeHelp(context, description)})`)
    }
    logger('')
  }
}

export function showHelp (context, command, logger) {
  if (typeof logger !== 'function') {
    logger = console.log
  }

  logger(
    `\nUsage: ${context.executableId} ${sanitizeHelp(context, command.usage)}\n\n${sanitizeHelp(context, command.description)}.\n`
  )

  let { options, args } = command
  options ??= []
  args ??= []

  // Compute the maximum length of options or args
  const maximumLength = Math.max(...options.map(c => c.usage.length), ...args.map(c => c.name.length)) + 5

  // Print all options
  if (options.length) {
    logger('Options:\n')
    for (const { usage, description } of options) {
      logger(`  ${usage.padEnd(maximumLength, ' ')} ${sanitizeHelp(context, description)}`)
    }
    logger('')
  }

  // Print all arguments
  if (args.length) {
    logger('Arguments:\n')
    for (const { name, description } of args) {
      logger(`  ${name.padEnd(maximumLength, ' ')} ${sanitizeHelp(context, description)}`)
    }
    logger('')
  }

  if (command.footer) {
    logger(sanitizeHelp(context, command.footer) + '\n')
  }
}

export async function helpCommand (logger, args) {
  const command = args?.[0]

  if (!command) {
    return showGeneralHelp(this)
  }

  const commands = await loadCommands()
  if (!commands[command]) {
    const applicationsCommands = (await loadApplicationsCommands(this.executableName)).help

    if (applicationsCommands[command]) {
      // If the command is an application command, we show the help for that command
      return showHelp(this, applicationsCommands[command])
    }

    return logFatalError(
      logger,
      `Unknown command ${bold(command)}. Please run ${bold(`"${this.executableId} help"`)} to see available commands.`
    )
  }

  showHelp(this, commands[command])
}

export const help = {
  help: {
    usage: 'help [command]',
    description () {
      return `Show help about ${this.executableName} or one of its commands`
    }
  },
  version: {
    usage: 'version',
    description () {
      return `Show current ${this.executableName} version`
    }
  }
}
