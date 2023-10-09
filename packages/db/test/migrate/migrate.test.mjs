import assert from 'node:assert/strict'
import { test } from 'node:test'
import { statSync, utimesSync } from 'node:fs'
import { execa } from 'execa'
import stripAnsi from 'strip-ansi'
import { getConnectionInfo } from '../helper.js'
import { cliPath, getFixturesConfigFileLocation } from './helper.mjs'

test('migrate up', async (t) => {
  const { connectionInfo, dropTestDB } = await getConnectionInfo('postgresql')
  t.after(async () => { await dropTestDB() })

  const { stdout } = await execa(
    'node', [cliPath, 'start', '-c', getFixturesConfigFileLocation('simple.json')],
    {
      env: {
        DATABASE_URL: connectionInfo.connectionString
      }
    }
  )

  const sanitized = stripAnsi(stdout)
  assert.ok(sanitized.includes('001.do.sql'))
})

test('migrate up & down specifying a version with "to"', async (t) => {
  const { connectionInfo, dropTestDB } = await getConnectionInfo('postgresql')
  t.after(async () => { await dropTestDB() })

  {
    const { stdout } = await execa(
      'node', [cliPath, 'start', '-c', getFixturesConfigFileLocation('simple.json')],
      {
        env: {
          DATABASE_URL: connectionInfo.connectionString
        }
      }
    )
    const sanitized = stripAnsi(stdout)
    assert.ok(sanitized.includes('001.do.sql'))
  }

  {
    const { stdout } = await execa(
      'node', [cliPath, 'start', '-c', getFixturesConfigFileLocation('simple.json'), '-t', '000'],
      {
        env: {
          DATABASE_URL: connectionInfo.connectionString
        }
      }
    )
    const sanitized = stripAnsi(stdout)
    assert.ok(sanitized.includes('001.undo.sql'))
  }
})

test('ignore versions', async (t) => {
  const { connectionInfo, dropTestDB } = await getConnectionInfo('postgresql')
  t.after(async () => { await dropTestDB() })

  const { stdout } = await execa(
    'node', [cliPath, 'start', '-c', getFixturesConfigFileLocation('simple.json')],
    {
      env: {
        DATABASE_URL: connectionInfo.connectionString
      }
    }
  )
  const sanitized = stripAnsi(stdout)
  assert.ok(sanitized.includes('001.do.sql'))
})

test('migrations rollback', async (t) => {
  const { connectionInfo, dropTestDB } = await getConnectionInfo('postgresql')
  t.after(async () => { await dropTestDB() })

  {
    // apply all migrations
    const { stdout } = await execa(
      'node', [cliPath, 'start', '-c', getFixturesConfigFileLocation('multiple-migrations.json')],
      {
        env: {
          DATABASE_URL: connectionInfo.connectionString
        }
      }
    )
    const sanitized = stripAnsi(stdout)
    assert.ok(sanitized.includes('001.do.sql'))
    assert.ok(sanitized.includes('002.do.sql'))
    assert.ok(sanitized.includes('003.do.sql'))
  }

  // Down to no migrations applied
  {
    const { stdout } = await execa(
      'node', [cliPath, 'start', '-c', getFixturesConfigFileLocation('multiple-migrations.json'), '-r'],
      {
        env: {
          DATABASE_URL: connectionInfo.connectionString
        }
      }
    )
    const sanitized = stripAnsi(stdout)
    assert.ok(sanitized.includes('003.undo.sql'))
  }

  {
    const { stdout } = await execa(
      'node', [cliPath, 'start', '-c', getFixturesConfigFileLocation('multiple-migrations.json'), '-r'],
      {
        env: {
          DATABASE_URL: connectionInfo.connectionString
        }
      }
    )
    const sanitized = stripAnsi(stdout)
    assert.ok(sanitized.includes('002.undo.sql'))
  }

  {
    const { stdout } = await execa(
      'node', [cliPath, 'start', '-c', getFixturesConfigFileLocation('multiple-migrations.json'), '-r'],
      {
        env: {
          DATABASE_URL: connectionInfo.connectionString
        }
      }
    )
    const sanitized = stripAnsi(stdout)
    assert.ok(sanitized.includes('001.undo.sql'))
  }

  {
    const { stdout } = await execa(
      'node', [cliPath, 'start', '-c', getFixturesConfigFileLocation('multiple-migrations.json'), '-r'],
      {
        env: {
          DATABASE_URL: connectionInfo.connectionString
        }
      }
    )
    const sanitized = stripAnsi(stdout)
    assert.ok(sanitized.includes('No migrations to rollback'))
  }

  // ...and back!
  {
    // apply all migrations
    const { stdout } = await execa(
      'node', [cliPath, 'start', '-c', getFixturesConfigFileLocation('multiple-migrations.json')],
      {
        env: {
          DATABASE_URL: connectionInfo.connectionString
        }
      }
    )
    const sanitized = stripAnsi(stdout)
    assert.ok(sanitized.includes('001.do.sql'))
    assert.ok(sanitized.includes('002.do.sql'))
    assert.ok(sanitized.includes('003.do.sql'))
  }
})

test('after a migration, platformatic config is touched', async (t) => {
  const { connectionInfo, dropTestDB } = await getConnectionInfo('postgresql')
  t.after(async () => { await dropTestDB() })

  const d = new Date()
  d.setFullYear(d.getFullYear() - 1)
  utimesSync(getFixturesConfigFileLocation('simple.json'), d, d)
  const { mtime: mtimePrev } = statSync(getFixturesConfigFileLocation('simple.json'))
  {
    const { stdout } = await execa(
      'node', [cliPath, 'start', '-c', getFixturesConfigFileLocation('simple.json')],
      {
        env: {
          DATABASE_URL: connectionInfo.connectionString
        }
      }
    )
    const sanitized = stripAnsi(stdout)
    assert.ok(sanitized.includes('001.do.sql'))

    const { mtime: mtimeAfter } = statSync(getFixturesConfigFileLocation('simple.json'))
    assert.notDeepEqual(mtimePrev, mtimeAfter)
  }
})
