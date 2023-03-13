'use strict'

const { access } = require('fs/promises')
const { resolve, join, relative, dirname, basename } = require('path')

async function findConfigFile (directory, configFileNames) {
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

function getJSPluginPath (configPath, tsPluginPath, compileDir) {
  if (tsPluginPath.endsWith('js')) {
    return tsPluginPath
  }

  const isTs = tsPluginPath.endsWith('ts')
  let newBaseName

  if (isTs) {
    newBaseName = basename(tsPluginPath, '.ts') + '.js'
  } else {
    newBaseName = basename(tsPluginPath)
  }

  const tsPluginRelativePath = relative(dirname(configPath), tsPluginPath)
  const jsPluginRelativePath = join(
    dirname(tsPluginRelativePath),
    newBaseName
  )
  return join(compileDir, jsPluginRelativePath)
}

module.exports = {
  findConfigFile,
  isFileAccessible,
  getJSPluginPath,
  addLoggerToTheConfig
}
