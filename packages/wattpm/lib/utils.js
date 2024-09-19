import { ConfigManager, loadConfig as pltConfigLoadConfig, Store } from '@platformatic/config'
import { platformaticRuntime, buildRuntime as pltBuildRuntime } from '@platformatic/runtime'
import { bold } from 'colorette'
import { existsSync } from 'node:fs'
import { readdir, stat } from 'node:fs/promises'
import { resolve } from 'node:path'
import { parseArgs as nodeParseArgs } from 'node:util'

export let verbose = false

export function setVerbose (value) {
  verbose = value
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

  return { values, positionals, unparsed, tokens }
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

export async function findConfigurationFile (logger, root) {
  // Find a wattpm.json or watt.json file
  const configurationFile = await ConfigManager.findConfigFile(root, ['watt.json', 'wattpm.json', 'platformatic.json'])

  if (typeof configurationFile !== 'string') {
    logger.fatal(
      `Cannot find a ${bold('watt.json')}, a ${bold('wattpm.json')} or a ${bold('platformatic.json')} file in ${bold(root)}.`
    )
  }

  return resolve(root, configurationFile)
}

export async function checkEmptyDirectory (logger, path, relativePath) {
  if (existsSync(path)) {
    const statObject = await stat(path)

    if (!statObject.isDirectory()) {
      logger.fatal(`Path ${bold(relativePath)} exists but it is not a directory.`)
    }

    const entries = await readdir(path)

    if (entries.length) {
      logger.fatal(`Directory ${bold(relativePath)} is not empty.`)
    }
  }
}

export async function buildRuntime (logger, configurationFile) {
  const store = new Store()
  store.add(platformaticRuntime)

  const config = await pltConfigLoadConfig({}, ['-c', configurationFile], store, {}, true)
  config.configManager.args = config.args

  const runtimeConfig = config.configManager
  try {
    return await pltBuildRuntime(runtimeConfig)
    /* c8 ignore next 3 */
  } catch (e) {
    process.exit(1)
  }
}
