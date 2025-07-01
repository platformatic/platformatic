import { bold, isColorSupported } from 'colorette'
import { logo } from '../logo.js'
import { loadServicesCommands, logFatalError } from '../utils.js'

async function loadCommands () {
  const commands = {}

  for (const file of [
    'create',
    'build',
    'execution',
    'management',
    'admin',
    'logs',
    'inject',
    'external',
    'patch-config',
    'metrics'
  ]) {
    const category = await import(`./${file}.js`)
    Object.assign(commands, category.help)
  }

  Object.assign(commands, help)

  return commands
}

async function showGeneralHelp () {
  const commands = Object.values(await loadCommands())
  const servicesCommands = Object.values((await loadServicesCommands()).help)

  const options = [
    { usage: '-V, --version', description: 'Show wattpm version' },
    { usage: '-v, --verbose', description: 'Show more information' },
    { usage: '--help', description: 'Show this help' }
  ]

  /* c8 ignore next 3 - Hard to test */
  if (isColorSupported && process.stdout.isTTY) {
    console.log(logo)
  }

  console.log('\nUsage: wattpm [options] [command]\n')

  // Compute the maximum length of options or commands
  const maximumLength =
    Math.max(
      ...options.map(c => c.usage.length),
      ...commands.map(c => c.usage.length),
      ...servicesCommands.map(c => c.usage.length)
    ) + 5

  // Print all options
  console.log('Options:\n')
  for (const { usage, description } of options) {
    console.log(`  ${usage.padEnd(maximumLength, ' ')} ${description}`)
  }
  console.log('')

  // Print all commands
  console.log('Commands:\n')
  for (const { usage, description } of commands) {
    console.log(`  ${usage.padEnd(maximumLength, ' ')} ${description}`)
  }
  console.log('')

  if (servicesCommands.length) {
    console.log('Services Commands:\n')
    for (const { usage, description } of servicesCommands) {
      console.log(`  ${usage.padEnd(maximumLength, ' ')} ${description}`)
    }
    console.log('')
  }
}

function showHelp (command) {
  console.log(`\nUsage: wattpm ${command.usage}\n\n${command.description}.\n`)

  let { options, args } = command
  options ??= []
  args ??= []

  // Compute the maximum length of options or args
  const maximumLength = Math.max(...options.map(c => c.usage.length), ...args.map(c => c.name.length)) + 5

  // Print all options
  if (options.length) {
    console.log('Options:\n')
    for (const { usage, description } of options) {
      console.log(`  ${usage.padEnd(maximumLength, ' ')} ${description}`)
    }
    console.log('')
  }

  // Print all arguments
  if (args.length) {
    console.log('Arguments:\n')
    for (const { name, description } of args) {
      console.log(`  ${name.padEnd(maximumLength, ' ')} ${description}`)
    }
    console.log('')
  }

  if (command.footer) {
    console.log(command.footer.trim() + '\n')
  }
}

export async function helpCommand (logger, args) {
  const command = args?.[0]

  if (!command) {
    return showGeneralHelp()
  }

  const commands = await loadCommands()
  if (!commands[command]) {
    const servicesCommands = (await loadServicesCommands()).help

    if (servicesCommands[command]) {
      // If the command is a service command, we show the help for that command
      return showHelp(servicesCommands[command])
    }

    return logFatalError(
      logger,
      `Unknown command ${bold(command)}. Please run ${bold("'wattpm help'")} to see available commands.`
    )
  }

  showHelp(commands[command])
}

export const help = {
  help: { usage: 'help [command]', description: 'Show help about Watt or one of its commands' },
  version: { usage: 'version', description: 'Show current Watt version' }
}
