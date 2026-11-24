import { createConnectionPool } from '@platformatic/sql-mapper'
import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { applyMigrations } from '../../lib/commands/migrations-apply.js'
import { Migrator } from '../../lib/migrator.js'
import { createCapturingLogger, createTestContext } from '../cli/test-utilities.js'
import { getConnectionInfo, isMysql, isPg, isSQLite } from '../helper.js'

const nullLogger = { debug () {}, trace () {}, info () {}, warn () {}, error () {} }

const files = {
  '001.do.sql': 'CREATE TABLE test1 (id INTEGER);',
  '001.undo.sql': 'DROP TABLE test1;',
  '002.do.sql': 'CREATE TABLE test2 (id INTEGER);',
  '002.undo.sql': 'DROP TABLE test2;'
}

async function makeMigrationsDir (t, content = files) {
  const dir = await mkdtemp(join(tmpdir(), 'plt-db-lock-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  for (const [name, text] of Object.entries(content)) {
    await writeFile(join(dir, name), text)
  }
  return dir
}

async function setup (t, content) {
  const { connectionInfo, dropTestDB } = await getConnectionInfo()
  const coreConfig = { connectionString: connectionInfo.connectionString }
  const dir = await makeMigrationsDir(t, content)

  // Every connection is closed before the test database is dropped.
  const migrators = []
  const holders = []
  t.after(async () => {
    // Every release and every close is attempted before the database is
    // dropped, and the first failure is the one reported.
    const steps = [...holders, ...migrators.map(migrator => () => migrator.close()), dropTestDB]
    let failure
    for (const step of steps) {
      try {
        await step()
      } catch (err) {
        failure ??= err
      }
    }
    if (failure) throw failure
  })

  function createMigrator (config = {}, logger = nullLogger, core = coreConfig) {
    const migrator = new Migrator({ dir, ...config }, core, logger)
    migrators.push(migrator)
    return migrator
  }

  // Takes the lock of the given configuration on a connection of its own,
  // as another process would, and gives back the function that frees it.
  async function hold (config = {}) {
    // The holder waits for a lock that a session of an earlier test may
    // still hold until the server has seen it end.
    const holder = createMigrator({ lock: true, lockTimeout: 30000, ...config })
    await holder.setupPostgrator()

    let free
    const freed = new Promise(resolve => {
      free = resolve
    })
    let taken
    const held = new Promise(resolve => {
      taken = resolve
    })
    const task = holder.withLock(async () => {
      taken()
      await freed
    })
    // A holder that ends before it holds the lock fails here.
    await Promise.race([
      held,
      task.then(() => Promise.reject(new Error('the holder ended without holding the lock')))
    ])

    let released = false
    async function release () {
      if (released) return
      released = true
      free()
      await task
    }
    holders.push(release)
    return release
  }

  async function read (query) {
    const { db, sql } = await createConnectionPool({ ...coreConfig, log: nullLogger })
    try {
      return await db.query(sql`${sql.__dangerous__rawValue(query)}`)
    } finally {
      await db.dispose()
    }
  }

  async function appliedVersions (table = 'versions') {
    try {
      const rows = await read(`SELECT version FROM ${table} ORDER BY version`)
      return rows.map(row => Number(row.version)).filter(version => version > 0)
    } catch (err) {
      if (isMissingTable(err)) return null
      throw err
    }
  }

  async function tableExists (name) {
    try {
      await read(`SELECT 1 FROM ${name} LIMIT 0`)
      return true
    } catch (err) {
      if (isMissingTable(err)) return false
      throw err
    }
  }

  // Tells whether the lock of the given configuration is free right now.
  async function isFree (config = {}, core = coreConfig) {
    const migrator = createMigrator({ lock: true, lockTimeout: 0, ...config }, nullLogger, core)
    await migrator.setupPostgrator()
    try {
      await migrator.withLock(async () => {})
      return true
    } catch (err) {
      if (err.code === 'PLT_DB_MIGRATIONS_LOCK_TIMEOUT_ERROR') return false
      throw err
    }
  }

  // The database frees a lock when it has seen the session end, which can
  // be a moment after the client closed its connection.
  function becomesFree (config = {}) {
    return isFree({ lockTimeout: 30000, ...config })
  }

  return { dir, connectionInfo, coreConfig, createMigrator, hold, isFree, becomesFree, appliedVersions, tableExists }
}

// A logger that tells when a run announces that it waits for the lock.
function createWaitingLogger () {
  let announce
  let announced
  // Starts a new observation: an announcement made before it does not count.
  function arm () {
    announced = new Promise(resolve => {
      announce = resolve
    })
  }
  arm()
  let count = 0
  const logger = {
    ...nullLogger,
    info (message) {
      if (message === 'waiting for the migrations lock held by another run') {
        count++
        announce()
      }
    }
  }
  // Resolves when the run announces its wait, and rejects when the run ends
  // without having waited.
  function waiting (run) {
    return Promise.race([
      announced,
      run.then(
        () => Promise.reject(new Error('the run ended without waiting for the lock')),
        err => Promise.reject(err)
      )
    ])
  }

  return { logger, waiting, arm, announcements: () => count }
}

// Holds the first call of `migrate()` on the given instance, which happens
// after its run took the lock, until `open()` is called.
function gateFirstMigrate (t, migrator) {
  const migrate = migrator.migrate.bind(migrator)
  let enter
  const entered = new Promise(resolve => {
    enter = resolve
  })
  let open
  const gate = new Promise(resolve => {
    open = resolve
  })
  let calls = 0
  t.mock.method(migrator, 'migrate', async to => {
    if (calls++ === 0) {
      enter()
      await gate
    }
    return migrate(to)
  })

  // Resolves when the run is held behind the gate, and rejects when it ends
  // before reaching it.
  function held (run) {
    return Promise.race([entered, run.then(() => Promise.reject(new Error('the run ended before taking the lock')))])
  }

  return { held, open, calls: () => calls }
}

// PostgreSQL's undefined_table, MySQL's and MariaDB's error, SQLite's message.
function isMissingTable (err) {
  return err.code === '42P01' || err.code === 'ER_NO_SUCH_TABLE' || /no such table/i.test(err.message)
}

function isLockTimeout (timeout) {
  return err => {
    assert.equal(err.code, 'PLT_DB_MIGRATIONS_LOCK_TIMEOUT_ERROR')
    assert.equal(
      err.message,
      `Unable to take the migrations lock in ${timeout} ms: it is still held by another run. See the "migrations.lockTimeout" option.`
    )
    return true
  }
}

test('by default no lock is taken', async t => {
  const { createMigrator, hold, appliedVersions } = await setup(t)

  // A run without the option does not wait for a lock another process holds,
  // and does not take a dedicated connection.
  if (!isSQLite) {
    await hold()
  }
  const migrator = createMigrator()
  assert.equal(migrator.lock, false)
  assert.equal(migrator.lockTimeout, 60000)

  await migrator.setupPostgrator()
  if (!isSQLite) {
    t.mock.method(migrator.db, 'task', () => {
      throw new Error('a connection was reserved without the lock option')
    })
  }

  await migrator.applyMigrations()
  assert.equal(migrator.appliedMigrationsCount, 2)
  assert.deepEqual(await appliedVersions(), [1, 2])
})

test('lock: true sends no query of the run through the pool of the instance', { skip: isSQLite }, async t => {
  const { createMigrator, appliedVersions } = await setup(t)
  const migrator = createMigrator({ lock: true })
  await migrator.setupPostgrator()

  // The run has a connection of its own: once the pool is set up, it neither
  // queries it nor reserves one of its connections.
  let onPool = 0
  for (const method of ['query', 'task', 'tx']) {
    const original = migrator.db[method].bind(migrator.db)
    t.mock.method(migrator.db, method, (...args) => {
      onPool++
      return original(...args)
    })
  }

  // A callback created during the run finds the connection of the run while
  // it lasts, and none once the run has ended.
  const migrate = migrator.migrate.bind(migrator)
  let during
  let resume
  let later
  t.mock.method(migrator, 'migrate', async to => {
    during = migrator.getLockConnection()
    later = new Promise(resolve => {
      resume = resolve
    }).then(() => migrator.getLockConnection())
    return migrate(to)
  })

  await migrator.applyMigrations()

  assert.equal(onPool, 0)
  assert.equal(typeof during?.query, 'function')
  resume()
  assert.equal(await later, undefined)
  assert.equal(migrator.getLockConnection(), undefined)
  assert.equal(migrator.appliedMigrationsCount, 2)
  assert.deepEqual(await appliedVersions(), [1, 2])
})

test('lock: true frees the lock at the end of the run', { skip: isSQLite }, async t => {
  const { createMigrator, hold, isFree, becomesFree } = await setup(t)

  // The check itself sees a held lock as taken.
  const release = await hold()
  assert.equal(await isFree(), false)
  await release()
  assert.equal(await becomesFree(), true)

  await createMigrator({ lock: true }).applyMigrations()
  assert.equal(await becomesFree(), true)
})

test('lock: true makes two concurrent runs apply every migration once', { skip: isSQLite }, async t => {
  const { createMigrator, appliedVersions, tableExists } = await setup(t)
  const first = createMigrator({ lock: true })
  const { logger, waiting, announcements } = createWaitingLogger()
  const second = createMigrator({ lock: true, lockTimeout: 120000 }, logger)

  // The first run is held after it took the lock, until the second one, on
  // another instance, announces that it waits.
  const { held, open } = gateFirstMigrate(t, first)
  const firstRun = first.applyMigrations()
  let secondRun
  try {
    await held(firstRun)
    secondRun = second.applyMigrations()
    await waiting(secondRun)
    assert.equal(await appliedVersions(), null)
  } finally {
    open()
    await Promise.allSettled([firstRun, secondRun])
  }
  await Promise.all([firstRun, secondRun])

  // The first run applied both files, the one that waited found nothing left.
  assert.equal(first.appliedMigrationsCount, 2)
  assert.equal(second.appliedMigrationsCount, 0)
  assert.equal(announcements(), 1)
  assert.deepEqual(await appliedVersions(), [1, 2])
  assert.equal(await tableExists('test1'), true)
  assert.equal(await tableExists('test2'), true)
})

test('lock: true runs the out of order check after the lock is taken', { skip: isSQLite }, async t => {
  const applied = {
    '001.do.sql': 'CREATE TABLE test1 (id INTEGER);',
    '003.do.sql': 'CREATE TABLE test3 (id INTEGER);'
  }
  const { createMigrator, appliedVersions, tableExists } = await setup(t, applied)
  const late = await makeMigrationsDir(t, { ...applied, '002.do.sql': 'CREATE TABLE test2 (id INTEGER);' })

  // The first run is held after it took the lock, until the second one, whose
  // directory also has version 2, announces that it waits. The database is
  // still empty then, so a check made before the lock would find nothing.
  const first = createMigrator({ lock: true })
  const { logger, waiting } = createWaitingLogger()
  const second = createMigrator({ dir: late, lock: true, lockTimeout: 120000 }, logger)
  const { held, open } = gateFirstMigrate(t, first)
  const firstRun = first.applyMigrations()
  let secondRun
  try {
    await held(firstRun)
    secondRun = second.applyMigrations()
    await waiting(secondRun)
    assert.equal(await appliedVersions(), null)
  } finally {
    open()
    await Promise.allSettled([firstRun, secondRun])
  }
  await firstRun

  // The run that waited reads the versions the first one recorded.
  await assert.rejects(secondRun, err => {
    assert.equal(err.code, 'PLT_DB_OUT_OF_ORDER_MIGRATIONS_ERROR')
    assert.match(err.message, /002\.do\.sql/)
    assert.deepEqual(err.appliedMigrations, [])
    return true
  })
  assert.deepEqual(await appliedVersions(), [1, 3])
  assert.equal(await tableExists('test2'), false)
})

test('lock: true waits for the lock and then applies', { skip: isSQLite }, async t => {
  const { createMigrator, hold, appliedVersions } = await setup(t)
  const release = await hold()

  const { logger, waiting, announcements } = createWaitingLogger()
  const migrator = createMigrator({ lock: true, lockTimeout: 120000 }, logger)
  const run = migrator.applyMigrations()

  try {
    // The run found the lock taken and waits: nothing is applied.
    await waiting(run)
    assert.equal(await appliedVersions(), null)
    assert.equal(migrator.appliedMigrationsCount, 0)
  } finally {
    try {
      await release()
    } finally {
      await Promise.allSettled([run])
    }
  }
  await run

  assert.equal(migrator.appliedMigrationsCount, 2)
  assert.deepEqual(await appliedVersions(), [1, 2])
  assert.equal(announcements(), 1)
})

test('lock: true fails after lockTimeout without applying anything', { skip: isSQLite }, async t => {
  const { createMigrator, hold, appliedVersions, tableExists } = await setup(t)
  await hold()

  const migrator = createMigrator({ lock: true, lockTimeout: 300 })
  const start = performance.now()
  await assert.rejects(migrator.applyMigrations(), isLockTimeout(300))

  const elapsed = performance.now() - start
  assert.ok(elapsed >= 300, `gave up after ${elapsed} ms`)
  assert.equal(migrator.appliedMigrationsCount, 0)
  assert.equal(await appliedVersions(), null)
  assert.equal(await tableExists('test1'), false)
})

test('lockTimeout: 0 fails at once when the lock is taken', { skip: isSQLite }, async t => {
  const { createMigrator, hold, appliedVersions } = await setup(t)
  await hold()

  const { logger, announcements } = createWaitingLogger()
  await assert.rejects(createMigrator({ lock: true, lockTimeout: 0 }, logger).applyMigrations(), isLockTimeout(0))
  // It did not wait, so it did not announce a wait either.
  assert.equal(announcements(), 0)
  assert.equal(await appliedVersions(), null)
})

test('lock: true frees the lock when a migration fails', { skip: isSQLite }, async t => {
  const { createMigrator, becomesFree, appliedVersions } = await setup(t, {
    '001.do.sql': 'CREATE TABLE test1 (id INTEGER);',
    '002.do.sql': 'CREATE TABLE test1 (id INTEGER);'
  })

  const migrator = createMigrator({ lock: true })
  await assert.rejects(migrator.applyMigrations(), err => {
    assert.equal(err.code, 'PLT_DB_MIGRATE_ERROR')
    assert.match(err.message, /^Unable to apply migration 002\.do\.sql: /)
    return true
  })
  assert.deepEqual(await appliedVersions(), [1])
  assert.equal(await becomesFree(), true)
})

test('lock: true makes a rollback wait and choose its target under the lock', { skip: isSQLite }, async t => {
  const { createMigrator, hold, appliedVersions, tableExists } = await setup(t, {
    ...files,
    '003.do.sql': 'CREATE TABLE test3 (id INTEGER);',
    '003.undo.sql': 'DROP TABLE test3;'
  })
  await createMigrator().applyMigrations('002')
  assert.deepEqual(await appliedVersions(), [1, 2])

  const release = await hold()
  await assert.rejects(createMigrator({ lock: true, lockTimeout: 200 }).rollbackMigration(), isLockTimeout(200))
  assert.deepEqual(await appliedVersions(), [1, 2])

  // While a rollback waits, the run that holds the lock moves the database
  // to version 3. The rollback then undoes that version, not the one it
  // would have chosen before waiting.
  const { logger, waiting } = createWaitingLogger()
  const rollback = createMigrator({ lock: true, lockTimeout: 120000 }, logger).rollbackMigration()
  try {
    await waiting(rollback)
    await createMigrator().applyMigrations()
    assert.deepEqual(await appliedVersions(), [1, 2, 3])
  } finally {
    try {
      await release()
    } finally {
      await Promise.allSettled([rollback])
    }
  }
  await rollback
  assert.deepEqual(await appliedVersions(), [1, 2])
  assert.equal(await tableExists('test3'), false)
  assert.equal(await tableExists('test2'), true)
})

test('every run on one database takes the same lock', { skip: isSQLite }, async t => {
  const { connectionInfo, hold, isFree } = await setup(t)
  await hold()

  // Only the locks are compared here, no migration runs. However a run names
  // its versions table, or the database in its connection string, it waits
  // for the run that holds the lock of that database.
  assert.equal(await isFree({ table: 'other_versions' }), false)
  assert.equal(await isFree({ table: 'public.versions' }), false)
  assert.equal(await isFree({ currentSchema: 'other' }), false)

  if (isPg) {
    const base = connectionInfo.connectionString.slice(0, -connectionInfo.dbname.length)
    const spelled = { connectionString: `${base}?dbname=${connectionInfo.dbname}` }
    assert.notEqual(spelled.connectionString, connectionInfo.connectionString)
    assert.equal(await isFree({}, spelled), false)
  }
})

test('lock: true does not wait for the run of another database', { skip: isSQLite }, async t => {
  const one = await setup(t)
  const two = await setup(t)
  assert.notEqual(one.connectionInfo.dbname, two.connectionInfo.dbname)
  await one.hold()

  // A MySQL or MariaDB server that keeps the case of names it compares
  // without their case has one lock for all its databases.
  let serverWide = false
  if (isMysql) {
    const { db, sql } = await createConnectionPool({ ...one.coreConfig, log: nullLogger })
    try {
      const [row] = await db.query(sql`SELECT @@lower_case_table_names AS folding`)
      serverWide = Number(row.folding) === 2
    } finally {
      await db.dispose()
    }
  }

  const migrator = two.createMigrator({ lock: true, lockTimeout: 0 })
  if (serverWide) {
    await assert.rejects(migrator.applyMigrations(), isLockTimeout(0))
    assert.equal(await two.appliedVersions(), null)
    return
  }

  await migrator.applyMigrations()
  assert.equal(migrator.appliedMigrationsCount, 2)
  assert.deepEqual(await two.appliedVersions(), [1, 2])
  assert.equal(await one.appliedVersions(), null)
})

test('lock: true makes two runs on one instance wait for each other', { skip: isSQLite }, async t => {
  const { createMigrator, appliedVersions } = await setup(t)
  const { logger, waiting, arm, announcements } = createWaitingLogger()
  const migrator = createMigrator({ lock: true, lockTimeout: 120000 }, logger)
  await migrator.setupPostgrator()

  // The first run is held after it took the lock, until the second one
  // announces that it waits. Both runs share the logger of the instance, so
  // the wait is observed from the moment the first run holds the lock: an
  // announcement the first run made while it waited itself does not count.
  const { held, open, calls } = gateFirstMigrate(t, migrator)
  const first = migrator.applyMigrations()
  let second
  let before
  try {
    await held(first)
    before = announcements()
    arm()
    second = migrator.applyMigrations()
    await waiting(second)
    assert.equal(await appliedVersions(), null)
  } finally {
    open()
    await Promise.allSettled([first, second])
  }
  await Promise.all([first, second])

  assert.equal(announcements() - before, 1)
  assert.equal(calls(), 2)
  assert.deepEqual(await appliedVersions(), [1, 2])
})

test('the MySQL and MariaDB lock follows the database name the server reports', { skip: !isMysql }, async t => {
  const { createMigrator } = await setup(t)
  const migrator = createMigrator({ lock: true })
  await migrator.setupPostgrator()

  // The answers of a server for the name of the database of the session and
  // for `lower_case_table_names`: 0 compares names with their case, 1 and 2
  // without it, and 2 keeps the case the client wrote.
  // The name comes as the hexadecimal digits of its bytes.
  const hex = name => (name === null ? null : Buffer.from(name).toString('hex').toUpperCase())
  const queries = []
  const lockId = (name, folding) =>
    migrator.getLockId({
      async query (query) {
        queries.push(query.format({ escapeIdentifier: identifier => identifier, formatValue: () => '?' }).text)
        return [{ name: hex(name), folding }]
      }
    })

  // In modes 0 and 1 the name the server reports is unique for a database.
  for (const folding of [0, 1, '0', '1']) {
    assert.match(await lockId('ledger', folding), /^plt-db-migrations-[0-9a-f]{40}$/)
    assert.notEqual(await lockId('Ledger', folding), await lockId('ledger', folding))
    assert.notEqual(await lockId('ledger', folding), await lockId('other', folding))
    assert.notEqual(await lockId('café', folding), await lockId('caf?', folding))
    assert.equal(await lockId('ledger', folding), await lockId('ledger', 0))
  }
  // In mode 2 one database has several spellings: one lock for the server.
  for (const folding of [2, '2']) {
    assert.equal(await lockId('Ledger', folding), 'plt-db-migrations')
    assert.equal(await lockId('other', folding), 'plt-db-migrations')
  }

  // The name is asked for in a form that the character set of the session
  // cannot change.
  assert.ok(queries.length > 0)
  for (const text of queries) {
    assert.equal(text, 'SELECT HEX(DATABASE()) AS name, @@lower_case_table_names AS folding')
  }

  // A session without a database has nothing to lock.
  await assert.rejects(lockId(null, 0), err => {
    assert.equal(err.code, 'PLT_DB_MIGRATIONS_LOCK_ERROR')
    return true
  })
})

test('a run whose session is lost fails and leaves the lock free', { skip: !isPg }, async t => {
  const { createMigrator, coreConfig, becomesFree, appliedVersions } = await setup(t)
  const migrator = createMigrator({ lock: true })
  await migrator.setupPostgrator()

  // The run is held after it took the lock, and its session is ended from
  // another connection, as when the network or the server drops it. The
  // session is the one the run reports from the connection that holds the
  // lock, read in the first step it takes under it.
  let pid
  const check = migrator.checkOutOfOrderMigrations.bind(migrator)
  t.mock.method(migrator, 'checkOutOfOrderMigrations', async to => {
    const [row] = await migrator.getLockConnection().query(migrator.sql`SELECT pg_backend_pid() AS pid`)
    pid = row.pid
    return check(to)
  })
  const { held, open } = gateFirstMigrate(t, migrator)
  const run = migrator.applyMigrations()
  let outcome
  try {
    await held(run)
    assert.equal(typeof pid, 'number')
    const { db, sql } = await createConnectionPool({ ...coreConfig, log: nullLogger })
    try {
      const [session] = await db.query(sql`SELECT pg_terminate_backend(${pid}) AS signalled`)
      assert.equal(session.signalled, true)
      // The signal was sent: ask, with a deadline of a minute for the
      // retries, until the server no longer lists that session.
      const deadline = performance.now() + 60000
      const isAlive = sql`SELECT 1 FROM pg_stat_activity WHERE pid = ${pid}`
      while ((await db.query(isAlive)).length > 0) {
        assert.ok(performance.now() < deadline, `session ${pid} is still alive`)
        await new Promise(resolve => setTimeout(resolve, 20))
      }
    } finally {
      await db.dispose()
    }
  } finally {
    open()
    ;[outcome] = await Promise.allSettled([run])
  }

  // Its queries stay on the lost connection: the run fails, nothing reaches
  // the pool of the instance, and nothing is applied.
  assert.equal(outcome.status, 'rejected')
  assert.equal(migrator.getLockConnection(), undefined)
  assert.equal(await appliedVersions(), null)

  assert.equal(await becomesFree(), true)
  const next = createMigrator({ lock: true })
  await next.applyMigrations()
  assert.equal(next.appliedMigrationsCount, 2)
})

test('a lock the database fails to take is an error, not a wait', { skip: isSQLite }, async t => {
  const { createMigrator } = await setup(t)
  const migrator = createMigrator({ lock: true })
  await migrator.setupPostgrator()

  // GET_LOCK answers NULL when it failed.
  const connection = { query: async () => [{ locked: null }] }
  await assert.rejects(migrator.tryLock(connection, '1'), err => {
    assert.equal(err.code, 'PLT_DB_MIGRATIONS_LOCK_ERROR')
    assert.equal(err.message, 'The database was unable to take the migrations lock.')
    return true
  })
})

test('a waiting run tries again after each pause until lockTimeout', { skip: isSQLite }, async t => {
  const { createMigrator } = await setup(t)
  const migrator = createMigrator({ lock: true, lockTimeout: 350 })
  await migrator.setupPostgrator()

  // The clock and the pauses are under the control of the test, and the
  // lock is always taken on this connection. MySQL and MariaDB are first
  // asked for the name of the database.
  let now = 0
  t.mock.method(performance, 'now', () => now)
  const pauses = []
  t.mock.method(migrator, 'pause', async milliseconds => {
    pauses.push(milliseconds)
    now += milliseconds
  })
  let queries = 0
  const connection = {
    async query () {
      queries++
      return [{ name: 'db', folding: 0, locked: 0 }]
    }
  }

  await assert.rejects(migrator.acquireLock(connection), isLockTimeout(350))

  // Tries at 0, 100, 200 and 300 ms, then a last one when the time is over.
  assert.deepEqual(pauses, [100, 100, 100, 50])
  assert.equal(queries - (isPg ? 0 : 1), 5)
})

test('lock: true warns on SQLite and applies without a lock', { skip: !isSQLite }, async t => {
  const { createMigrator, appliedVersions } = await setup(t, {
    '001.do.sql': 'CREATE TABLE test1 (id INTEGER);',
    '002.do.sql': 'CREATE TABLE test2 (id INTEGER);'
  })

  const logger = createCapturingLogger()
  const migrator = createMigrator({ lock: true }, logger)
  await migrator.applyMigrations()

  assert.equal(migrator.appliedMigrationsCount, 2)
  assert.deepEqual(await appliedVersions(), [1, 2])
  assert.match(logger.getCaptured(), /The "migrations.lock" option is not supported on SQLite, running without a lock\./)
})

test('the apply command reads lock and lockTimeout from the configuration', { skip: isSQLite }, async t => {
  const { dir, connectionInfo, hold, appliedVersions } = await setup(t)
  const root = await mkdtemp(join(tmpdir(), 'plt-db-lock-config-'))
  t.after(() => rm(root, { recursive: true, force: true }))

  async function run (migrations) {
    const configFile = join(root, 'platformatic.json')
    await writeFile(
      configFile,
      JSON.stringify({
        server: { hostname: '127.0.0.1', port: 0 },
        db: { connectionString: connectionInfo.connectionString },
        migrations: { dir, ...migrations }
      })
    )

    const context = createTestContext()
    const fatalErrors = []
    context.logFatalError = (_, message) => {
      fatalErrors.push(message)
      return false
    }
    await applyMigrations(createCapturingLogger(), configFile, [], context)
    return fatalErrors
  }

  const release = await hold()

  // The command reports the timeout through the fatal error path, which is
  // the one that sets a failing exit code.
  const fatalErrors = await run({ lock: true, lockTimeout: 200 })
  assert.equal(fatalErrors.length, 1)
  assert.match(fatalErrors[0], /Unable to take the migrations lock in 200 ms/)
  assert.equal(await appliedVersions(), null)

  await release()
  assert.deepEqual(await run({ lock: true, lockTimeout: 30000 }), [])
  assert.deepEqual(await appliedVersions(), [1, 2])
})

test('the configuration rejects a negative, fractional or too large lockTimeout', async t => {
  const { dir, connectionInfo, appliedVersions } = await setup(t, {
    '001.do.sql': 'CREATE TABLE test1 (id INTEGER);'
  })
  const root = await mkdtemp(join(tmpdir(), 'plt-db-lock-config-'))
  t.after(() => rm(root, { recursive: true, force: true }))

  for (const lockTimeout of [-1, 1.5, 2147483648]) {
    const configFile = join(root, 'platformatic.json')
    await writeFile(
      configFile,
      JSON.stringify({
        server: { hostname: '127.0.0.1', port: 0 },
        db: { connectionString: connectionInfo.connectionString },
        migrations: { dir, lock: true, lockTimeout }
      })
    )

    const context = createTestContext()
    context.logFatalError = () => false
    await assert.rejects(applyMigrations(createCapturingLogger(), configFile, [], context), /lockTimeout/)
    assert.equal(await appliedVersions(), null)
  }
})
