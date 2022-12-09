import { join } from 'path'
import { writeFile } from 'fs/promises'
import pino from 'pino'
import pretty from 'pino-pretty'
import loadConfig from './load-config.mjs'
import { Migrator } from './migrator.mjs'

async function generateMigration (_args) {
  const logger = pino(pretty({
    translateTime: 'SYS:HH:MM:ss',
    ignore: 'hostname,pid'
  }))

  const { configManager } = await loadConfig({}, _args)
  await configManager.parseAndValidate()
  const config = configManager.current

  const migrationsConfig = config.migrations
  if (migrationsConfig === undefined) {
    logger.error('Missing migrations in config file')
  }

  const migrator = new Migrator(migrationsConfig, config.core, logger)

  try {
    const nextMigrationVersion = await migrator.getNextMigrationVersion()
    const nextMigrationVersionStr = migrator.convertVersionToStr(nextMigrationVersion)

    const nextDoMigrationName = `${nextMigrationVersionStr}.do.sql`
    const nextUndoMigrationName = `${nextMigrationVersionStr}.undo.sql`

    await Promise.all([
      writeFile(join(migrator.migrationDir, nextDoMigrationName), ''),
      writeFile(join(migrator.migrationDir, nextUndoMigrationName), '')
    ])
  } catch (error) {
    logger.error(error.message)
  } finally {
    await migrator.close()
  }
}

export { generateMigration }
