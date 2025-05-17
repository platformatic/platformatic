import { createApplication, getUsername, getVersion, say } from 'create-platformatic'
import { resolve } from 'node:path'
import { getPackageManager, parseArgs } from '../utils.js'
import { installDependencies } from './build.js'

export async function createCommand (logger, args) {
  let {
    values: {
      config,
      marketplace,
      'package-manager': packageManager,
      'skip-dependencies': skipDependencies,
      module: modules
    }
  } = parseArgs(
    args,
    {
      config: {
        type: 'string',
        short: 'c',
        default: 'watt.json'
      },
      marketplace: {
        type: 'string',
        short: 'm',
        default: 'https://marketplace.platformatic.dev'
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
    packageManager = getPackageManager(process.cwd())
  }

  const username = await getUsername()
  const version = await getVersion()
  /* c8 ignore next 2 - Ignoring else branches */
  const greeting = username ? `Hello ${username},` : 'Hello,'
  await say(`${greeting} welcome to ${version ? `Watt ${version}!` : 'Watt!'}`)

  await createApplication(
    logger,
    packageManager,
    modules.map(m => m.split(/\s*,\s*/).map(m => m.trim())).flat(),
    marketplace,
    skipDependencies
      ? false
      : (root, configurationFile, packageManager) => {
          return installDependencies(logger, root, resolve(root, configurationFile), false, packageManager)
        },
    {
      runtimeConfig: config,
      servicesFolder: 'web'
    }
  )
}

const createHelp = {
  description: 'Creates a new Watt project',
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
  }
}
