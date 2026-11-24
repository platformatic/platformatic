import { kMetadata, loadConfiguration } from '@platformatic/foundation'
import { mkdir, open, readdir, rm, writeFile } from 'node:fs/promises'
import { extname, join, relative } from 'node:path'
import { transform } from '../config.js'
import * as errors from '../errors.js'
import { Migrator } from '../migrator.js'
import { schema } from '../schema.js'

// The files Postgrator reads as migrations, and the actions it runs.
const migrationExtensions = new Set(['.sql', '.js', '.mjs', '.cjs'])
const migrationActions = new Set(['do', 'undo'])

// The version of a file Postgrator would run as a migration, or NaN.
function migrationVersion (file) {
  const [version, action] = file.split('.')
  return migrationExtensions.has(extname(file)) && migrationActions.has(action) ? Number(version) : NaN
}

// Creates an empty file, and never overwrites one: another create may have
// taken the name since the directory was read. Returns false in that case.
async function createFile (file) {
  let handle
  try {
    handle = await open(file, 'wx')
  } catch (err) {
    if (err.code === 'EEXIST') return false
    throw err
  }

  try {
    await handle.close()
  } catch (err) {
    // The file exists and is this call's: attempt to remove it.
    await rm(file, { force: true }).catch(() => {})
    throw err
  }
  return true
}

// Creates the pair of files named after the current UTC date and time
// (YYYYMMDDHHMMSS). When a migration with that version exists, or another
// create takes it first, the next free number is used.
export async function createTimestampMigrationFiles (migrationsDir, now = new Date()) {
  const files = await readdir(migrationsDir)
  const versions = new Set(files.map(migrationVersion))

  let version = Number(now.toISOString().replace(/\D/g, '').slice(0, 14))
  while (true) {
    if (!versions.has(version)) {
      // Fourteen digits also for a year below 1000.
      const name = version.toString().padStart(14, '0')
      const doFile = join(migrationsDir, `${name}.do.sql`)
      const undoFile = join(migrationsDir, `${name}.undo.sql`)

      if (await createFile(doFile)) {
        // If the undo file cannot be created, attempt to remove the do file
        // this call created.
        try {
          if (await createFile(undoFile)) {
            return { doFile, undoFile }
          }
        } catch (err) {
          // A failing removal must not hide the error that caused it.
          await rm(doFile, { force: true }).catch(() => {})
          throw err
        }
        // The undo name is taken: give the do file back and try the next
        // version. A do file that is already gone needs no removal.
        await rm(doFile, { force: true })
      }
    }
    version++
  }
}

export async function createMigrations (logger, configFile, _, { colorette: { bold } }) {
  const config = await loadConfiguration(configFile, schema, { transform })
  const root = config[kMetadata].root

  let migrator = null
  try {
    const migrationsConfig = config.migrations
    if (migrationsConfig === undefined) {
      throw new errors.MigrateMissingMigrationsError()
    }

    const createdDir = await mkdir(migrationsConfig.dir, { recursive: true })
    if (createdDir) {
      logger.info(`Created migrations directory ${bold(relative(root, migrationsConfig.dir))}.`)
    }

    let doFile
    let undoFile
    if (migrationsConfig.naming === 'timestamp') {
      // The name comes from the clock and the files: no database connection.
      ;({ doFile, undoFile } = await createTimestampMigrationFiles(migrationsConfig.dir))
    } else {
      migrator = new Migrator(migrationsConfig, config.db, logger)

      const nextMigrationVersion = await migrator.getNextMigrationVersion()
      const nextMigrationVersionStr = migrator.convertVersionToStr(nextMigrationVersion)

      const nextDoMigrationName = `${nextMigrationVersionStr}.do.sql`
      const nextUndoMigrationName = `${nextMigrationVersionStr}.undo.sql`

      doFile = join(migrator.migrationDir, nextDoMigrationName)
      undoFile = join(migrator.migrationDir, nextUndoMigrationName)

      await Promise.all([writeFile(doFile, ''), writeFile(undoFile, '')])
    }

    logger.info(`Created migration files ${bold(relative(root, doFile))} and ${bold(relative(root, undoFile))}.`)
  } catch (error) {
    logger.error(error.message)
  } finally {
    await migrator?.close()
  }
}

export const helpFooter = `
It will generate do and undo sql files in the migrations folder. By default the name of the files will be the next migration number.

The migration files are named \`001.<do|undo>.sql\`, \`002.<do|undo>.sql\` etc...

With \`"naming": "timestamp"\` in the \`migrations\` configuration, the name starts from the current UTC date and time instead, for example \`20260115103000.<do|undo>.sql\`, and moves to the next free number when that version is taken.

You can find more details about the configuration format here:
* [Platformatic DB Configuration](https://docs.platformatic.dev/docs/reference/db/configuration)
`
