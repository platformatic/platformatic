'use strict'

const jsHelperSqlite = {
  requires: `
const os = require('node:os')
const path = require('node:path')
const fs = require('node:fs/promises')

let counter = 0
`,
  pre: `
  const dbPath = join(os.tmpdir(), 'db-' + process.pid + '-' + counter++ + '.sqlite')
  const connectionString = 'sqlite://' + dbPath
`,
  config: `
  config.migrations.autoApply = true
  config.types.autogenerate = false
  config.db.connectionString = connectionString
`,
  post: `
  t.after(async () => {
    await fs.unlink(dbPath)
  })
`
}

function jsHelperPostgres (connectionString) {
  return {
    // TODO(mcollina): replace sql-mapper
    requires: `
const { createConnectionPool } = require('@platformatic/sql-mapper')
const connectionString = '${connectionString}'
let counter = 0
`,
    pre: `
  const { db, sql } = await createConnectionPool({
    log: {
      debug: () => {},
      info: () => {},
      trace: () => {}
    },
    connectionString,
    poolSize: 1
  })

  const newDB = \`t-\${process.pid}-\${counter++}\`
  t.diagnostic('Creating database ' + newDB)

  await db.query(sql\`
    CREATE DATABASE \${sql.ident(newDB)}
  \`)
`,
    config: `
  config.migrations.autoApply = true
  config.types.autogenerate = false
  config.db.connectionString = connectionString.replace(/\\/[a-zA-Z0-9\\-_]+$/, '/' + newDB)
  config.db.schemalock = false
`,
    post: `
  t.after(async () => {
    t.diagnostic('Disposing test database ' + newDB)
    await db.query(sql\`
      DROP DATABASE \${sql.ident(newDB)}
    \`)
    await db.dispose()
  })
`
  }
}

function jsHelperMySQL (connectionString) {
  return {
    // TODO(mcollina): replace sql-mapper
    requires: `
const { createConnectionPool } = require('@platformatic/sql-mapper')
const connectionString = '${connectionString}'
let counter = 0
`,
    pre: `
  const { db, sql } = await createConnectionPool({
    log: {
      debug: () => {},
      info: () => {},
      trace: () => {}
    },
    connectionString,
    poolSize: 1
  })

  const newDB = \`t-\${process.pid}-\${counter++}\`
  t.diagnostic('Creating database ' + newDB)

  await db.query(sql\`
    CREATE DATABASE \${sql.ident(newDB)}
  \`)
`,
    config: `
  config.migrations.autoApply = true
  config.types.autogenerate = false
  config.db.connectionString = connectionString.replace(/\\/[a-zA-Z0-9\\-_]+$/, '/' + newDB)
  config.db.schemalock = false
`,
    post: `
  t.after(async () => {
    t.diagnostic('Disposing test database ' + newDB)
    await db.query(sql\`
      DROP DATABASE \${sql.ident(newDB)}
    \`)
    await db.dispose()
  })
`
  }
}

const moviesTestJS = `\
'use strict'

const test = require('node:test')
const assert = require('node:assert')
const { getServer } = require('../helper')

test('movies', async (t) => {
  const server = await getServer(t)

  {
    const res = await server.inject({
      method: 'GET',
      url: '/movies'
    })

    assert.strictEqual(res.statusCode, 200)
    assert.deepStrictEqual(res.json(), [])
  }

  let id
  {
    const res = await server.inject({
      method: 'POST',
      url: '/movies',
      body: {
        title: 'The Matrix'
      }
    })

    assert.strictEqual(res.statusCode, 200)
    const body = res.json()
    assert.strictEqual(body.title, 'The Matrix')
    assert.strictEqual(body.id !== undefined, true)
    id = body.id
  }

  {
    const res = await server.inject({
      method: 'GET',
      url: '/movies'
    })

    assert.strictEqual(res.statusCode, 200)
    assert.deepStrictEqual(res.json(), [{
      id,
      title: 'The Matrix'
    }])
  }
})
`

const moviesTestTS = `\
import test from 'node:test'
import assert from 'node:assert'
import { getServer } from '../helper'

test('movies', async (t) => {
  const server = await getServer(t)

  {
    const res = await server.inject({
      method: 'GET',
      url: '/movies'
    })

    assert.strictEqual(res.statusCode, 200)
    assert.deepStrictEqual(res.json(), [])
  }

  let id : Number
  {
    const res = await server.inject({
      method: 'POST',
      url: '/movies',
      body: {
        title: 'The Matrix'
      }
    })

    assert.strictEqual(res.statusCode, 200)
    const body = res.json()
    assert.strictEqual(body.title, 'The Matrix')
    assert.strictEqual(body.id !== undefined, true)
    id = body.id as Number
  }

  {
    const res = await server.inject({
      method: 'GET',
      url: '/movies'
    })

    assert.strictEqual(res.statusCode, 200)
    assert.deepStrictEqual(res.json(), [{
      id,
      title: 'The Matrix'
    }])
  }
})
`

module.exports = {
  jsHelperMySQL,
  jsHelperPostgres,
  jsHelperSqlite,
  moviesTestJS,
  moviesTestTS
}
