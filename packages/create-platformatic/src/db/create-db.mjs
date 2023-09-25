import { writeFile, mkdir, appendFile } from 'fs/promises'
import { join } from 'path'
import { findDBConfigFile, isFileAccessible } from '../utils.mjs'
import { getTsConfig } from '../get-tsconfig.mjs'
import { generatePlugins } from '../create-plugins.mjs'

const connectionStrings = {
  postgres: 'postgres://postgres:postgres@127.0.0.1:5432/postgres',
  sqlite: 'sqlite://./db.sqlite',
  mysql: 'mysql://root@127.0.0.1:3306/platformatic',
  mariadb: 'mysql://root@127.0.0.1:3306/platformatic'
}

const moviesMigrationDo = (database) => {
  const key = {
    postgres: 'SERIAL',
    sqlite: 'INTEGER',
    mysql: 'INTEGER UNSIGNED AUTO_INCREMENT',
    mariadb: 'INTEGER UNSIGNED AUTO_INCREMENT'
  }

  return `
-- Add SQL in this file to create the database tables for your API
CREATE TABLE IF NOT EXISTS movies (
  id ${key[database]} PRIMARY KEY,
  title TEXT NOT NULL
);
`
}

const moviesMigrationUndo = `
-- Add SQL in this file to drop the database tables 
DROP TABLE movies;
`

const TS_OUT_DIR = 'dist'

const jsHelperSqlite = {
  requires: `
const os = require('node:os')
const path = require('node:path')
const fs = require('node:fs/promises')

let counter = 0
`,
  pre: `
  const dbPath = join(os.tmpdir(), 'db-' + process.pid + '-' + counter++ + '.sqlite')
  const connectionString = 'sqlite://' + dbPath
`,
  config: `
  config.migrations.autoApply = true
  config.types.autogenerate = false
  config.db.connectionString = connectionString
`,
  post: `
  t.after(async () => {
    await fs.unlink(dbPath)
  })
`
}

function jsHelperPostgres (connectionString) {
  return {
    // TODO(mcollina): replace sql-mapper
    requires: `
const { createConnectionPool } = require('@platformatic/sql-mapper')
const connectionString = '${connectionString}'
let counter = 0
`,
    pre: `
  const { db, sql } = await createConnectionPool({
    log: {
      debug: () => {},
      info: () => {},
      trace: () => {}
    },
    connectionString,
    poolSize: 1
  })

  const newDB = \`t-\${process.pid}-\${counter++}\`
  t.diagnostic('Creating database ' + newDB)

  await db.query(sql\`
    CREATE DATABASE \${sql.ident(newDB)}
  \`)
`,
    config: `
  config.migrations.autoApply = true
  config.types.autogenerate = false
  config.db.connectionString = connectionString.replace(/\\/[a-zA-Z0-9\\-_]+$/, '/' + newDB)
  config.db.schemalock = false
`,
    post: `
  t.after(async () => {
    t.diagnostic('Disposing test database ' + newDB)
    await db.query(sql\`
      DROP DATABASE \${sql.ident(newDB)}
    \`)
    await db.dispose()
  })
`
  }
}

function jsHelperMySQL (connectionString) {
  return {
    // TODO(mcollina): replace sql-mapper
    requires: `
const { createConnectionPool } = require('@platformatic/sql-mapper')
const connectionString = '${connectionString}'
let counter = 0
`,
    pre: `
  const { db, sql } = await createConnectionPool({
    log: {
      debug: () => {},
      info: () => {},
      trace: () => {}
    },
    connectionString,
    poolSize: 1
  })

  const newDB = \`t-\${process.pid}-\${counter++}\`
  t.diagnostic('Creating database ' + newDB)

  await db.query(sql\`
    CREATE DATABASE \${sql.ident(newDB)}
  \`)
`,
    config: `
  config.migrations.autoApply = true
  config.types.autogenerate = false
  config.db.connectionString = connectionString.replace(/\\/[a-zA-Z0-9\\-_]+$/, '/' + newDB)
  config.db.schemalock = false
`,
    post: `
  t.after(async () => {
    t.diagnostic('Disposing test database ' + newDB)
    await db.query(sql\`
      DROP DATABASE \${sql.ident(newDB)}
    \`)
    await db.dispose()
  })
`
  }
}

const moviesTestJS = `\
'use strict'

const test = require('node:test')
const assert = require('node:assert')
const { getServer } = require('../helper')

test('movies', async (t) => {
  const server = await getServer(t)

  {
    const res = await server.inject({
      method: 'GET',
      url: '/movies'
    })

    assert.strictEqual(res.statusCode, 200)
    assert.deepStrictEqual(res.json(), [])
  }

  let id
  {
    const res = await server.inject({
      method: 'POST',
      url: '/movies',
      body: {
        title: 'The Matrix'
      }
    })

    assert.strictEqual(res.statusCode, 200)
    const body = res.json()
    assert.strictEqual(body.title, 'The Matrix')
    assert.strictEqual(body.id !== undefined, true)
    id = body.id
  }

  {
    const res = await server.inject({
      method: 'GET',
      url: '/movies'
    })

    assert.strictEqual(res.statusCode, 200)
    assert.deepStrictEqual(res.json(), [{
      id,
      title: 'The Matrix'
    }])
  }
})
`

const moviesTestTS = `\
import test from 'node:test'
import assert from 'node:assert'
import { getServer } from '../helper'

test('movies', async (t) => {
  const server = await getServer(t)

  {
    const res = await server.inject({
      method: 'GET',
      url: '/movies'
    })

    assert.strictEqual(res.statusCode, 200)
    assert.deepStrictEqual(res.json(), [])
  }

  let id : Number
  {
    const res = await server.inject({
      method: 'POST',
      url: '/movies',
      body: {
        title: 'The Matrix'
      }
    })

    assert.strictEqual(res.statusCode, 200)
    const body = res.json()
    assert.strictEqual(body.title, 'The Matrix')
    assert.strictEqual(body.id !== undefined, true)
    id = body.id as Number
  }

  {
    const res = await server.inject({
      method: 'GET',
      url: '/movies'
    })

    assert.strictEqual(res.statusCode, 200)
    assert.deepStrictEqual(res.json(), [{
      id,
      title: 'The Matrix'
    }])
  }
})
`

function generateConfig (migrations, plugin, types, typescript, version) {
  const config = {
    $schema: `https://platformatic.dev/schemas/v${version}/db`,
    server: {
      hostname: '{PLT_SERVER_HOSTNAME}',
      port: '{PORT}',
      logger: {
        level: '{PLT_SERVER_LOGGER_LEVEL}'
      }
    },
    db: {
      connectionString: '{DATABASE_URL}',
      graphql: true,
      openapi: true,
      schemalock: true
    },
    watch: {
      ignore: ['*.sqlite', '*.sqlite-journal']
    }
  }

  if (migrations) {
    config.migrations = {
      dir: migrations
    }
  }

  if (plugin === true) {
    config.plugins = {
      paths: [{
        path: './plugins',
        encapsulate: false
      }, {
        path: './routes'
      }]
    }
  }

  if (types === true) {
    config.types = {
      autogenerate: true
    }
  }

  if (typescript === true) {
    config.plugins.typescript = '{PLT_TYPESCRIPT}'
  }

  return config
}

function generateEnv (hostname, port, connectionString, typescript) {
  let env = `\
PLT_SERVER_HOSTNAME=${hostname}
PORT=${port}
PLT_SERVER_LOGGER_LEVEL=info
DATABASE_URL=${connectionString}
`

  if (typescript === true) {
    env += `\

# Set to false to disable automatic typescript compilation.
# Changing this setting is needed for production
PLT_TYPESCRIPT=true
`
  }

  return env
}

export function getConnectionString (database) {
  return connectionStrings[database]
}

export async function createDB ({ hostname, database = 'sqlite', port, migrations = 'migrations', plugin = true, types = true, typescript = false, connectionString }, logger, currentDir, version) {
  connectionString = connectionString || getConnectionString(database)
  const createMigrations = !!migrations // If we don't define a migrations folder, we don't create it
  const accessibleConfigFilename = await findDBConfigFile(currentDir)
  if (accessibleConfigFilename === undefined) {
    const config = generateConfig(migrations, plugin, types, typescript, version)
    await writeFile(join(currentDir, 'platformatic.db.json'), JSON.stringify(config, null, 2))
    logger.info('Configuration file platformatic.db.json successfully created.')
    const env = generateEnv(hostname, port, connectionString, typescript)
    const envFileExists = await isFileAccessible('.env', currentDir)
    await appendFile(join(currentDir, '.env'), env)
    await writeFile(join(currentDir, '.env.sample'), generateEnv(hostname, port, getConnectionString(database), typescript))
    /* c8 ignore next 5 */
    if (envFileExists) {
      logger.info('Environment file .env found, appending new environment variables to existing .env file.')
    } else {
      logger.info('Environment file .env successfully created.')
    }
  } else {
    logger.info(`Configuration file ${accessibleConfigFilename} found, skipping creation of configuration file.`)
  }

  const migrationsFolderName = migrations
  if (createMigrations) {
    const isMigrationFolderExists = await isFileAccessible(migrationsFolderName, currentDir)
    if (!isMigrationFolderExists) {
      await mkdir(join(currentDir, migrationsFolderName))
      logger.info(`Migrations folder ${migrationsFolderName} successfully created.`)
    } else {
      logger.info(`Migrations folder ${migrationsFolderName} found, skipping creation of migrations folder.`)
    }
  }

  const migrationFileNameDo = '001.do.sql'
  const migrationFileNameUndo = '001.undo.sql'
  const migrationFilePathDo = join(currentDir, migrationsFolderName, migrationFileNameDo)
  const migrationFilePathUndo = join(currentDir, migrationsFolderName, migrationFileNameUndo)
  const isMigrationFileDoExists = await isFileAccessible(migrationFilePathDo)
  const isMigrationFileUndoExists = await isFileAccessible(migrationFilePathUndo)
  if (!isMigrationFileDoExists && createMigrations) {
    await writeFile(migrationFilePathDo, moviesMigrationDo(database))
    logger.info(`Migration file ${migrationFileNameDo} successfully created.`)
    if (!isMigrationFileUndoExists) {
      await writeFile(migrationFilePathUndo, moviesMigrationUndo)
      logger.info(`Migration file ${migrationFileNameUndo} successfully created.`)
    }
  } else {
    logger.info(`Migration file ${migrationFileNameDo} found, skipping creation of migration file.`)
  }

  if (typescript === true) {
    const tsConfigFileName = join(currentDir, 'tsconfig.json')
    const isTsConfigExists = await isFileAccessible(tsConfigFileName)
    if (!isTsConfigExists) {
      const tsConfig = getTsConfig(TS_OUT_DIR)
      await writeFile(tsConfigFileName, JSON.stringify(tsConfig, null, 2))
      logger.info(`Typescript configuration file ${tsConfigFileName} successfully created.`)
    } else {
      logger.info(`Typescript configuration file ${tsConfigFileName} found, skipping creation of typescript configuration file.`)
    }
  }

  if (plugin) {
    let jsHelper = { pre: '', config: '', post: '' }
    switch (database) {
      case 'sqlite':
        jsHelper = jsHelperSqlite
        break
      case 'mysql':
        jsHelper = jsHelperMySQL(connectionString)
        break
      case 'postgres':
        jsHelper = jsHelperPostgres(connectionString)
        break
      case 'mariadb':
        jsHelper = jsHelperMySQL(connectionString)
        break
    }
    await generatePlugins(logger, currentDir, typescript, 'db', jsHelper)

    if (createMigrations) {
      if (typescript) {
        await writeFile(join(currentDir, 'test', 'routes', 'movies.test.ts'), moviesTestTS)
      } else {
        await writeFile(join(currentDir, 'test', 'routes', 'movies.test.js'), moviesTestJS)
      }
    }
  }

  const output = {
    DATABASE_URL: connectionString,
    PLT_SERVER_LOGGER_LEVEL: 'info',
    PORT: port,
    PLT_SERVER_HOSTNAME: hostname
  }

  if (typescript) {
    output.PLT_TYPESCRIPT = true
  }
  return output
}

export default createDB
