'use strict'

const { relative, join, basename, dirname } = require('path')
const { access } = require('fs/promises')
const { resolve } = require('path')

async function findConfigFile (directory) {
  const configFileNames = [
    'platformatic.service.json',
    'platformatic.service.json5',
    'platformatic.service.yaml',
    'platformatic.service.yml',
    'platformatic.service.toml',
    'platformatic.service.tml'
  ]

  const configFilesAccessibility = await Promise.all(configFileNames.map((fileName) => isFileAccessible(fileName, directory)))
  const accessibleConfigFilename = configFileNames.find((value, index) => configFilesAccessibility[index])
  return accessibleConfigFilename
}

async function isFileAccessible (filename, directory) {
  try {
    const filePath = directory ? resolve(directory, filename) : filename
    await access(filePath)
    return true
  } catch (err) {
    return false
  }
}

/* c8 ignore start */
function addLoggerToTheConfig (config) {
  if (config === undefined || config.server === undefined) return

  // Set the logger if not present
  let logger = config.server.logger
  if (!logger) {
    config.server.logger = { level: 'info' }
    logger = config.server.logger
  }

  // If TTY use pino-pretty
  if (process.stdout.isTTY) {
    if (!logger.transport) {
      logger.transport = {
        target: 'pino-pretty'
      }
    }
  }
}
/* c8 ignore stop */

module.exports = {
  findConfigFile,
  isFileAccessible,
  addLoggerToTheConfig
}
