import { start, connectAndResetDB } from './helper.mjs'
import { test } from 'tap'
import { request } from 'undici'
import { join, basename } from 'path'
import os from 'os'
import { writeFile, mkdir } from 'fs/promises'
import { setTimeout as sleep } from 'timers/promises'

test('watch file', async ({ teardown, equal, same, comment }) => {
  const db = await connectAndResetDB()
  teardown(() => db.dispose())

  await db.query(db.sql`CREATE TABLE pages (
    id SERIAL PRIMARY KEY,
    title VARCHAR(42)
  );`)

  const file = join(os.tmpdir(), `some-plugin-${process.pid}.js`)
  const config = join(os.tmpdir(), `config-${process.pid}.json`)

  await writeFile(config, `
{ 
  "server": {
    "logger": {
      "level": "info"
    },
    "hostname": "127.0.0.1",
    "port": 0
  },
  "core": {
    "connectionString": "postgres://postgres:postgres@127.0.0.1/postgres"
  }
}
    `)

  comment('file written')

  const { child, url } = await start('-c', config)

  comment('server started')

  {
    const res = await request(`${url}/graphql`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          query {
            add(x: 2, y: 2)
          }
        `
      })
    })
    equal(res.statusCode, 400, 'add status code')
    same(await res.body.json(), {
      data: null,
      errors: [{
        message: 'Cannot query field "add" on type "Query".',
        locations: [{
          line: 3,
          column: 13
        }]
      }]
    }, 'add response')
  }

  comment('updating files')

  await writeFile(file, `
    module.exports = async function (app) {
      app.log.info('loaded')
      app.graphql.extendSchema(\`
        extend type Query {
          add(x: Int, y: Int): Int
        }
      \`)
      app.graphql.defineResolvers({
        Query: {
          add: async (_, { x, y }) => x + y
        }
      })
    }`)

  await writeFile(config, `
{ 
  "server": {
    "logger": {
      "level": "info"
    },
    "hostname": "127.0.0.1",
    "port": 0
  },
  "plugin": {
    "path": "./${basename(file)}",
    "stopTimeout": 1000
  },
  "core": {
    "connectionString": "postgres://postgres:postgres@127.0.0.1/postgres"
  },
  "authorization": {},
  "dashboard": {}
}
    `)

  for await (const log of child.ndj) {
    comment(log.msg)
    if (log.msg === 'loaded') {
      break
    }
  }

  comment('reloaded')

  {
    const res = await request(`${url}/graphql`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          query {
            add(x: 2, y: 2)
          }
        `
      })
    })
    equal(res.statusCode, 200, 'add status code')
    same(await res.body.json(), {
      data: {
        add: 4
      }
    }, 'add response')
  }

  child.kill('SIGINT')
})

test('do not watch ignored file', async ({ teardown, equal, same, comment }) => {
  const db = await connectAndResetDB()
  teardown(() => db.dispose())

  await db.query(db.sql`CREATE TABLE pages (
    id SERIAL PRIMARY KEY,
    title VARCHAR(42)
  );`)

  const folder = join(os.tmpdir(), `plt-${process.pid}`)
  await mkdir(folder)
  const pluginFile = join(folder, 'some-plugin-.js')
  comment('plugin file is ' + pluginFile)

  await writeFile(pluginFile, `
    module.exports = async function (app) {
      app.graphql.extendSchema(\`
        extend type Query {
          add(x: Int, y: Int): Int
        }
      \`)
      app.graphql.defineResolvers({
        Query: {
          add: async (_, { x, y }) => x + y
        }
      })
    }`
  )
  const config = join(folder, `config-${process.pid}.json`)
  await writeFile(config, `
{ 
  "server": {
    "logger": {
      "level": "info"
    },
    "hostname": "127.0.0.1",
    "port": 0
  },
  "plugin": {
    "path": "./${basename(pluginFile)}",
    "stopTimeout": 1000
  },
  "core": {
    "connectionString": "postgres://postgres:postgres@127.0.0.1/postgres"
  }
}
    `)

  const { child, url } = await start('-c', config, '--watch-ignore', basename(pluginFile))

  await writeFile(pluginFile, `
    module.exports = async function (app) {
      app.log.info('loaded')
      app.graphql.extendSchema(\`
        extend type Query {
          add(x: Int, y: Int): Int
        }
      \`)
      app.graphql.defineResolvers({
        Query: {
          add: async (_, { x, y }) => x + y + 20
        }
      })
    }`
  )

  await sleep(5000)

  {
    // plugin is not reloaded
    const res = await request(`${url}/graphql`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          query {
            add(x: 2, y: 2)
          }
        `
      })
    })
    equal(res.statusCode, 200, 'add status code')
    same(await res.body.json(), {
      data: {
        add: 4
      }
    }, 'add response')
  }

  child.kill('SIGINT')
})

test('does not loop forever when doing ESM', async ({ teardown, equal, same, comment }) => {
  const db = await connectAndResetDB()
  teardown(() => db.dispose())

  await db.query(db.sql`CREATE TABLE pages (
    id SERIAL PRIMARY KEY,
    title VARCHAR(42)
  );`)

  const folder = join(os.tmpdir(), `plt-${process.pid}-2`)
  await mkdir(folder)
  const pluginFile = join(folder, 'some-plugin.mjs')
  comment('plugin file is ' + pluginFile)

  await writeFile(pluginFile, `
    export default async function (app) {
      app.graphql.extendSchema(\`
        extend type Query {
          add(x: Int, y: Int): Int
        }
      \`)
      app.graphql.defineResolvers({
        Query: {
          add: async (_, { x, y }) => x + y
        }
      })
    }`
  )
  const config = join(folder, `config-${process.pid}.json`)
  await writeFile(config, `
{ 
  "server": {
    "logger": {
      "level": "info"
    },
    "hostname": "127.0.0.1",
    "port": 0
  },
  "plugin": {
    "path": "./${basename(pluginFile)}",
    "stopTimeout": 1000
  },
  "core": {
    "connectionString": "postgres://postgres:postgres@127.0.0.1/postgres"
  }
}
    `)

  const { child } = await start('-c', config, '--watch-ignore', basename(pluginFile))

  await sleep(5000)

  child.kill('SIGINT')

  const lines = []
  for await (const line of child.ndj) {
    lines.push(line)
  }
  // lines will have a series of "config changed"
  // messages without an ignore
  equal(lines.length <= 2, true)
})
