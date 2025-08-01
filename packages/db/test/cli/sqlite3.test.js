import { execa } from 'execa'
import assert from 'node:assert/strict'
import { join } from 'node:path'
import test from 'node:test'
import split from 'split2'
import { setTimeout } from 'timers/promises'
import { request } from 'undici'
import { getConnectionInfo } from '../helper.js'
import { cliPath, safeKill, start } from './helper.js'

test('migrate and start', async t => {
  const { connectionInfo, dropTestDB } = await getConnectionInfo('sqlite')
  const cwd = join(import.meta.dirname, '..', 'fixtures', 'sqlite')

  const { stdout } = await execa('node', [cliPath, 'applyMigrations', join(cwd, 'platformatic.db.json')], {
    cwd,
    env: {
      DATABASE_URL: connectionInfo.connectionString
    }
  })

  assert.match(stdout, /001\.do\.sql/)

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
              mutation {
                saveGraph(input: { name: "Hello" }) {
                  id
                  name
                }
              }
            `
      })
    })
    assert.equal(res.statusCode, 200, 'saveGraph status code')
    const body = await res.body.json()
    assert.deepEqual(
      body,
      {
        data: {
          saveGraph: {
            id: '1',
            name: 'Hello'
          }
        }
      },
      'saveGraph response'
    )
  }
})

test('no cwd', async t => {
  const { connectionInfo, dropTestDB } = await getConnectionInfo('sqlite')
  const config = join(import.meta.dirname, '..', 'fixtures', 'sqlite', 'platformatic.db.json')

  const { stdout } = await execa('node', [cliPath, 'applyMigrations', config], {
    env: {
      DATABASE_URL: connectionInfo.connectionString
    }
  })

  assert.ok(stdout.includes('001.do.sql'))

  const { child, url } = await start(['-c', config], {
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
              mutation {
                saveGraph(input: { name: "Hello" }) {
                  id
                  name
                }
              }
            `
      })
    })
    assert.equal(res.statusCode, 200, 'saveGraph status code')
    const body = await res.body.json()
    assert.deepEqual(
      body,
      {
        data: {
          saveGraph: {
            id: '1',
            name: 'Hello'
          }
        }
      },
      'saveGraph response'
    )
  }
})

test('do not restart on save', async t => {
  const { connectionInfo, dropTestDB } = await getConnectionInfo('sqlite')
  const cwd = join(import.meta.dirname, '..', 'fixtures', 'sqlite')

  const { stdout } = await execa('node', [cliPath, 'applyMigrations', join(cwd, 'platformatic.db.json')], {
    cwd,
    env: {
      DATABASE_URL: connectionInfo.connectionString
    }
  })

  assert.match(stdout, /001\.do\.sql/)

  const { child, url } = await start([], {
    cwd,
    env: {
      DATABASE_URL: connectionInfo.connectionString
    }
  })

  t.after(async () => {
    await dropTestDB()
  })

  const splitter = split()
  child.stdout.pipe(splitter)

  {
    const res = await request(`${url}/graphql`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
              mutation {
                saveGraph(input: { name: "Hello" }) {
                  id
                  name
                }
              }
            `
      })
    })
    assert.equal(res.statusCode, 200, 'saveGraph status code')
    const body = await res.body.json()
    assert.deepEqual(
      body,
      {
        data: {
          saveGraph: {
            id: '1',
            name: 'Hello'
          }
        }
      },
      'saveGraph response'
    )
  }

  // We need this timer to allow the debounce logic to run its course
  await setTimeout(1000)

  await safeKill(child)

  for await (const data of splitter) {
    const parsed = JSON.parse(data)
    assert.ok(!parsed.msg.includes('restarted'))
  }
})
