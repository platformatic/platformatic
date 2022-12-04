import { writeFile, mkdir } from 'fs/promises'
import { join, relative, resolve } from 'path'
import pino from 'pino'
import pretty from 'pino-pretty'
import parseArgs from 'minimist'
import { checkForDependencies, generateGlobalTypesFile } from './gen-types.mjs'
import loadConfig from './load-config.mjs'
import { findConfigFile, isFileAccessible } from './utils.js'
import { generateJsonSchemaConfig, filenameConfigJsonSchema } from './gen-schema.mjs'

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

function generateConfig (args) {
  const { migrations, plugin, types, typescript } = args

  // c8 ignore next
  const migrationsFolder = migrations || 'migrations'

  const config = {
    $schema: `./${filenameConfigJsonSchema}`,
    server: {
      hostname: '{PLT_SERVER_HOSTNAME}',
      port: '{PORT}',
      logger: {
        level: '{PLT_SERVER_LOGGER_LEVEL}'
      }
    },
    core: {
      connectionString: '{DATABASE_URL}',
      graphql: true
    },
    migrations: { dir: migrationsFolder }
  }

  if (plugin === true) {
    config.plugin = {
      path: typescript === true ? 'plugin.ts' : 'plugin.js'
    }
  }

  if (types === true) {
    config.types = {
      autogenerate: true
    }
  }

  if (typescript === true) {
    config.plugin.typescript = {
      outDir: 'dist'
    }
  }

  return config
}

function generateEnv (args) {
  const { hostname, port, database } = args
  const connectionString = connectionStrings[database]
  const env = `
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

async function generatePluginWithTypesSupport (logger, args, configManager) {
  const config = configManager.current

  const pluginPath = resolve(process.cwd(), config.plugin.path)
  const isTypescript = config.plugin.typescript !== undefined

  const isPluginExists = await isFileAccessible(pluginPath)
  if (isPluginExists) return

  const pluginTemplate = isTypescript
    ? TS_PLUGIN_WITH_TYPES_SUPPORT
    : JS_PLUGIN_WITH_TYPES_SUPPORT

  await writeFile(pluginPath, pluginTemplate)

  logger.info(`Plugin file created at ${relative(process.cwd(), pluginPath)}`)
}

async function init (_args) {
  const logger = pino(pretty({
    translateTime: 'SYS:HH:MM:ss',
    ignore: 'hostname,pid'
  }))

  const args = parseArgs(_args, {
    default: {
      hostname: '127.0.0.1',
      port: 3042,
      database: 'sqlite',
      migrations: 'migrations',
      plugin: true,
      types: true,
      typescript: false
    },
    alias: {
      h: 'hostname',
      p: 'port',
      pl: 'plugin',
      db: 'database',
      m: 'migrations',
      t: 'types',
      ts: 'typescript'
    },
    boolean: ['plugin', 'types', 'typescript']
  })

  const { migrations, typescript, plugin } = args
  const createMigrations = !!migrations // If we don't define a migrations folder, we don't create it
  console.log('createMigrations@@@@@@@@@@@@@@@@@@@@@@@@@@@@', createMigrations, migrations)
  const currentDir = process.cwd()
  const accessibleConfigFilename = await findConfigFile(currentDir)
  if (accessibleConfigFilename === undefined) {
    const config = generateConfig(args)
    await generateJsonSchemaConfig()
    await writeFile('platformatic.db.json', JSON.stringify(config, null, 2))
    logger.info('Configuration file platformatic.db.json successfully created.')

    const env = generateEnv(args)
    await writeFile('.env', env)
    await writeFile('.env.sample', env)
    logger.info('Environment file .env successfully created.')
  } else {
    logger.info(`Configuration file ${accessibleConfigFilename} found, skipping creation of configuration file.`)
  }

  const { configManager } = await loadConfig({}, _args)
  await configManager.parseAndValidate()
  const config = configManager.current

  const migrationsFolderName = migrations
  if (createMigrations) {
    const isMigrationFolderExists = await isFileAccessible(migrationsFolderName, currentDir)
    if (!isMigrationFolderExists) {
      await mkdir(migrationsFolderName)
      logger.info(`Migrations folder ${migrationsFolderName} successfully created.`)
    } else {
      logger.info(`Migrations folder ${migrationsFolderName} found, skipping creation of migrations folder.`)
    }
  }

  const migrationFileNameDo = '001.do.sql'
  const migrationFileNameUndo = '001.undo.sql'
  const migrationFilePathDo = join(migrationsFolderName, migrationFileNameDo)
  const migrationFilePathUndo = join(migrationsFolderName, migrationFileNameUndo)
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
    const tsConfigFileName = 'tsconfig.json'
    const isTsConfigExists = await isFileAccessible(tsConfigFileName)
    if (!isTsConfigExists) {
      const tsConfig = getTsConfig(config.plugin.typescript.outDir)
      await writeFile(tsConfigFileName, JSON.stringify(tsConfig, null, 2))
      logger.info(`Typescript configuration file ${tsConfigFileName} successfully created.`)
    } else {
      logger.info(`Typescript configuration file ${tsConfigFileName} found, skipping creation of typescript configuration file.`)
    }
  }

  if (plugin && config.types && config.types.autogenerate) {
    await generateGlobalTypesFile({}, config)
    await generatePluginWithTypesSupport(logger, args, configManager)
    await checkForDependencies(logger, args, config)
  }
}

export { init }
