import { findConfigurationFile, loadConfig, Store } from '@platformatic/config'
import { errors } from '@platformatic/control'
import { platformaticRuntime, buildRuntime as pltBuildRuntime, wrapConfigInRuntimeConfig } from '@platformatic/runtime'
import { ensureLoggableError } from '@platformatic/utils'
import { bgGreen, black, bold } from 'colorette'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { parseArgs as nodeParseArgs } from 'node:util'
import { pino } from 'pino'
import pinoPretty from 'pino-pretty'

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

export async function findRuntimeConfigurationFile (logger, root, configurationFile, schemas = 'runtime') {
  let configFile = await findConfigurationFile(root, configurationFile, schemas)

  // If a runtime was not found, search for service file that we wrap in a runtime
  if (schemas === 'runtime' && !configFile && !configurationFile) {
    configFile = await findConfigurationFile(root, configurationFile)
  }

  if (!configFile) {
    return logFatalError(
      logger,
      `Cannot find a supported Watt configuration file (like ${bold('watt.json')}, a ${bold('wattpm.json')} or a ${bold(
        'platformatic.json'
      )}) in ${bold(root)}.`
    )
  }

  return configFile
}

export async function loadConfigurationFileAsConfig (logger, configurationFile) {
  const store = new Store()
  store.add(platformaticRuntime)

  const args = ['-c', configurationFile]
  const options = { allowInvalid: true, transformOnValidationErrors: true }
  return loadConfig(
    {},
    args,
    store,
    {
      /* c8 ignore next 3 */
      onMissingEnv () {
        return ''
      }
    },
    true,
    logger,
    options
  )
}

export async function loadRuntimeConfigurationFile (logger, configurationFile) {
  const config = await loadConfigurationFileAsConfig(logger, configurationFile)
  const args = ['-c', configurationFile]
  const options = { allowInvalid: true, transformOnValidationErrors: true }

  if (config.configType !== 'runtime') {
    const configManager = await wrapConfigInRuntimeConfig(config, args, options)
    config.configManager = configManager
  }

  config.configManager.args = config.args

  return config.configManager.current
}

export async function buildRuntime (logger, configurationFile) {
  const store = new Store()
  store.add(platformaticRuntime)

  const args = ['-c', configurationFile]
  const config = await loadConfig({}, args, store, {}, true, logger)

  if (config.configType !== 'runtime') {
    const configManager = await wrapConfigInRuntimeConfig(config, args)
    config.configManager = configManager
  }

  config.configManager.args = config.args

  let runtime
  try {
    runtime = await pltBuildRuntime(config.configManager)
    /* c8 ignore next 3 - Hard to test */
  } catch (error) {
    logFatalError(logger, { err: ensureLoggableError(error) }, 'Error creating the runtime')
  }

  return runtime
}
