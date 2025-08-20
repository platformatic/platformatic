import { getExecutableName, getPackageManager, parseArgs } from '@platformatic/foundation'
import { createApplication, getUsername, getVersion, say } from 'create-wattpm'
import { resolve } from 'node:path'
import { installDependencies } from './dependencies.js'

export async function createCommand (logger, args) {
  let {
    values: { config, 'package-manager': packageManager, 'skip-dependencies': skipDependencies, module: modules }
  } = parseArgs(
    args,
    {
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
    false
  )

  if (!packageManager) {
    packageManager = await getPackageManager(process.cwd(), null)
  }

  const username = await getUsername()
  const version = await getVersion()

  /* c8 ignore next 3 - Ignoring else branches */
  const executableName = getExecutableName()
  const greeting = username ? `Hello ${username},` : 'Hello,'
  await say(`${greeting} welcome to ${version ? `${executableName} ${version}!` : `${executableName}!`}`)

  await createApplication(
    logger,
    packageManager,
    modules.map(m => m.split(/\s*,\s*/).map(m => m.trim())).flat(),
    skipDependencies
      ? false
      : (root, configurationFile, packageManager) => {
          return installDependencies(logger, root, resolve(root, configurationFile), false, packageManager)
        },
    {
      runtimeConfig: config,
      applicationsFolder: 'web'
    },
    {
      devCommand: 'wattpm dev',
      buildCommand: 'wattpm build',
      startCommand: 'wattpm start'
    }
  )
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
