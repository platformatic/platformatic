'use strict'

const { connect } = require('@platformatic/db-core')
const { sep } = require('path')
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

function computeSQLiteIgnores (sqliteFullPath, dirOfConfig) {
  let result = []
  const journalFullPath = sqliteFullPath + '-journal'
  // [windows] remove Backslash at the beginning
  if (sqliteFullPath.indexOf(dirOfConfig) === 0) {
    const sqliteRelativePath = sqliteFullPath.replace(dirOfConfig + sep, '')
    const journalRelativePath = journalFullPath.replace(dirOfConfig + sep, '')
    result = [sqliteRelativePath, journalRelativePath]
  }
  return result
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
  setupDB,
  computeSQLiteIgnores,
  addLoggerToTheConfig
}
