'use strict'

const { access, readFile, stat } = require('node:fs/promises')
const { resolve, join, relative, dirname, basename } = require('node:path')
const { isatty } = require('tty')
const { setPinoFormatters, setPinoTimestamp } = require('@platformatic/utils')

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
  if (config.server.loggerInstance) {
    return
  }

  // We might have a config with no server
  if (!config.server) {
    config.server = {}
  }

  let logger = config.server.logger
  if (!logger) {
    config.server.logger = { level: 'info' }
    logger = config.server.logger
  }

  // If TTY use pino-pretty
  if (isatty(1)) {
    if (!logger.transport) {
      logger.transport = {
        target: 'pino-pretty',
      }
    }
  }

  if (config.server.logger?.formatters) {
    setPinoFormatters(config.server.logger)
  }
  if (config.server.logger?.timestamp) {
    setPinoTimestamp(config.server.logger)
  }
}
/* c8 ignore stop */

function getJSPluginPath (workingDir, tsPluginPath, compileDir) {
  if (tsPluginPath.endsWith('js')) {
    return tsPluginPath
  }

  if (tsPluginPath.indexOf(compileDir) === 0) {
    // In this case, we passed through this function before and we have adjusted
    // the path of the plugin to point to the dist/ folder. Then we restarted.
    // Therefore, we can just return the path as is.
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

let isDockerCached

async function isDocker () {
  async function hasDockerEnv () {
    try {
      await stat('/.dockerenv')
      return true
    } catch {
      return false
    }
  }

  async function hasDockerCGroup () {
    try {
      return (await readFile('/proc/self/cgroup', 'utf8')).includes('docker')
    } catch {
      return false
    }
  }

  if (isDockerCached === undefined) {
    isDockerCached = await hasDockerEnv() || await hasDockerCGroup()
  }

  return isDockerCached
}

module.exports = {
  isDocker,
  isFileAccessible,
  getJSPluginPath,
  addLoggerToTheConfig,
}
