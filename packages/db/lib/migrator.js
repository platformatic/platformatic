import { createConnectionPool } from '@platformatic/sql-mapper'
import { readdir, stat } from 'node:fs/promises'
import { basename } from 'node:path'
import Postgrator from 'postgrator'
import { ApplyMigrationError, MigrateMissingMigrationsDirError, MigrateMissingMigrationsError } from './errors.js'
import { splitSQLiteStatements } from './split-sqlite-statements.js'

export class Migrator {
  constructor (migrationConfig, coreConfig, logger) {
    this.coreConfig = coreConfig
    this.migrationDir = migrationConfig.dir
    this.migrationsTable = migrationConfig.table
    // Default to true when unset, matching Postgrator's own default. Passing an
    // explicit `undefined` here would override that default in Postgrator's
    // `Object.assign` merge and silently disable checksum validation.
    this.validateChecksums = migrationConfig.validateChecksums ?? true
    this.newline = migrationConfig.newline
    this.currentSchema = migrationConfig.currentSchema

    this.logger = logger

    this.db = null
    this.sqliteDb = null
    this.postgrator = null
    this.appliedMigrationsCount = 0
    this.lastStartedMigration = null
  }

  async setupPostgrator () {
    this.appliedMigrationsCount = 0
    if (this.postgrator instanceof Postgrator) return

    await this.checkMigrationsDirectoryExists()

    const { db, sql } = await createConnectionPool({
      ...this.coreConfig,
      log: this.logger
    })

    let driver

    /* c8 ignore next 11 */
    if (db.isPg) {
      driver = 'pg'
    } else if (db.isMySql) {
      driver = 'mysql'
    } else if (db.isMariaDB) {
      driver = 'mysql'
    } else if (db.isSQLite) {
      driver = 'sqlite3'
    }

    const database = driver !== 'sqlite3' ? new URL(this.coreConfig.connectionString).pathname.replace(/^\//, '') : ''

    this.db = db

    /* c8 ignore next 6 */
    if (driver === 'sqlite3') {
      const { DatabaseSync } = await import('node:sqlite')
      const connectionString = this.coreConfig.connectionString
      this.sqliteDb = new DatabaseSync(
        connectionString === 'sqlite://:memory:' ? ':memory:' : connectionString.replace('sqlite://', '')
      )
    }

    // Glob patterns should always use / as a path separator, even on Windows systems, as \ is used to escape glob characters.
    const migrationPattern = this.migrationDir + '/*'
    this.logger.debug(`Migrating from ${migrationPattern}`)

    this.postgrator = new Postgrator({
      migrationPattern,
      driver,
      database,
      schemaTable: this.migrationsTable || 'versions',
      execQuery: async query => {
        // The SQLite pool splits scripts with a generic splitter which
        // breaks on the semicolons inside CREATE TRIGGER bodies and fails
        // on scripts only containing comments. Split the script with a
        // SQLite aware splitter and run each statement on a raw connection,
        // whose prepare() handles trigger bodies correctly.
        if (driver === 'sqlite3') {
          let rows = []
          for (const statement of splitSQLiteStatements(query)) {
            rows = this.runSQLiteStatement(statement)
          }
          return { rows }
        }

        const res = await db.query(sql`${sql.__dangerous__rawValue(query)}`)
        return { rows: res }
      },
      validateChecksums: this.validateChecksums,
      newline: this.newline,
      currentSchema: ['pg', 'mysql'].includes(driver) ? this.currentSchema : undefined
    })

    if (this.validateChecksums === true) {
      this.postgrator.on('validation-started', migration => {
        /* c8 ignore next 3 */
        const migrationName = basename(migration.filename)
        this.logger.info(`verifying checksum of migration ${migrationName}`)
      })
    }
    this.postgrator.on('migration-started', migration => {
      this.lastStartedMigration = migration
      const migrationName = basename(migration.filename)
      this.logger.info(`running ${migrationName}`)
    })
    this.postgrator.on('migration-finished', migration => {
      this.lastStartedMigration = null
      this.appliedMigrationsCount++
      const migrationName = basename(migration.filename)
      this.logger.debug(`completed ${migrationName}`)
    })
  }

  runSQLiteStatement (text) {
    return this.sqliteDb.prepare(text).all()
  }

  async checkMigrationsDirectoryExists () {
    try {
      await stat(this.migrationDir)
    } catch (err) {
      if (err.code === 'ENOENT') {
        throw new MigrateMissingMigrationsDirError(this.migrationDir)
      }
    }
  }

  async applyMigrations (to) {
    await this.checkIfMigrationFilesExist()
    await this.setupPostgrator()
    await this.migrate(to)
  }

  async migrate (to) {
    try {
      await this.postgrator.migrate(to)
    } catch (error) {
      // A migration started but did not finish: give the user a clear
      // pointer to the file that could not be applied
      if (this.lastStartedMigration) {
        throw new ApplyMigrationError(basename(this.lastStartedMigration.filename), error.message)
      }
      throw error
    }
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
    await this.migrate(prevMigrationVersionStr)
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

  async checkIfMigrationFilesExist () {
    try {
      const files = await readdir(this.migrationDir)
      if (files.length === 0) {
        this.logger.warn(`No migration files in ${this.migrationDir}`)
      }
    } catch (err) {
      if (err.code === 'ENOENT') {
        throw new MigrateMissingMigrationsDirError(this.migrationDir)
      }
    }
  }

  async close () {
    if (this.sqliteDb !== null) {
      this.sqliteDb.close()
      this.sqliteDb = null
    }
    if (this.db !== null) {
      await this.db.dispose()
      this.db = null
      this.postgrator = null
    }
  }
}

export async function execute (logger, config, to, rollback) {
  const migrationsConfig = config.migrations
  if (migrationsConfig === undefined) {
    throw new MigrateMissingMigrationsError()
  }

  const migrator = new Migrator(migrationsConfig, config.db, logger)

  try {
    if (rollback) {
      await migrator.rollbackMigration()
    } else {
      await migrator.applyMigrations(to)
    }
    return migrator.appliedMigrationsCount > 0
  } finally {
    await migrator.close()
  }
}
