import { join } from 'path'
import { writeFile } from 'fs/promises'
import pino from 'pino'
import pretty from 'pino-pretty'
import loadConfig from './load-config.mjs'
import { Migrator } from './migrator.mjs'
import { MigrateError } from './errors.mjs'

async function generateMigration (_args) {
  const logger = pino(pretty({
    translateTime: 'SYS:HH:MM:ss',
    ignore: 'hostname,pid'
  }))

  const { configManager } = await loadConfig({}, _args)
  await configManager.parseAndValidate()
  const config = configManager.current

  let migrator = null
  try {
    const migrationsConfig = config.migrations
    if (migrationsConfig === undefined) {
      throw new MigrateError('Missing "migrations" section in config file')
    }

    migrator = new Migrator(migrationsConfig, config.db, logger)

    const nextMigrationVersion = await migrator.getNextMigrationVersion()
    const nextMigrationVersionStr = migrator.convertVersionToStr(nextMigrationVersion)

    const nextDoMigrationName = `${nextMigrationVersionStr}.do.sql`
    const nextUndoMigrationName = `${nextMigrationVersionStr}.undo.sql`

    const doFile = join(migrator.migrationDir, nextDoMigrationName)
    const undoFile = join(migrator.migrationDir, nextUndoMigrationName)

    await Promise.all([
      writeFile(doFile, ''),
      writeFile(undoFile, '')
    ])

    logger.info({ do: doFile, undo: undoFile }, 'Created migration files')
  } catch (error) {
    logger.error(error.message)
  } finally {
    if (migrator !== null) {
      await migrator.close()
    }
  }
}

export { generateMigration }
