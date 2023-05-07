import { join, basename } from 'path'
import Postgrator from 'postgrator'
import { MigrateError } from './errors.mjs'
import { setupDB } from './utils.js'
import { stat } from 'fs/promises'

class Migrator {
  constructor (migrationConfig, coreConfig, logger) {
    this.coreConfig = coreConfig
    this.migrationDir = migrationConfig.dir
    this.migrationsTable = migrationConfig.table
    this.validateChecksums = migrationConfig.validateChecksums

    this.logger = logger

    this.db = null
    this.postgrator = null
  }

  async setupPostgrator () {
    if (this.postgrator instanceof Postgrator) return

    await this.checkMigrationsDirectoryExists()

    const { db, sql, driver } = await setupDB(this.logger, this.coreConfig)

    const database = driver !== 'sqlite3'
      ? new URL(this.coreConfig.connectionString).pathname.replace(/^\//, '')
      : ''

    this.db = db

    const migrationPattern = join(this.migrationDir, '*')
    this.logger.debug(`Migrating from ${migrationPattern}`)

    this.postgrator = new Postgrator({
      migrationPattern,
      driver,
      database,
      schemaTable: this.migrationsTable || 'versions',
      execQuery: async (query) => {
        const res = await db.query(sql`${sql.__dangerous__rawValue(query)}`)
        return { rows: res }
      },
      validateChecksums: this.validateChecksums
    })

    if (this.validateChecksums === true) {
      this.postgrator.on(
        'validation-started',
        (migration) => {
          /* c8 ignore next 3 */
          const migrationName = basename(migration.filename)
          this.logger.info(`verifying checksum of migration ${migrationName}`)
        }
      )
    }
    this.postgrator.on(
      'migration-started',
      (migration) => {
        const migrationName = basename(migration.filename)
        this.logger.info(`running ${migrationName}`)
      }
    )
    this.postgrator.on(
      'migration-finished',
      (migration) => {
        const migrationName = basename(migration.filename)
        this.logger.debug(`completed ${migrationName}`)
      }
    )
  }

  async checkMigrationsDirectoryExists () {
    try {
      await stat(this.migrationDir)
    } catch (err) {
      if (err.code === 'ENOENT') {
        throw new MigrateError(`Migrations directory ${this.migrationDir} does not exist`)
      }
    }
  }

  async applyMigrations (to) {
    await this.setupPostgrator()
    await this.postgrator.migrate(to)
  }

  async rollbackMigration () {
    await this.setupPostgrator()

    const migrations = await this.postgrator.getMigrations()
    const currentVersion = await this.postgrator.getDatabaseVersion()

    if (currentVersion === 0) {
      this.logger.info('No migrations to rollback')
      return
    }

    let prevMigrationVersion = 0
    for (const migration of migrations) {
      if (
        migration.action === 'undo' &&
        migration.version < currentVersion &&
        migration.version > prevMigrationVersion
      ) {
        prevMigrationVersion = migration.version
      }
    }

    const prevMigrationVersionStr = this.convertVersionToStr(prevMigrationVersion)
    await this.postgrator.migrate(prevMigrationVersionStr)
  }

  convertVersionToStr (version) {
    return version.toString().padStart(3, '0')
  }

  async getNextMigrationVersion () {
    await this.setupPostgrator()

    const migrations = await this.postgrator.getMigrations()
    const currentVersion = await this.postgrator.getDatabaseVersion()

    let maxMigrationVersion = currentVersion
    for (const migration of migrations) {
      if (migration.version > maxMigrationVersion) {
        maxMigrationVersion = migration.version
      }
    }
    return maxMigrationVersion + 1
  }

  async hasMigrationsToApply () {
    await this.setupPostgrator()

    const migrations = await this.postgrator.getMigrations()
    const currentVersion = await this.postgrator.getDatabaseVersion()

    for (const migration of migrations) {
      if (migration.version > currentVersion) {
        return true
      }
    }
    return false
  }

  async close () {
    if (this.db !== null) {
      await this.db.dispose()
      this.db = null
      this.postgrator = null
    }
  }
}

export { Migrator }
