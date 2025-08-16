import assert from 'node:assert/strict'
import { join } from 'node:path'
import { test } from 'node:test'
import { request } from 'undici'
import { createFromConfig, getConnectionInfo } from './helper.js'

test('extend schema via config', async t => {
  const { connectionInfo, dropTestDB } = await getConnectionInfo()

  const schema = `
  extend type Query {
    names: [String]
  }
  `

  const app = await createFromConfig(t, {
    server: {
      hostname: '127.0.0.1',
      port: 0,
      logger: { level: 'fatal' }
    },
    db: {
      ...connectionInfo,
      graphql: {
        schema
      }
    },
    migrations: {
      dir: join(import.meta.dirname, 'fixtures', 'migrations')
    },
    plugins: {
      paths: [join(import.meta.dirname, 'fixtures', 'name-resolver.js')]
    }
  })

  t.after(async () => {
    await app.stop()
    await dropTestDB()
  })
  await app.start({ listen: true })

  {
    const res = await request(`${app.url}/graphql`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        query: `
          query {
            names
          }
        `
      })
    })
    assert.equal(res.statusCode, 200, 'names status code')
    assert.deepEqual(
      await res.body.json(),
      {
        data: {
          names: ['John', 'Jane']
        }
      },
      'namesresponse'
    )
  }
})

test('extend schema via path', async t => {
  const { connectionInfo, dropTestDB } = await getConnectionInfo()

  const app = await createFromConfig(t, {
    server: {
      hostname: '127.0.0.1',
      port: 0,
      logger: { level: 'fatal' }
    },
    db: {
      ...connectionInfo,
      graphql: {
        schemaPath: join(import.meta.dirname, 'fixtures', 'names.graphql')
      }
    },
    plugins: {
      paths: [join(import.meta.dirname, 'fixtures', 'name-resolver.js')]
    }
  })

  t.after(async () => {
    await app.stop()
    await dropTestDB()
  })
  await app.start({ listen: true })

  {
    const res = await request(`${app.url}/graphql`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        query: `
          query {
            names
          }
        `
      })
    })
    assert.equal(res.statusCode, 200, 'names status code')
    assert.deepEqual(
      await res.body.json(),
      {
        data: {
          names: ['John', 'Jane']
        }
      },
      'namesresponse'
    )
  }
})
