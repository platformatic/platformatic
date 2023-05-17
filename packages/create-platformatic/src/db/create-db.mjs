import { writeFile, mkdir, appendFile } from 'fs/promises'
import { join, relative, resolve } from 'path'
import { findDBConfigFile, isFileAccessible } from '../utils.mjs'

const connectionStrings = {
  postgres: 'postgres://postgres:postgres@localhost:5432/postgres',
  sqlite: 'sqlite://./db.sqlite',
  mysql: 'mysql://root@localhost:3306/graph',
  mysql8: 'mysql://root@localhost:3308/graph',
  mariadb: 'mysql://root@localhost:3307/graph'
}

const moviesMigrationDo = `
-- Add SQL in this file to create the database tables for your API
CREATE TABLE IF NOT EXISTS movies (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL
);
`

const moviesMigrationUndo = `
-- Add SQL in this file to drop the database tables 
DROP TABLE movies;
`

function getTsConfig (outDir) {
  return {
    compilerOptions: {
      module: 'commonjs',
      esModuleInterop: true,
      target: 'es6',
      sourceMap: true,
      pretty: true,
      noEmitOnError: true,
      outDir
    },
    watchOptions: {
      watchFile: 'fixedPollingInterval',
      watchDirectory: 'fixedPollingInterval',
      fallbackPolling: 'dynamicPriority',
      synchronousWatchDirectory: true,
      excludeDirectories: ['**/node_modules', outDir]
    }
  }
}

const getPluginName = (isTypescript) => isTypescript === true ? 'plugin.ts' : 'plugin.js'
const TS_OUT_DIR = 'dist'

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
      openapi: true
    }
  }

  if (migrations) {
    config.migrations = {
      dir: migrations
    }
  }

  if (plugin === true) {
    config.plugins = {
      paths: [getPluginName(typescript)]
    }
  }

  if (types === true) {
    config.types = {
      autogenerate: true
    }
  }

  if (typescript === true) {
    config.plugins.typescript = true
  }

  return config
}

function generateEnv (hostname, port, database) {
  const connectionString = connectionStrings[database]
  const env = `\
PLT_SERVER_HOSTNAME=${hostname}
PORT=${port}
PLT_SERVER_LOGGER_LEVEL=info
DATABASE_URL=${connectionString}
`
  return env
}

const JS_PLUGIN_WITH_TYPES_SUPPORT = `\
/// <reference path="./global.d.ts" />
'use strict'

/** @param {import('fastify').FastifyInstance} app */
module.exports = async function (app) {}
`

const TS_PLUGIN_WITH_TYPES_SUPPORT = `\
/// <reference path="./global.d.ts" />
import { FastifyInstance } from 'fastify'

export default async function (app: FastifyInstance) {}
`

async function generatePluginWithTypesSupport (logger, currentDir, isTypescript) {
  const pluginPath = resolve(currentDir, getPluginName(isTypescript))

  const isPluginExists = await isFileAccessible(pluginPath)
  if (isPluginExists) {
    logger.info(`Plugin file ${pluginPath} found, skipping creation of plugin file.`)
    return
  }

  const pluginTemplate = isTypescript
    ? TS_PLUGIN_WITH_TYPES_SUPPORT
    : JS_PLUGIN_WITH_TYPES_SUPPORT

  await writeFile(pluginPath, pluginTemplate)
  logger.info(`Plugin file created at ${relative(currentDir, pluginPath)}`)
}

async function createDB ({ hostname, database = 'sqlite', port, migrations = 'migrations', plugin = true, types = true, typescript = false }, logger, currentDir, version) {
  const createMigrations = !!migrations // If we don't define a migrations folder, we don't create it
  const accessibleConfigFilename = await findDBConfigFile(currentDir)
  if (accessibleConfigFilename === undefined) {
    const config = generateConfig(migrations, plugin, types, typescript, version)
    await writeFile(join(currentDir, 'platformatic.db.json'), JSON.stringify(config, null, 2))
    logger.info('Configuration file platformatic.db.json successfully created.')

    const env = generateEnv(hostname, port, database)
    const envFileExists = await isFileAccessible('.env', currentDir)
    await appendFile(join(currentDir, '.env'), env)
    await writeFile(join(currentDir, '.env.sample'), env)
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
    await writeFile(migrationFilePathDo, moviesMigrationDo)
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
    await generatePluginWithTypesSupport(logger, currentDir, typescript)
  }

  return {
    DATABASE_URL: connectionStrings[database],
    PLT_SERVER_LOGGER_LEVEL: 'info',
    PORT: port,
    PLT_SERVER_HOSTNAME: hostname
  }
}

export default createDB
