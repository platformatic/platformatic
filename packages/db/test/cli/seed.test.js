import { createDirectory } from '@platformatic/utils'
import assert from 'node:assert/strict'
import { copyFile, mkdtemp, readdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { parseArgs as nodeParseArgs } from 'node:util'
import rimraf from 'rimraf'
import { request } from 'undici'
import { applyMigrations } from '../../lib/commands/migrations-apply.js'
import { seed as seedCommand } from '../../lib/commands/seed.js'
import { getConnectionInfo } from '../helper.js'
import { safeKill, start } from './helper.js'

function createTestContext () {
  return {
    parseArgs (args, options) {
      return nodeParseArgs({ args, options, allowPositionals: true, allowNegative: true, strict: false })
    },
    colorette: {
      bold (str) {
        return str
      }
    },
    logFatalError (logger, ...args) {
      if (logger.fatal) logger.fatal(...args)
      return false
    }
  }
}

function createCapturingLogger () {
  let capturedOutput = ''
  const logger = {
    info: (msg) => { capturedOutput += msg + '\n' },
    warn: (msg) => { capturedOutput += msg + '\n' },
    debug: () => {},
    trace: () => {},
    error: (msg) => { capturedOutput += msg + '\n' }
  }
  logger.getCaptured = () => capturedOutput
  return logger
}

function createThrowingLogger () {
  return {
    info: () => {},
    warn: () => {},
    debug: () => {},
    trace: () => {},
    error: (msg) => { throw new Error(msg) },
    fatal: (msg) => { throw new Error(msg) }
  }
}

test('seed and start', async t => {
  const { connectionInfo, dropTestDB } = await getConnectionInfo('sqlite')

  const cwd = join(import.meta.dirname, '..', 'fixtures', 'sqlite')
  const configFile = join(cwd, 'platformatic.db.json')

  const migrationsLogger = createCapturingLogger()
  const migrationsContext = createTestContext()

  process.env.DATABASE_URL = connectionInfo.connectionString
  await applyMigrations(migrationsLogger, configFile, [], migrationsContext)

  const seedLogger = createCapturingLogger()
  const seedContext = createTestContext()

  // Change to the test directory so seed can find seed.js
  const originalCwd = process.cwd()
  process.chdir(cwd)
  try {
    await seedCommand(seedLogger, configFile, ['seed.js'], seedContext)
  } finally {
    process.chdir(originalCwd)
  }

  const seedOutput = seedLogger.getCaptured()
  assert.match(seedOutput, /Seeding from .*seed\.js/)
  assert.match(seedOutput, /42/) // custom logger.info line from the seed file
  assert.match(seedOutput, /Seeding complete/)

  const { child, url } = await start([], {
    cwd,
    env: {
      DATABASE_URL: connectionInfo.connectionString
    }
  })

  t.after(async () => {
    await safeKill(child)
    await dropTestDB()
  })

  {
    const res = await request(`${url}/graphql`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
              query {
                graphs {
                  id
                  name
                }
              }
            `
      })
    })
    assert.equal(res.statusCode, 200, 'graphs status code')
    const body = await res.body.json()
    assert.deepEqual(body, {
      data: {
        graphs: [
          {
            id: '1',
            name: 'Hello'
          },
          {
            id: '2',
            name: 'Hello 2'
          }
        ]
      }
    })
  }
})

test('seed command should throw an error if there are migrations to apply', async t => {
  const { connectionInfo, dropTestDB } = await getConnectionInfo('sqlite')

  const cwd = join(import.meta.dirname, '..', 'fixtures', 'sqlite')
  const configFile = join(cwd, 'platformatic.db.json')

  t.after(async () => {
    await dropTestDB()
  })

  const seedLogger = createThrowingLogger()
  const seedContext = createTestContext()

  process.env.DATABASE_URL = connectionInfo.connectionString

  // Change to the test directory so seed can find seed.js
  const originalCwd = process.cwd()
  process.chdir(cwd)
  try {
    await seedCommand(seedLogger, configFile, ['seed.js'], seedContext)
    assert.fail('Should have thrown an error')
  } catch (err) {
    assert.match(err.message, /You must apply migrations before seeding the database./)
  } finally {
    process.chdir(originalCwd)
  }
})

test('valid config files', async t => {
  const fixturesDir = join(import.meta.dirname, '..', 'fixtures')
  const validConfigFiles = await readdir(join(fixturesDir, 'valid-config-files'))

  for (const configFile of validConfigFiles) {
    const { connectionInfo, dropTestDB } = await getConnectionInfo('sqlite')

    const cwd = await mkdtemp(join(tmpdir(), 'seed-'))
    const dbConfigFile = join(cwd, configFile)

    await copyFile(join(fixturesDir, 'valid-config-files', configFile), join(cwd, configFile))
    await createDirectory(join(cwd, 'migrations'))
    await copyFile(join(fixturesDir, 'sqlite', 'migrations', '001.do.sql'), join(cwd, 'migrations', '001.do.sql'))
    const seed = join(import.meta.dirname, '..', 'fixtures', 'sqlite', 'seed.js')

    const migrationsLogger = createCapturingLogger()
    const migrationsContext = createTestContext()

    process.env.DATABASE_URL = connectionInfo.connectionString
    await applyMigrations(migrationsLogger, dbConfigFile, [], migrationsContext)

    const seedLogger = createCapturingLogger()
    const seedContext = createTestContext()

    // Change to the test directory so seed can find the seed file
    const originalCwd = process.cwd()
    process.chdir(cwd)
    try {
      await seedCommand(seedLogger, dbConfigFile, [seed], seedContext)
    } finally {
      process.chdir(originalCwd)
    }

    const seedOutput = seedLogger.getCaptured()
    assert.match(seedOutput, /Seeding complete/)

    t.after(async () => {
      rimraf.sync(cwd)
      await dropTestDB()
    })
  }
})

test('missing seed file', async t => {
  const { connectionInfo, dropTestDB } = await getConnectionInfo('sqlite')
  const cwd = join(import.meta.dirname, '..', 'fixtures', 'sqlite')
  const configFile = join(cwd, 'platformatic.db.json')

  t.after(async () => {
    await dropTestDB()
  })

  const migrationsLogger = createCapturingLogger()
  const migrationsContext = createTestContext()

  process.env.DATABASE_URL = connectionInfo.connectionString
  await applyMigrations(migrationsLogger, configFile, [], migrationsContext)

  const seedLogger = createCapturingLogger()
  const seedContext = createTestContext()

  // Change to the test directory
  const originalCwd = process.cwd()
  process.chdir(cwd)
  try {
    await seedCommand(seedLogger, configFile, [], seedContext)
    assert.fail('Should have thrown an error')
  } catch (err) {
    assert.ok(err.message.includes('Missing seed file'))
  } finally {
    process.chdir(originalCwd)
  }
})

test('seed and start from cwd', async t => {
  const { connectionInfo, dropTestDB } = await getConnectionInfo('sqlite')

  const cwd = join(import.meta.dirname, '..', 'fixtures', 'sqlite')
  const configFile = join(cwd, 'platformatic.db.json')

  const migrationsLogger = createCapturingLogger()
  const migrationsContext = createTestContext()

  process.env.DATABASE_URL = connectionInfo.connectionString
  await applyMigrations(migrationsLogger, configFile, [], migrationsContext)

  const seedLogger = createCapturingLogger()
  const seedContext = createTestContext()

  // Change to the test directory so seed can find seed.js
  const originalCwd = process.cwd()
  process.chdir(cwd)
  try {
    await seedCommand(seedLogger, configFile, ['seed.js'], seedContext)
  } finally {
    process.chdir(originalCwd)
  }

  const seedOutput = seedLogger.getCaptured()
  assert.match(seedOutput, /Seeding from .*seed\.js/)

  const { child, url } = await start([], {
    cwd,
    env: {
      DATABASE_URL: connectionInfo.connectionString
    }
  })

  t.after(async () => {
    await safeKill(child)
    await dropTestDB()
  })

  {
    const res = await request(`${url}/graphql`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
              query {
                graphs {
                  id
                  name
                }
              }
            `
      })
    })
    assert.equal(res.statusCode, 200, 'graphs status code')
    const body = await res.body.json()
    assert.deepEqual(
      body,
      {
        data: {
          graphs: [
            {
              id: '1',
              name: 'Hello'
            },
            {
              id: '2',
              name: 'Hello 2'
            }
          ]
        }
      },
      'graphs response'
    )
  }
})
