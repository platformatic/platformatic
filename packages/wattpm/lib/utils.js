import {
  findConfigurationFile as findRawConfigurationFile,
  loadConfig as pltConfigLoadConfig,
  Store
} from '@platformatic/config'
import { errors } from '@platformatic/control'
import { platformaticRuntime, buildRuntime as pltBuildRuntime } from '@platformatic/runtime'
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

export async function findConfigurationFile (logger, root, configurationFile) {
  const configFile = await findRawConfigurationFile(root, configurationFile, 'runtime')

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

export async function loadConfigurationFile (logger, configurationFile) {
  const store = new Store({
    cwd: process.cwd(),
    logger
  })
  store.add(platformaticRuntime)

  const { configManager } = await store.loadConfig({
    config: configurationFile,
    overrides: {
      /* c8 ignore next 3 */
      onMissingEnv (key) {
        return ''
      }
    }
  })

  await configManager.parse(true, [], { transformOnValidationErrors: true })
  return configManager.current
}

export async function buildRuntime (logger, configurationFile) {
  const store = new Store()
  store.add(platformaticRuntime)

  const config = await pltConfigLoadConfig({}, ['-c', configurationFile], store, {}, true, logger)
  config.configManager.args = config.args

  const runtimeConfig = config.configManager
  try {
    return await pltBuildRuntime(runtimeConfig)
    /* c8 ignore next 3 - Hard to test */
  } catch (e) {
    process.exit(1)
  }
}
