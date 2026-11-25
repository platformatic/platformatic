import { createConnectionPool } from '@platformatic/sql-mapper'
import { AsyncLocalStorage } from 'node:async_hooks'
import { createHash } from 'node:crypto'
import { access, readdir, stat } from 'node:fs/promises'
import { basename } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'
import Postgrator from 'postgrator'
import {
  ApplyMigrationError,
  MigrateMissingMigrationsDirError,
  MigrateMissingMigrationsError,
  MigrationsLockError,
  MigrationsLockTimeoutError,
  OutOfOrderMigrationsError
} from './errors.js'
import { splitSQLiteStatements } from './split-sqlite-statements.js'

// The longest pause between two tries of a run that waits for the migrations lock.
const LOCK_RETRY_INTERVAL = 100

// The key of the PostgreSQL advisory lock: 64 bits of a digest, as a signed
// integer.
const POSTGRESQL_LOCK_KEY = createHash('sha256').update('platformatic-db-migrations').digest().readBigInt64BE(0).toString()

// The connection that holds the migrations lock of the run in progress, kept
// for the instance that runs it.
const lockConnections = new AsyncLocalStorage()

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
    this.outOfOrder = migrationConfig.outOfOrder ?? 'error'
    this.lock = migrationConfig.lock ?? false
    this.lockTimeout = migrationConfig.lockTimeout ?? 60000

    this.logger = logger

    this.db = null
    this.sql = null
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
    this.driver = driver
    this.sql = sql

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

        // A run that holds the migrations lock sends the queries of Postgrator
        // through the connection that holds it.
        const res = await (this.getLockConnection() ?? db).query(sql`${sql.__dangerous__rawValue(query)}`)
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
    await this.withLock(async () => {
      try {
        await this.checkOutOfOrderMigrations(to)
      } catch (error) {
        // The check runs before Postgrator's migrate(), which decorates the
        // errors it throws in this same way. An error that cannot take the
        // field is rethrown as it is, so the original is never hidden.
        try {
          if (!error.appliedMigrations) error.appliedMigrations = []
        } catch {}
        throw error
      }
      await this.migrate(to)
    })
  }

  getLockConnection () {
    const store = lockConnections.getStore()
    return store?.migrator === this ? store.connection : undefined
  }

  // Serializes the runs on one database across processes. A run with
  // the lock opens a database session of its own, takes the lock on it, sends
  // its queries through it and closes it at the end. The lock belongs to that
  // session: the database frees it when the session ends, also when the
  // process dies. No other code ever gets that connection.
  async withLock (fn) {
    if (!this.lock) {
      return fn()
    }

    if (this.db.isSQLite) {
      this.logger.warn('The "migrations.lock" option is not supported on SQLite, running without a lock.')
      return fn()
    }

    const { db } = await createConnectionPool({ ...this.coreConfig, log: this.logger, poolSize: 1 })
    try {
      return await db.task(async connection => {
        await this.acquireLock(connection)
        const store = { migrator: this, connection }
        try {
          return await lockConnections.run(store, fn)
        } finally {
          // Code that outlives the run no longer finds this instance in the
          // store, so it gets no connection, and the store does not keep the
          // closed connection reachable for as long as that code lives.
          store.connection = undefined
          store.migrator = undefined
        }
      })
    } finally {
      try {
        await db.dispose()
      } catch (err) {
        // The outcome of the run is the one to report. The lock is free once
        // the database has seen the session end.
        this.logger.warn({ err }, 'unable to close the connection that held the migrations lock')
      }
    }
  }

  // One lock for each database, whatever the versions table: two runs on one
  // database always take the same lock, however each of them names the
  // table. PostgreSQL advisory locks are scoped to the database, so the key
  // is a constant there. MySQL and MariaDB named locks are scoped to the
  // server, so the name carries a digest of the database the session is on,
  // which keeps it inside the 64 characters MySQL allows. The name is the one
  // the server reports. A database selected under its legacy `#mysql50#`
  // name reports another name than under its plain one, and gets another
  // lock. Otherwise the name is unique for a database unless the server
  // keeps the case of names it compares without their case
  // (`lower_case_table_names` set to 2): there one database has several
  // spellings, and one lock for the whole server is used instead.
  async getLockId (connection) {
    if (this.db.isPg) {
      return POSTGRESQL_LOCK_KEY
    }

    const sql = this.sql
    // The name is read as hexadecimal digits, so that it does not depend on
    // the character set the session converts its results to.
    const [row] = await connection.query(sql`SELECT HEX(DATABASE()) AS name, @@lower_case_table_names AS folding`)
    // Without a database selected there is nothing to lock.
    if (row.name === null) {
      throw new MigrationsLockError()
    }

    if (Number(row.folding) === 2) {
      return 'plt-db-migrations'
    }

    return `plt-db-migrations-${createHash('sha256').update(row.name).digest('hex').slice(0, 40)}`
  }

  async tryLock (connection, id) {
    const sql = this.sql
    const [row] = await connection.query(
      this.db.isPg
        ? sql`SELECT pg_catalog.pg_try_advisory_lock(${id}::bigint) AS locked`
        : sql`SELECT GET_LOCK(${id}, 0) AS locked`
    )
    // GET_LOCK returns NULL when it failed, which is not a lock held elsewhere.
    if (row.locked === null) {
      throw new MigrationsLockError()
    }
    return Number(row.locked) === 1
  }

  // Tries until the lock is taken or `lockTimeout` has passed. The time is
  // the one spent trying: a run that gets the lock on its last try goes on.
  async acquireLock (connection) {
    const id = await this.getLockId(connection)
    const deadline = performance.now() + this.lockTimeout
    let waiting = false

    while (!(await this.tryLock(connection, id))) {
      const remaining = deadline - performance.now()
      if (remaining <= 0) {
        throw new MigrationsLockTimeoutError(this.lockTimeout)
      }
      if (!waiting) {
        waiting = true
        this.logger.info('waiting for the migrations lock held by another run')
      }
      await this.pause(Math.min(remaining, LOCK_RETRY_INTERVAL))
    }
  }

  async pause (milliseconds) {
    await sleep(milliseconds)
  }

  // Postgrator only runs the migrations above the highest version recorded in
  // the database. A migration below that version with no row in the versions
  // table (for example one that arrives from a parallel branch after a higher
  // numbered one already ran) is not selected and nothing reports it. The
  // table holds one row per applied migration, so those files can be found.
  async getOutOfOrderMigrations (databaseVersion, migrations, appliedVersions) {
    // No versions table yet, or nothing applied: nothing can be below.
    if (databaseVersion === 0) return []

    appliedVersions ??= await this.getAppliedVersions()

    return migrations
      .filter(
        migration =>
          migration.action === 'do' && migration.version < databaseVersion && !appliedVersions.has(migration.version)
      )
      .sort((a, b) => a.version - b.version)
  }

  // The versions recorded in the versions table, which must exist.
  async getAppliedVersions (postgrator = this.postgrator) {
    // Quote the table as Postgrator does when it creates and reads it.
    const table = this.migrationsTable || 'versions'
    const quotedTable =
      this.driver === 'pg'
        ? table
          .split('.')
          .map(value => `"${value}"`)
          .join('.')
        : table

    const { rows } = await postgrator.runQuery(`SELECT version FROM ${quotedTable}`)
    return new Set(rows.map(row => Number(row.version)))
  }

  async checkOutOfOrderMigrations (to = '') {
    if (this.outOfOrder !== 'error') return

    // Postgrator only accepts a string or nothing: anything else is its to refuse.
    if (typeof to !== 'string') return

    // Resolve the target as Postgrator does. The check only applies when the
    // target moves forward or stays: a rollback is never blocked by a skipped
    // migration, and a target that is not a number is left to Postgrator.
    const cleaned = to.toLowerCase().trim()
    const toHighest = cleaned === '' || cleaned === 'max'
    const explicitVersion = Number(to)
    if (!toHighest && Number.isNaN(explicitVersion)) return

    const databaseVersion = await this.postgrator.getDatabaseVersion()
    if (databaseVersion === 0) return
    if (!toHighest && explicitVersion < databaseVersion) return

    // Read the files now, as Postgrator does when it migrates: a list cached
    // by an earlier call on this instance could be stale.
    const migrations = await this.postgrator.getMigrations()
    if (toHighest && !migrations.some(migration => migration.version >= databaseVersion)) return

    const outOfOrder = await this.getOutOfOrderMigrations(databaseVersion, migrations)
    if (outOfOrder.length > 0) {
      const names = outOfOrder.map(migration => basename(migration.filename))
      throw new OutOfOrderMigrationsError(databaseVersion, names.join(', '))
    }
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

    // The version to go back to is read under the lock, after any run that
    // was ahead of this one has finished.
    await this.withLock(async () => {
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
    })
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

    if (this.outOfOrder === 'error') {
      const outOfOrder = await this.getOutOfOrderMigrations(currentVersion, migrations)
      return outOfOrder.length > 0
    }

    return false
  }

  // Compares the migration files with the versions recorded in the database
  // and runs no migration: a versions table that does not exist is not created.
  // A migration is "applied" or "pending", "out-of-order" when its file is
  // below the database version and has no row, which is what the `outOfOrder`
  // option is about, and "missing-file" when a row has no `do` file. Version
  // 0 is left out: it is the row Postgrator writes when it creates the table,
  // and Postgrator never runs a file of that version.
  async getStatus () {
    let postgrator
    let sqliteDb = null
    let hasDatabase = true

    const connectionString = this.coreConfig.connectionString
    const isSQLite = typeof connectionString === 'string' && connectionString.startsWith('sqlite')
    // An in-memory database only exists in the connection that migrated it.
    const inMemoryInUse = this.postgrator !== null && connectionString === 'sqlite://:memory:'
    if (isSQLite && !inMemoryInUse) {
      // The setup the other commands share opens a SQLite file for writing,
      // which creates a file that does not exist and can write to one that
      // does. A status only reads, so it opens the file read only on its own,
      // also when this migrator already holds a writable connection.
      await this.checkMigrationsDirectoryExists()
      sqliteDb = await this.openSQLiteReadOnly()
      hasDatabase = sqliteDb !== null
      postgrator = new Postgrator({
        migrationPattern: this.migrationDir + '/*',
        driver: 'sqlite3',
        schemaTable: this.migrationsTable || 'versions',
        execQuery: async query => ({ rows: sqliteDb.prepare(query).all() }),
        newline: this.newline
      })
    } else {
      if (this.postgrator === null) await this.setupPostgrator()
      postgrator = this.postgrator
    }

    let migrations
    let databaseVersion = 0
    let appliedVersions = new Set()
    try {
      migrations = await postgrator.getMigrations()
      // With no SQLite file nothing was applied: the files are the whole answer.
      if (hasDatabase) {
        databaseVersion = await postgrator.getDatabaseVersion()
      }
      if (databaseVersion !== 0) {
        // The database version is the highest of the rows the files are compared
        // with, so a run that ends between the two reads cannot make them disagree.
        appliedVersions = await this.getAppliedVersions(postgrator)
        databaseVersion = 0
        for (const version of appliedVersions) {
          if (version > databaseVersion) databaseVersion = version
        }
      }
    } finally {
      sqliteDb?.close()
    }

    const entries = []
    const versionsWithFile = new Set()
    for (const migration of migrations) {
      if (migration.action !== 'do' || migration.version === 0) continue
      versionsWithFile.add(migration.version)

      let status = 'pending'
      if (appliedVersions.has(migration.version)) {
        status = 'applied'
      } else if (migration.version < databaseVersion) {
        status = 'out-of-order'
      }
      entries.push({ version: migration.version, file: basename(migration.filename), status })
    }

    for (const version of appliedVersions) {
      if (version !== 0 && !versionsWithFile.has(version)) {
        entries.push({ version, file: null, status: 'missing-file' })
      }
    }
    entries.sort((a, b) => a.version - b.version)

    // The answer of hasMigrationsToApply(), from the files and the rows read
    // above: any file above the database version, or with `outOfOrder: "error"`
    // a `do` file below it that has no row.
    const hasFilesAbove = migrations.some(migration => migration.version > databaseVersion)
    const outOfOrder =
      this.outOfOrder === 'error' ? await this.getOutOfOrderMigrations(databaseVersion, migrations, appliedVersions) : []
    const upToDate = !hasFilesAbove && outOfOrder.length === 0

    return { databaseVersion, upToDate, migrations: entries }
  }

  // The SQLite database of the connection string, opened read only, or null
  // when no file is at that path. A read only open never creates the file.
  async openSQLiteReadOnly () {
    const path = this.coreConfig.connectionString.replace('sqlite://', '')
    const { DatabaseSync } = await import('node:sqlite')

    for (let attempt = 1; ; attempt++) {
      try {
        return new DatabaseSync(path, { readOnly: true })
      } catch (err) {
        try {
          await access(path)
        } catch (accessError) {
          if (accessError.code === 'ENOENT') return null
        }
        // The file is there. A first apply may have created it since the
        // open failed, so the open is tried once more.
        if (attempt === 2) throw err
      }
    }
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

export async function getStatus (logger, config) {
  const migrationsConfig = config.migrations
  if (migrationsConfig === undefined) {
    throw new MigrateMissingMigrationsError()
  }

  const migrator = new Migrator(migrationsConfig, config.db, logger)

  try {
    return await migrator.getStatus()
  } finally {
    await migrator.close()
  }
}
