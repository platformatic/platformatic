import { errors } from '@platformatic/control'
import { create, loadConfiguration } from '@platformatic/runtime'
import {
  abstractLogger,
  detectApplicationType,
  findConfigurationFileRecursive,
  hasJavascriptFiles,
  loadConfigurationModule,
  saveConfigurationFile,
  loadConfiguration as utilsLoadConfiguration
} from '@platformatic/utils'
import { bgGreen, black, bold } from 'colorette'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { parseArgs as nodeParseArgs } from 'node:util'
import { pino } from 'pino'
import pinoPretty from 'pino-pretty'
import { getExecutableName } from './embedding.js'
import { version } from './schema.js'

export let verbose = false

export function setVerbose (value) {
  verbose = value
}

export function createLogger (level) {
  return pino(
    {
      level,
      customLevels: {
        done: 35
      }
    },
    pinoPretty({
      colorize: process.env.NO_COLOR !== 'true',
      customPrettifiers: {
        level (logLevel, _u1, _u2, { label, labelColorized, colors }) {
          return logLevel === 35 ? bgGreen(black(label)) : labelColorized
        }
      },
      sync: true
    })
  )
}

export function logFatalError (logger, ...args) {
  process.exitCode = 1
  logger.fatal(...args)
  return false
}

export function parseArgs (args, options, stopAtFirstPositional = true) {
  let unparsed = []

  if (stopAtFirstPositional) {
    // Parse a first time to get tokens and see where the first positional, if any, is
    const { tokens } = nodeParseArgs({
      args,
      options,
      allowPositionals: true,
      allowNegative: true,
      strict: false,
      tokens: true
    })

    const firstPositional = tokens.find(t => t.kind === 'positional')

    if (firstPositional) {
      unparsed = args.slice(firstPositional.index)
      args = args.slice(0, firstPositional.index)
    }
  }

  const { tokens, values, positionals } = nodeParseArgs({
    args,
    options,
    allowPositionals: true,
    allowNegative: true,
    strict: true,
    tokens: true
  })

  return {
    values,
    positionals,
    unparsed,
    tokens
  }
}

export function getPackageManager (root, defaultManager = 'npm') {
  if (existsSync(resolve(root, 'pnpm-lock.yaml'))) {
    return 'pnpm'
  }

  if (existsSync(resolve(root, 'yarn.lock'))) {
    return 'yarn'
  }

  return defaultManager
}

export function getPackageArgs (packageManager, production) {
  const args = ['install']
  if (production) {
    switch (packageManager) {
      case 'pnpm':
        args.push('--prod')
        break
      case 'npm':
        args.push('--omit=dev')
        break
    }
  }
  return args
}

export function getRoot (positionals) {
  let root = process.cwd()

  if (positionals?.[0]) {
    root = resolve(root, positionals[0])
  }

  return root
}

export async function getMatchingRuntime (client, positionals) {
  const runtimes = await client.getRuntimes()
  const pidOrName = positionals[0]
  let runtime

  // We have an argument to match
  if (pidOrName) {
    if (pidOrName.match(/^\d+$/)) {
      const pid = parseInt(pidOrName)
      runtime = runtimes.find(runtime => runtime.pid === pid)
    } else {
      runtime = runtimes.find(runtime => runtime.packageName === pidOrName)
    }

    if (runtime) {
      return [runtime, positionals.slice(1)]
    }
  }

  // We found no match, find any runtime whose running directory is the current one
  if (!runtime) {
    runtime = runtimes.find(runtime => runtime.cwd === process.cwd())
  }

  if (!runtime) {
    throw errors.RuntimeNotFound()
  }
  /* c8 ignore next 2 */

  return [runtime, positionals]
}

export function serviceToEnvVariable (service) {
  return `PLT_SERVICE_${service.toUpperCase().replaceAll(/[^A-Z0-9_]/g, '_')}_PATH`
}

export async function findRuntimeConfigurationFile (
  logger,
  root,
  configurationFile,
  fallback = true,
  throwOnError = true,
  verifyPackages = true
) {
  let configFile = await findConfigurationFileRecursive(root, configurationFile, '@platformatic/runtime')

  // If a runtime was not found, search for service file that we wrap in a runtime
  if (!configFile && !configurationFile) {
    configFile = await findConfigurationFileRecursive(root, configurationFile)
  }

  if (!configFile) {
    if (fallback) {
      configurationFile = await fallbackToTemporaryConfigFile(logger, root, verifyPackages)

      if (configurationFile || configurationFile === false) {
        return configurationFile
      }
    }

    if (throwOnError) {
      return logFatalError(
        logger,
        `Cannot find a supported ${getExecutableName()} configuration file (like ${bold('watt.json')}, a ${bold('wattpm.json')} or a ${bold(
          'platformatic.json'
        )}) in ${bold(resolve(root))}.`
      )
    }
  }

  return configFile
}

export async function loadConfigurationFileAsConfig (logger, configurationFile) {
  return loadConfiguration(configurationFile, null, { validate: false })
}

export async function fallbackToTemporaryConfigFile (logger, root, verifyPackages) {
  if (await hasJavascriptFiles(root)) {
    const { name, label } = await detectApplicationType(root)

    const autodetectDescription =
      /* c8 ignore next - else */
      name === '@platformatic/node' ? 'is a generic Node.js application' : `is using ${label}`

    logger.warn(
      `We have auto-detected that the current folder ${bold(autodetectDescription)} so we have created a ${bold('watt.json')} file for you automatically.`
    )

    const schema = `https://schemas.platformatic.dev/${name}/${version}.json?autogenerated=true`
    const configurationFile = resolve(root, 'watt.json')
    await saveConfigurationFile(configurationFile, { $schema: schema })

    // Try to load the module, if it is missing, we will throw an error
    if (verifyPackages) {
      try {
        await loadConfigurationModule(root, { $schema: schema })
      } catch (error) {
        logFatalError(logger, `Cannot load module ${bold(name)}. Please add it to your package.json and try again.`)
        return false
      }
    }

    return configurationFile
  }
}

export async function buildRuntime (logger, configurationFile) {
  let runtime
  try {
    runtime = await create(configurationFile)
    await runtime.init()
    /* c8 ignore next 3 - Hard to test */
  } catch (error) {
    await runtime.close()

    return false
  }

  return runtime
}

export async function loadServicesCommands () {
  const services = {}
  const commands = {}
  const help = {}

  let config
  try {
    const file = await findRuntimeConfigurationFile(abstractLogger, process.cwd(), null, false, false)

    /* c8 ignore next 3 - Hard to test */
    if (!file) {
      throw new Error('No runtime configuration file found.')
    }

    config = await loadConfiguration(file)

    /* c8 ignore next 3 - Hard to test */
    if (!config) {
      throw new Error('No runtime configuration file found.')
    }
  } catch {
    return { services, commands, help }
  }

  for (const service of config.services) {
    try {
      const serviceConfig = await utilsLoadConfiguration(service.config)
      const pkg = await loadConfigurationModule(service.path, serviceConfig)

      if (pkg.createCommands) {
        const definition = await pkg.createCommands(service.id)
        process._rawDebug(definition)
        for (const command of Object.keys(definition.commands)) {
          services[command] = service
        }

        Object.assign(commands, definition.commands)
        Object.assign(help, definition.help)
      }
      /* c8 ignore next 3 - Hard to test */
    } catch {
      // No-op, ignore the service
    }
  }

  return { services, commands, help }
}
