'use strict'

const { relative, join, basename, dirname } = require('path')
const { access } = require('fs/promises')
const { connect } = require('@platformatic/db-core')
const { resolve } = require('path')
const { fileURLToPath } = require('url')

async function setupDB (log, config) {
  const { db, sql, entities } = await connect({ ...config, log })
  let driver = ''

  // TODO Add tests for multiple databases
  /* c8 ignore next 11 */
  if (db.isPg) {
    driver = 'pg'
  } else if (db.isMySql) {
    driver = 'mysql'
  } else if (db.isMariaDB) {
    driver = 'mysql'
  } else if (db.isSQLite) {
    driver = 'sqlite3'
  } else {
    throw new Error('unknown database')
  }
  return {
    db,
    sql,
    entities,
    driver
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

async function findConfigFile (directory) {
  const configFileNames = [
    'platformatic.db.json',
    'platformatic.db.json5',
    'platformatic.db.yaml',
    'platformatic.db.yml',
    'platformatic.db.toml',
    'platformatic.db.tml'
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

function urlDirname (url) {
  return dirname(fileURLToPath(url))
}

function getJSPluginPath (tsPluginPath, compileDir) {
  const cwd = process.cwd()
  const tsPluginRelativePath = relative(cwd, tsPluginPath)
  const jsPluginRelativePath = join(
    dirname(tsPluginRelativePath),
    basename(tsPluginRelativePath, '.ts') + '.js'
  )
  return join(cwd, compileDir, jsPluginRelativePath)
}

module.exports = {
  setupDB,
  getJSPluginPath,
  isFileAccessible,
  addLoggerToTheConfig,
  findConfigFile,
  urlDirname
}
