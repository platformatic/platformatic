import { join, basename } from 'path'
import Postgrator from 'postgrator'
import { MigrateError } from './errors.mjs'
import { setupDB } from './utils.js'
import { stat } from 'fs/promises'
async function execute (logger, args, config) {
  const migrationsConfig = config.migrations
  if (!migrationsConfig || !migrationsConfig.dir) {
    throw new MigrateError('Missing migrations in config file')
  }
  // Check migrations directory exists
  await checkMigrationsDirectoryExists(migrationsConfig.dir)

  const { db, sql, driver } = await setupDB(logger, config.core)

  const database = driver !== 'sqlite3' ? new URL(config.core.connectionString).pathname.replace(/^\//, '') : ''
  try {
    const migrationsFolder = join(migrationsConfig.dir, '*')
    logger.debug(`Migrating from ${migrationsFolder}`)
    // Create postgrator instance
    const postgrator = new Postgrator({
      migrationPattern: migrationsFolder,
      driver,
      database,
      schemaTable: migrationsConfig.table,
      execQuery: async (query) => {
        const res = await db.query(sql`${sql.__dangerous__rawValue(query)}`)
        return {
          rows: res
        }
      },
      validateChecksums: migrationsConfig.validateChecksums === true
    })
    if (migrationsConfig.validateChecksums === true) {
      postgrator.on(
        'validation-started',
        (migration) => logger.info(`verifying checksum of migration ${basename(migration.filename)}`)
      )
    }
    postgrator.on(
      'migration-started',
      (migration) => logger.info(`running ${basename(migration.filename)}`)
    )
    postgrator.on(
      'migration-finished',
      (migration) => logger.debug(`completed ${basename(migration.filename)}`)
    )

    await postgrator.migrate(args.to)
  } catch (error) {
    logger.error(error)
  }

  // Once done migrating, close your connection.
  await db.dispose()
}
async function checkMigrationsDirectoryExists (dirName) {
  try {
    await stat(dirName)
  } catch (err) {
    if (err.code === 'ENOENT') {
      throw new MigrateError(`Migrations directory ${dirName} does not exist.`)
    }
  }
}
export { execute }
