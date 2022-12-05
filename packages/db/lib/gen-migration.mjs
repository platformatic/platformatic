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
    throw new Error('Missing migrations in config file')
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
  } catch (err) {
    console.error(err.message)
    process.exit(1)
  }
}

export { generateMigration }
