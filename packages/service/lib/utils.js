'use strict'

const { access } = require('fs/promises')
const { resolve, join, relative, dirname, basename } = require('path')

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

function getJSPluginPath (workingDir, tsPluginPath, compileDir) {
  if (tsPluginPath.endsWith('js')) {
    return tsPluginPath
  }

  const isTs = tsPluginPath.endsWith('ts')
  let newBaseName

  // TODO: investigate why c8 does not see those
  /* c8 ignore next 5 */
  if (isTs) {
    newBaseName = basename(tsPluginPath, '.ts') + '.js'
  } else {
    newBaseName = basename(tsPluginPath)
  }

  const tsPluginRelativePath = relative(workingDir, tsPluginPath)
  const jsPluginRelativePath = join(
    dirname(tsPluginRelativePath),
    newBaseName
  )
  return join(compileDir, jsPluginRelativePath)
}

module.exports = {
  isFileAccessible,
  getJSPluginPath,
  addLoggerToTheConfig
}
