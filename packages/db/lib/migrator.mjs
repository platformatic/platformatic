import { join, basename } from 'path'
import Postgrator from 'postgrator'
import { MigrateError } from './errors.mjs'
import { setupDB } from './utils.js'
import { stat } from 'fs/promises'

class Migrator {
  constructor (migrationConfig, coreConfig, logger) {
    this.coreConfig = coreConfig

    if (migrationConfig.dir === undefined) {
      throw new MigrateError('Migrations directory is not specified')
    }

    this.migrationDir = migrationConfig.dir
    this.migrationsTable = migrationConfig.table
    this.validateChecksums = migrationConfig.validateChecksums

    this.logger = logger

    this.db = null
    this.postgrator = null

    this.isClosing = false
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
      schemaTable: this.migrationsTable,
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
        throw new MigrateError(`Migrations directory ${this.migrationDir} does not exist.`)
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
      if (
        migration.action === 'do' &&
        migration.version > maxMigrationVersion
      ) {
        maxMigrationVersion = migration.version
      }
    }
    return maxMigrationVersion + 1
  }

  async close () {
    if (this.isClosing) {
      return
    }
    this.isClosing = true

    if (this.db !== null) {
      await this.db.dispose()
      this.db = null
      this.postgrator = null
    }
  }
}

async function execute (logger, args, config) {
  const migrationsConfig = config.migrations
  if (migrationsConfig === undefined) {
    throw new MigrateError('Missing migrations in config file')
  }

  const migrator = new Migrator(migrationsConfig, config.core, logger)

  try {
    if (args.rollback) {
      await migrator.rollbackMigration()
    } else {
      await migrator.applyMigrations(args.to)
    }
  } catch (error) {
    logger.error(error)
    throw error
  } finally {
    // Once done migrating, close your connection.
    await migrator.close()
  }
}

export { Migrator, execute }
