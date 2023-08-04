import { writeFile, mkdir, appendFile } from 'fs/promises'
import { join, relative, resolve } from 'path'
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
    await generatePlugins(logger, currentDir, typescript, 'db')
  }

  return {
    DATABASE_URL: connectionString,
    PLT_SERVER_LOGGER_LEVEL: 'info',
    PORT: port,
    PLT_SERVER_HOSTNAME: hostname
  }
}

export default createDB
