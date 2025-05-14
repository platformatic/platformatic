'use strict'

const { ConfigManager } = require('./manager')
const { matchKnownSchema } = require('./store')
const { readFile, writeFile } = require('node:fs/promises')
const { getParser, getStringifier } = require('./formats')
const { resolve, dirname } = require('node:path')

async function findConfigurationFile (root, configurationFile, schemas, typeOrCandidates) {
  if (schemas && !Array.isArray(schemas)) {
    schemas = [schemas]
  }

  let current = root

  while (!configurationFile) {
    // Find a wattpm.json or watt.json file
    configurationFile = await ConfigManager.findConfigFile(current, typeOrCandidates)

    // If a file is found, verify it actually represents a watt or runtime configuration
    if (configurationFile) {
      const configuration = await loadConfigurationFile(resolve(current, configurationFile))

      if (schemas && !schemas.includes(matchKnownSchema(configuration.$schema))) {
        configurationFile = null
      }
    }

    if (!configurationFile) {
      const newCurrent = dirname(current)

      if (newCurrent === current) {
        break
      }

      current = newCurrent
    }
  }

  if (typeof configurationFile !== 'string') {
    return null
  }

  const resolved = resolve(current, configurationFile)
  return resolved
}

async function loadConfigurationFile (configurationFile) {
  const parseConfig = getParser(configurationFile)

  return parseConfig(await readFile(configurationFile, 'utf-8'))
}

function saveConfigurationFile (configurationFile, config) {
  const stringifyConfig = getStringifier(configurationFile)

  return writeFile(configurationFile, stringifyConfig(config), 'utf-8')
}

module.exports = {
  findConfigurationFile,
  loadConfigurationFile,
  saveConfigurationFile
}
