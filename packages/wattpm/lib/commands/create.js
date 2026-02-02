import { getExecutableName, getPackageManager, parseArgs } from '@platformatic/foundation'
import { bold } from 'colorette'
import { spawn } from 'node:child_process'
import { platform } from 'node:os'
import { getSocket } from '../utils.js'

export async function runDelegatedCommand (logger, packageManager, args) {
  if (!packageManager) {
    packageManager = await getPackageManager(process.cwd())
  }

  let runner = 'npx'
  if (packageManager === 'pnpm') {
    runner = 'pnpx'
  } else {
    args.unshift('-y')
  }

  const socket = getSocket()
  if (socket) {
    if (packageManager === 'pnpm') {
      args.push('--', socket)
    } else {
      args.push(socket)
    }
  }

  logger.info(`Running ${bold(runner)} ${bold(args.join(' '))} ...`)

  const options = { stdio: 'inherit' }

  /* c8 ignore next 4 - Covered by CI */
  if (platform() === 'win32') {
    options.shell = true
    options.windowsVerbatimArguments = true
  }

  const proc = spawn(runner, args, options)

  proc.on('exit', code => {
    process.exit(code)
  })
}

export async function createCommand (logger, args) {
  const {
    values: {
      latest,
      config,
      'package-manager': packageManager,
      'skip-dependencies': skipDependencies,
      module: modules
    }
  } = parseArgs(
    args,
    {
      latest: {
        type: 'boolean',
        short: 'l'
      },
      // Keep following options in sync with the create command from wattpm-utils
      config: {
        type: 'string',
        short: 'c',
        default: 'watt.json'
      },
      'package-manager': {
        type: 'string',
        short: 'P'
      },
      'skip-dependencies': {
        type: 'boolean',
        short: 's',
        default: false
      },
      module: {
        short: 'M',
        type: 'string',
        multiple: true,
        default: []
      }
    },
    false,
    false
  )

  const runArgs = ['wattpm-utils' + (latest ? '@latest' : ''), '--', 'create']

  runArgs.push('-c', config)

  if (packageManager) {
    runArgs.push('-P', packageManager)
  }

  if (skipDependencies) {
    runArgs.push('-s')
  }

  if (modules.length > 0) {
    for (const m of modules) {
      runArgs.push('-M', m)
    }
  }

  return runDelegatedCommand(logger, packageManager, runArgs)
}

const createHelp = {
  description () {
    return `Creates a new ${getExecutableName()} project`
  },
  options: [
    {
      usage: '-l --latest',
      description: 'Use the latest version of @platformatic/watt-admin from'
    },
    {
      usage: '-c, --config <config>',
      description: 'Name of the configuration file to use (the default is watt.json)'
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
        'An additional module (or a comma separated list of modules) to use as application generator (it can be used multiple times)'
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
