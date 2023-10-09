import assert from 'node:assert/strict'
import { test } from 'node:test'
import { execa } from 'execa'
import { getConnectionInfo } from '../helper.js'
import { cliPath, getFixturesConfigFileLocation } from './helper.mjs'

test('missing config', async (t) => {
  await assert.rejects(execa('node', [cliPath, 'start']))
})

test('missing connectionString', async (t) => {
  await assert.rejects(execa('node', [cliPath, 'start', '-c', getFixturesConfigFileLocation('no-connectionString.json')]))
})

test('missing migrations', async (t) => {
  const { connectionInfo, dropTestDB } = await getConnectionInfo('postgresql')
  t.after(async () => { await dropTestDB() })

  await assert.rejects(execa(
    'node', [cliPath, 'start', '-c', getFixturesConfigFileLocation('no-migrations.json')],
    {
      env: {
        DATABASE_URL: connectionInfo.connectionString
      }
    }
  ))
})

test('missing migrations.dir', async (t) => {
  const { connectionInfo, dropTestDB } = await getConnectionInfo('postgresql')
  t.after(async () => { await dropTestDB() })

  await assert.rejects(execa(
    'node', [cliPath, 'start', '-c', getFixturesConfigFileLocation('no-migrations-dir.json')],
    {
      env: {
        DATABASE_URL: connectionInfo.connectionString
      }
    }
  ))
})

test('not applied migrations', async (t) => {
  const { connectionInfo, dropTestDB } = await getConnectionInfo('postgresql')
  t.after(async () => { await dropTestDB() })

  await assert.rejects(execa(
    'node', [cliPath, 'start', '-c', getFixturesConfigFileLocation('bad-migrations.json')],
    {
      env: {
        DATABASE_URL: connectionInfo.connectionString
      }
    }
  ))
})
