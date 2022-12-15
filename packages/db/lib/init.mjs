import { writeFile, mkdir } from 'fs/promises'
import { join, relative, resolve } from 'path'
import pino from 'pino'
import pretty from 'pino-pretty'
import parseArgs from 'minimist'
import { checkForDependencies, generateGlobalTypesFile } from './gen-types.mjs'
import loadConfig from './load-config.mjs'
import { findConfigFile, isFileAccessible } from './utils.js'
import { generateJsonSchemaConfig, filenameConfigJsonSchema } from './gen-schema.mjs'

import { createDB } from 'create-platformatic'

function generateConfig (args) {
  const { migrations, plugin, types, typescript } = args

  /* c8 ignore next 1 */
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
      graphql: true,
      openapi: true
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

  await createDB(args, logger, process.cwd())

  // We need to do these here because platformatic-creator has NO dependencies to `db`.
  await generateJsonSchemaConfig()

  // const { migrations, typescript, plugin } = args
  // const createMigrations = !!migrations // If we don't define a migrations folder, we don't create it
  // const currentDir = process.cwd()
  // const accessibleConfigFilename = await findConfigFile(currentDir)
  // if (accessibleConfigFilename === undefined) {
  //   const config = generateConfig(args)
  //   await writeFile('platformatic.db.json', JSON.stringify(config, null, 2))
  //   logger.info('Configuration file platformatic.db.json successfully created.')

  //   const env = generateEnv(args)
  //   await writeFile('.env', env)
  //   await writeFile('.env.sample', env)
  //   logger.info('Environment file .env successfully created.')
  // } else {
  //   logger.info(`Configuration file ${accessibleConfigFilename} found, skipping creation of configuration file.`)
  // }

  // const { configManager } = await loadConfig({}, _args)
  // await configManager.parseAndValidate()
  // const config = configManager.current

  // const migrationsFolderName = migrations
  // if (createMigrations) {
  //   const isMigrationFolderExists = await isFileAccessible(migrationsFolderName, currentDir)
  //   if (!isMigrationFolderExists) {
  //     await mkdir(migrationsFolderName)
  //     logger.info(`Migrations folder ${migrationsFolderName} successfully created.`)
  //   } else {
  //     logger.info(`Migrations folder ${migrationsFolderName} found, skipping creation of migrations folder.`)
  //   }
  // }

  // const migrationFileNameDo = '001.do.sql'
  // const migrationFileNameUndo = '001.undo.sql'
  // const migrationFilePathDo = join(migrationsFolderName, migrationFileNameDo)
  // const migrationFilePathUndo = join(migrationsFolderName, migrationFileNameUndo)
  // const isMigrationFileDoExists = await isFileAccessible(migrationFilePathDo)
  // const isMigrationFileUndoExists = await isFileAccessible(migrationFilePathUndo)
  // if (!isMigrationFileDoExists && createMigrations) {
  //   await writeFile(migrationFilePathDo, moviesMigrationDo)
  //   logger.info(`Migration file ${migrationFileNameDo} successfully created.`)
  //   if (!isMigrationFileUndoExists) {
  //     await writeFile(migrationFilePathUndo, moviesMigrationUndo)
  //     logger.info(`Migration file ${migrationFileNameUndo} successfully created.`)
  //   }
  // } else {
  //   logger.info(`Migration file ${migrationFileNameDo} found, skipping creation of migration file.`)
  // }

  // if (typescript === true) {
  //   const tsConfigFileName = 'tsconfig.json'
  //   const isTsConfigExists = await isFileAccessible(tsConfigFileName)
  //   if (!isTsConfigExists) {
  //     const tsConfig = getTsConfig(config.plugin.typescript.outDir)
  //     await writeFile(tsConfigFileName, JSON.stringify(tsConfig, null, 2))
  //     logger.info(`Typescript configuration file ${tsConfigFileName} successfully created.`)
  //   } else {
  //     logger.info(`Typescript configuration file ${tsConfigFileName} found, skipping creation of typescript configuration file.`)
  //   }
  // }

  // if (plugin && config.types && config.types.autogenerate) {
  //   await generateGlobalTypesFile({}, config)
  //   await generatePluginWithTypesSupport(logger, args, configManager)
  //   await checkForDependencies(logger, args, config)
  // }
}

export { init }
