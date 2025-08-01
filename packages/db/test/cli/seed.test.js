import { createDirectory } from '@platformatic/utils'
import { execa } from 'execa'
import assert from 'node:assert/strict'
import { copyFile, mkdtemp, readdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import rimraf from 'rimraf'
import { request } from 'undici'
import { getConnectionInfo } from '../helper.js'
import { cliPath, safeKill, start } from './helper.js'

test('seed and start', async t => {
  const { connectionInfo, dropTestDB } = await getConnectionInfo('sqlite')

  const cwd = join(import.meta.dirname, '..', 'fixtures', 'sqlite')
  const configFile = join(cwd, 'platformatic.db.json')

  await execa('node', [cliPath, 'applyMigrations', configFile], {
    cwd,
    env: {
      DATABASE_URL: connectionInfo.connectionString
    }
  })
  const { stdout } = await execa('node', [cliPath, 'seed', configFile, 'seed.js'], {
    cwd,
    env: {
      DATABASE_URL: connectionInfo.connectionString
    }
  })

  assert.match(stdout, /Seeding from .*seed\.js/)
  assert.match(stdout, /42/) // custom logger.info line from the seed file
  assert.match(stdout, /Seeding complete/)

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

  try {
    await execa('node', [cliPath, 'seed', configFile, 'seed.js'], {
      cwd,
      env: {
        DATABASE_URL: connectionInfo.connectionString
      }
    })
  } catch (err) {
    assert.match(err.stdout, /You must apply migrations before seeding the database./)
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

    await execa('node', [cliPath, 'applyMigrations', dbConfigFile], {
      cwd,
      env: {
        DATABASE_URL: connectionInfo.connectionString
      }
    })
    const { stdout } = await execa('node', [cliPath, 'seed', dbConfigFile, seed], {
      cwd,
      env: {
        DATABASE_URL: connectionInfo.connectionString
      }
    })

    assert.match(stdout, /Seeding complete/)

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

  try {
    await execa('node', [cliPath, 'applyMigrations', configFile], {
      cwd,
      env: {
        DATABASE_URL: connectionInfo.connectionString
      }
    })
    await execa('node', [cliPath, 'seed', configFile], {
      cwd,
      env: {
        DATABASE_URL: connectionInfo.connectionString
      }
    })
  } catch (err) {
    assert.equal(err.exitCode, 1)
    assert.ok(err.stderr.includes('Missing seed file'))
  }
})

test('seed and start from cwd', async t => {
  const { connectionInfo, dropTestDB } = await getConnectionInfo('sqlite')

  const cwd = join(import.meta.dirname, '..', 'fixtures', 'sqlite')
  const configFile = join(cwd, 'platformatic.db.json')

  await execa('node', [cliPath, 'applyMigrations', configFile], {
    cwd,
    env: {
      DATABASE_URL: connectionInfo.connectionString
    }
  })
  const { stdout } = await execa('node', [cliPath, 'seed', configFile, 'seed.js'], {
    cwd,
    env: {
      DATABASE_URL: connectionInfo.connectionString
    }
  })

  assert.match(stdout, /Seeding from .*seed\.js/)

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
