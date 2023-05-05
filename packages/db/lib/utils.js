'use strict'

const { access } = require('fs/promises')
const { connect } = require('@platformatic/db-core')
const { resolve, join, dirname } = require('path')
const { fileURLToPath } = require('url')
const fs = require('fs/promises')

async function setupDB (log, config) {
  const { db, sql, entities, dbschema } = await connect({ ...config, log })
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
    driver,
    dbschema
  }
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

function locateSchemaLock (configManager) {
  return configManager.current.db.schemalock.path ?? join(configManager.dirname, 'schema.lock')
}

async function updateSchemaLock (logger, configManager) {
  const config = configManager.current
  if (config.db.schemalock) {
    const conn = await setupDB(logger, config.db)
    const schemaLockPath = locateSchemaLock(configManager)
    await fs.writeFile(schemaLockPath, JSON.stringify(conn.dbschema, null, 2))

    await conn.db.dispose()
  }
}

module.exports = {
  setupDB,
  isFileAccessible,
  urlDirname,
  updateSchemaLock,
  locateSchemaLock
}
