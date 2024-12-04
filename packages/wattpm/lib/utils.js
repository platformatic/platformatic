import {
  ConfigManager,
  getParser,
  getStringifier,
  loadConfig as pltConfigLoadConfig,
  Store
} from '@platformatic/config'
import { platformaticRuntime, buildRuntime as pltBuildRuntime } from '@platformatic/runtime'
import { bgGreen, black, bold } from 'colorette'
import { readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
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
      colorize: true,
      customPrettifiers: {
        level (logLevel, _u1, _u2, { label, labelColorized, colors }) {
          return logLevel === 35 ? bgGreen(black(label)) : labelColorized
        }
      }
    })
  )
}

export function overrideFatal (logger) {
  const originalFatal = logger.fatal.bind(logger)
  logger.fatal = function (...args) {
    originalFatal(...args)
    process.exit(1)
  }
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

export function getMatchingRuntimeArgs (logger, positional) {
  const args = {}
  const pidOrName = positional[0]

  if (pidOrName) {
    /* c8 ignore next */
    args[pidOrName?.match(/^\d+$/) ? 'pid' : 'name'] = pidOrName
  }

  return args
}

export function serviceToEnvVariable (service) {
  return `PLT_SERVICE_${service.toUpperCase().replaceAll(/[^A-Z0-9_]/g, '_')}_PATH`
}

export async function findConfigurationFile (logger, root) {
  let current = root
  let configurationFile
  while (configurationFile === undefined) {
    // Find a wattpm.json or watt.json file
    configurationFile = await ConfigManager.findConfigFile(current, true)
    if (!configurationFile) {
      const newCurrent = dirname(current)

      if (newCurrent === current) {
        break
      }

      current = newCurrent
    }
  }

  if (typeof configurationFile !== 'string') {
    logger.fatal(
      `Cannot find a supported Watt configuration file (like ${bold(
        'watt.json'
      )}, a ${bold('wattpm.json')} or a ${bold('platformatic.json')}) in ${bold(root)}.`
    )
  }

  const resolved = resolve(current, configurationFile)
  return resolved
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

  await configManager.parse(true, [])
  return configManager.current
}

export async function loadRawConfigurationFile (_, configurationFile) {
  const parseConfig = getParser(configurationFile)

  return parseConfig(await readFile(configurationFile, 'utf-8'))
}

export function saveConfigurationFile (logger, configurationFile, config) {
  const stringifyConfig = getStringifier(configurationFile)

  return writeFile(configurationFile, stringifyConfig(config), 'utf-8')
}

export async function buildRuntime (logger, configurationFile) {
  const store = new Store()
  store.add(platformaticRuntime)

  const config = await pltConfigLoadConfig({}, ['-c', configurationFile], store, {}, true, logger)
  config.configManager.args = config.args

  const runtimeConfig = config.configManager
  try {
    return await pltBuildRuntime(runtimeConfig)
    /* c8 ignore next 3 */
  } catch (e) {
    process.exit(1)
  }
}
