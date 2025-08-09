import { getExecutableName, getPackageManager, parseArgs } from '@platformatic/foundation'
import { spawn } from 'node:child_process'

export async function createCommand (logger, args) {
  let {
    values: { 'package-manager': packageManager }
  } = parseArgs(
    args,
    {
      'package-manager': {
        type: 'string',
        short: 'P'
      }
    },
    false,
    false
  )

  if (!packageManager) {
    packageManager = await getPackageManager(process.cwd())
  }

  let command = 'npx'
  const commandArgs = ['wattpm-utils']

  if (packageManager === 'pnpm') {
    command = 'pnpx'
  } else {
    commandArgs.unshift('-y')
  }

  logger.info(`Running watt-utils create via ${command} ...`)
  const proc = spawn(command, [...commandArgs, '--', 'create', ...args], { stdio: 'inherit' })

  proc.on('exit', code => {
    process.exit(code)
  })
}

const createHelp = {
  description () {
    return `Creates a new ${getExecutableName()} project`
  },
  options: [
    {
      usage: '-c, --config <config>',
      description: 'Name of the configuration file to use (the default is watt.json)'
    },
    {
      usage: '-m, --marketplace <url>',
      description: 'Platformatic Marketplace host (the default is https://marketplace.platformatic.dev)'
    },
    {
      usage: '-s, --skip-dependencies',
      description: 'Do not install dependencies after creating the files'
    },
    {
      usage: '-P, --package-manager <executable>',
      description: 'Use an alternative package manager (the default is to autodetect it)'
    },
    {
      usage: '-M, --module <name>',
      description:
        'An additional module (or a comma separated list of modules) to use as service generator (it can be used multiple times)'
    }
  ]
}

export const help = {
  init: {
    usage: 'init',
    ...createHelp
  },
  create: {
    usage: 'create',
    ...createHelp
  },
  add: {
    usage: 'add',
    ...createHelp
  }
}
