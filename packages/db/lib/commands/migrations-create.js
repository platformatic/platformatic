import { kMetadata, loadConfiguration } from '@platformatic/foundation'
import { writeFile } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { transform } from '../config.js'
import * as errors from '../errors.js'
import { Migrator } from '../migrator.js'
import { schema } from '../schema.js'

export async function createMigrations (logger, configFile, _, { colorette: { bold } }) {
  const config = await loadConfiguration(configFile, schema, { transform })
  const root = config[kMetadata].root

  let migrator = null
  try {
    const migrationsConfig = config.migrations
    if (migrationsConfig === undefined) {
      throw new errors.MigrateMissingMigrationsError()
    }

    migrator = new Migrator(migrationsConfig, config.db, logger)

    const nextMigrationVersion = await migrator.getNextMigrationVersion()
    const nextMigrationVersionStr = migrator.convertVersionToStr(nextMigrationVersion)

    const nextDoMigrationName = `${nextMigrationVersionStr}.do.sql`
    const nextUndoMigrationName = `${nextMigrationVersionStr}.undo.sql`

    const doFile = join(migrator.migrationDir, nextDoMigrationName)
    const undoFile = join(migrator.migrationDir, nextUndoMigrationName)

    await Promise.all([writeFile(doFile, ''), writeFile(undoFile, '')])

    logger.info(`Created migration files ${bold(relative(root, doFile))} and ${bold(relative(root, undoFile))}.`)
  } catch (error) {
    logger.error(error.message)
  } finally {
    await migrator?.close()
  }
}

export const helpFooter = `
It will generate do and undo sql files in the migrations folder. The name of the files will be the next migration number.

The migration files are named \`001.<do|undo>.sql\`, \`002.<do|undo>.sql\` etc...

You can find more details about the configuration format here:
* [Platformatic DB Configuration](https://docs.platformatic.dev/docs/db/configuration)
`
