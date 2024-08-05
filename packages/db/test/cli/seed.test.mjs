import { createDirectory } from '@platformatic/utils'
import { execa } from 'execa'
import assert from 'node:assert/strict'
import { copyFile, mkdtemp, readdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import rimraf from 'rimraf'
import stripAnsi from 'strip-ansi'
import { request } from 'undici'
import { urlDirname } from '../../lib/utils.js'
import { getConnectionInfo } from '../helper.js'
import { cliPath, start } from './helper.js'

test('seed and start', async t => {
  const { connectionInfo, dropTestDB } = await getConnectionInfo('sqlite')

  const cwd = join(urlDirname(import.meta.url), '..', 'fixtures', 'sqlite')
  const seed = join(urlDirname(import.meta.url), '..', 'fixtures', 'sqlite', 'seed.js')

  await execa('node', [cliPath, 'migrations', 'apply'], {
    cwd,
    env: {
      DATABASE_URL: connectionInfo.connectionString,
    },
  })
  const { stdout } = await execa('node', [cliPath, 'seed', seed], {
    cwd,
    env: {
      DATABASE_URL: connectionInfo.connectionString,
    },
  })

  {
    const sanitized = stripAnsi(stdout)
    assert.match(sanitized, /seeding from .*seed\.js/)
    assert.match(sanitized, /42/) // custom logger.info line from the seed file
    assert.match(sanitized, /seeding complete/)
  }

  const { child, url } = await start([], {
    cwd,
    env: {
      DATABASE_URL: connectionInfo.connectionString,
    },
  })

  t.after(async () => {
    child.kill('SIGINT')
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
            `,
      }),
    })
    assert.equal(res.statusCode, 200, 'graphs status code')
    const body = await res.body.json()
    assert.deepEqual(body, {
      data: {
        graphs: [
          {
            id: '1',
            name: 'Hello',
          },
          {
            id: '2',
            name: 'Hello 2',
          },
        ],
      },
    })
  }
})

test('seed command should throw an error if there are migrations to apply', async t => {
  const { connectionInfo, dropTestDB } = await getConnectionInfo('sqlite')

  const cwd = join(urlDirname(import.meta.url), '..', 'fixtures', 'sqlite')
  const seed = join(urlDirname(import.meta.url), '..', 'fixtures', 'sqlite', 'seed.js')

  t.after(async () => {
    await dropTestDB()
  })

  try {
    await execa('node', [cliPath, 'seed', seed], {
      cwd,
      env: {
        DATABASE_URL: connectionInfo.connectionString,
      },
    })
  } catch (err) {
    const sanitized = stripAnsi(err.stderr)
    assert.match(sanitized, /You have migrations to apply. Please run `platformatic db migrations apply` first./)
  }
})

test('valid config files', async t => {
  const fixturesDir = join(urlDirname(import.meta.url), '..', 'fixtures')
  const validConfigFiles = await readdir(join(fixturesDir, 'valid-config-files'))

  for (const configFile of validConfigFiles) {
    const { connectionInfo, dropTestDB } = await getConnectionInfo('sqlite')

    const cwd = await mkdtemp(join(tmpdir(), 'seed-'))

    await copyFile(join(fixturesDir, 'valid-config-files', configFile), join(cwd, configFile))
    await createDirectory(join(cwd, 'migrations'))
    await copyFile(join(fixturesDir, 'sqlite', 'migrations', '001.do.sql'), join(cwd, 'migrations', '001.do.sql'))
    const seed = join(urlDirname(import.meta.url), '..', 'fixtures', 'sqlite', 'seed.js')

    await execa('node', [cliPath, 'migrations', 'apply'], {
      cwd,
      env: {
        DATABASE_URL: connectionInfo.connectionString,
      },
    })
    const { stdout } = await execa('node', [cliPath, 'seed', seed], {
      cwd,
      env: {
        DATABASE_URL: connectionInfo.connectionString,
      },
    })

    {
      const sanitized = stripAnsi(stdout)
      assert.match(sanitized, /seeding complete/)
    }

    t.after(async () => {
      rimraf.sync(cwd)
      await dropTestDB()
    })
  }
})

test('missing config file', async t => {
  try {
    await execa('node', [cliPath, 'seed'])
  } catch (err) {
    assert.equal(err.exitCode, 1)
    assert.ok(err.stderr.includes('Missing config file'))
  }
})

test('missing seed file', async t => {
  const { connectionInfo, dropTestDB } = await getConnectionInfo('sqlite')
  const cwd = join(urlDirname(import.meta.url), '..', 'fixtures', 'sqlite')

  t.after(async () => {
    await dropTestDB()
  })

  try {
    await execa('node', [cliPath, 'migrations', 'apply'], {
      cwd,
      env: {
        DATABASE_URL: connectionInfo.connectionString,
      },
    })
    await execa('node', [cliPath, 'seed'], {
      cwd,
      env: {
        DATABASE_URL: connectionInfo.connectionString,
      },
    })
  } catch (err) {
    assert.equal(err.exitCode, 1)
    assert.ok(err.stderr.includes('Missing seed file'))
  }
})

test('seed and start from cwd', async t => {
  const { connectionInfo, dropTestDB } = await getConnectionInfo('sqlite')

  const cwd = join(urlDirname(import.meta.url), '..', 'fixtures', 'sqlite')

  await execa('node', [cliPath, 'migrations', 'apply'], {
    cwd,
    env: {
      DATABASE_URL: connectionInfo.connectionString,
    },
  })
  const { stdout } = await execa('node', [cliPath, 'seed', 'seed.js'], {
    cwd,
    env: {
      DATABASE_URL: connectionInfo.connectionString,
    },
  })

  {
    const sanitized = stripAnsi(stdout)
    assert.match(sanitized, /seeding from .*seed\.js/)
  }

  const { child, url } = await start([], {
    cwd,
    env: {
      DATABASE_URL: connectionInfo.connectionString,
    },
  })

  t.after(async () => {
    child.kill('SIGINT')
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
            `,
      }),
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
              name: 'Hello',
            },
            {
              id: '2',
              name: 'Hello 2',
            },
          ],
        },
      },
      'graphs response'
    )
  }
})
