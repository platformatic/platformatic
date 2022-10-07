import { readdir, stat, writeFile } from 'fs/promises'
import path from 'path'
import loadConfig from './load-config.mjs'

async function generateMigration (_args) {
  const { configManager } = await loadConfig({}, _args)
  await configManager.parseAndValidate()
  const migrationsDir = configManager.current.migrations.dir

  try {
    // Check migrations directory exists
    await checkMigrationsDirectoryExists(migrationsDir)
    const files = await readdir(migrationsDir)

    const nextMigrationId = getNextMigrationId(files)

    const nextDoMigrationName = `${nextMigrationId.toString().padStart(3, '0')}.do.sql`
    await generateMigrationFile(migrationsDir, nextDoMigrationName)

    const nextUndoMigrationName = `${nextMigrationId.toString().padStart(3, '0')}.undo.sql`
    await generateMigrationFile(migrationsDir, nextUndoMigrationName)
  } catch (err) {
    console.error(err.message)
    process.exit(1)
  }
}

function getNextMigrationId (migrationFileNames) {
  const sortedMigrationFiles = migrationFileNames.filter(migrationFile => path.extname(migrationFile) === '.sql').sort()
  if (sortedMigrationFiles.length === 0) {
    return 1
  }

  const lastMigrationFileName = sortedMigrationFiles.pop()

  const chunks = path.basename(lastMigrationFileName).split('.')
  const migrationId = parseInt(chunks[0])

  /* c8 ignore next 3 */
  if (isNaN(migrationId)) {
    throw new Error('Previous migration has corrupted name')
  }

  const nextId = migrationId + 1
  return nextId
}

async function generateMigrationFile (migrationDir, id) {
  const newMigrationFilePath = path.join(migrationDir, id)
  await writeFile(newMigrationFilePath, '')
}

// TODO How to fix the duplication ?
async function checkMigrationsDirectoryExists (dirName) {
  try {
    await stat(dirName)
  } catch (err) {
    if (err.code === 'ENOENT') {
      throw new Error(`Migrations directory ${dirName} does not exist.`)
    }
  }
}

export { generateMigration }
