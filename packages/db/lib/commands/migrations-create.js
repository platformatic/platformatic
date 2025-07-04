'use strict'

const { loadConfig } = require('@platformatic/config')
const { writeFile } = require('node:fs/promises')
const { createRequire } = require('node:module')
const { relative, join } = require('node:path')
const errors = require('../errors.js')
const { Migrator } = require('../migrator.js')
const { loadModule } = require('@platformatic/utils')

async function createMigrations (logger, configFile, _, { colorette: { bold } }) {
  const platformaticDB = await loadModule(createRequire(__filename), '../../index.js')
  const { configManager } = await loadConfig({}, ['-c', configFile], platformaticDB)
  await configManager.parseAndValidate()
  const config = configManager.current

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

    logger.info(
      `Created migration files ${bold(relative(process.cwd(), doFile))} and ${bold(relative(process.cwd(), undoFile))}.`
    )
  } catch (error) {
    logger.error(error.message)
  } finally {
    await migrator?.close()
  }
}

const helpFooter = `
It will generate do and undo sql files in the migrations folder. The name of the files will be the next migration number.

The migration files are named \`001.<do|undo>.sql\`, \`002.<do|undo>.sql\` etc...

You can find more details about the configuration format here:
* [Platformatic DB Configuration](https://docs.platformatic.dev/docs/db/configuration)
`

module.exports = { createMigrations, helpFooter }
