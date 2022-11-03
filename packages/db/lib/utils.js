'use strict'

const { dirname } = require('path')
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

module.exports = {
  setupDB,
  isFileAccessible,
  findConfigFile,
  urlDirname
}
