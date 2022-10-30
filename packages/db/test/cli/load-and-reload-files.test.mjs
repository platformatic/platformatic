import { start, connectAndResetDB } from './helper.mjs'
import { test } from 'tap'
import { request } from 'undici'
import { join, basename } from 'path'
import os from 'os'
import { writeFile } from 'fs/promises'
import { setTimeout as sleep } from 'timers/promises'

const isWindows = os.platform() === 'win32'

test('load and reload', { skip: isWindows }, async ({ teardown, equal, same, comment }) => {
  const db = await connectAndResetDB()
  teardown(() => db.dispose())

  await db.query(db.sql`CREATE TABLE pages (
    id SERIAL PRIMARY KEY,
    title VARCHAR(42)
  );`)

  const file = join(os.tmpdir(), `some-plugin-${process.pid}.js`)
  const config = join(os.tmpdir(), `config-${process.pid}.json`)

  await Promise.all([
    writeFile(file, `
      module.exports = async function (app) {
      }`
    ),

    writeFile(config, `
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
  "authorization": {}
}
    `)
  ])

  comment('files written')

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

  await sleep(500)

  child.kill('SIGUSR2')

  // the plugin is reloaded
  for await (const log of child.ndj) {
    comment(log.msg)
    if (log.msg === 'loaded') {
      break
    }
  }

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

test('hotreload disabled', { skip: isWindows }, async ({ teardown, equal, same, comment }) => {
  const db = await connectAndResetDB()
  teardown(() => db.dispose())

  await db.query(db.sql`CREATE TABLE pages (
    id SERIAL PRIMARY KEY,
    title VARCHAR(42)
  );`)
  const file = join(os.tmpdir(), `some-plugin-${process.pid}.js`)
  const config = join(os.tmpdir(), `config-${process.pid}.json`)

  await Promise.all([
    writeFile(file, `
      module.exports = async function plugin (app) {
        app.get('/test', {}, async function (request, response) {
          return { res: "plugin, version 1"}
        })
      }`
    ),

    writeFile(config, `
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
    "stopTimeout": 1000,
    "watch": true,
    "watchOptions": {
      "hotReload": false
    }
  },
  "core": {
    "connectionString": "postgres://postgres:postgres@127.0.0.1/postgres"
  },
  "authorization": {}
}
    `)
  ])

  comment('files written')

  const { child, url } = await start('-c', config)

  comment('server started')

  {
    const res = await request(`${url}/test`, {
      method: 'GET'
    })
    equal(res.statusCode, 200)
    same(await res.body.json(), { res: 'plugin, version 1' }, 'get rest plugin')
  }

  await writeFile(file, `
    module.exports = async function plugin (app) {
      app.get('/test', {}, async function (request, response) {
        return { res: "plugin, version 2"}
      })
    }`
  )

  await sleep(500)
  child.kill('SIGUSR2')

  {
    const res = await request(`${url}/test`, {
      method: 'GET'
    })
    equal(res.statusCode, 200)
    // must be unchanged
    same(await res.body.json(), { res: 'plugin, version 1' }, 'get rest plugin')
  }

  child.kill('SIGINT')
})

test('hotreload disabled with default export', { skip: isWindows }, async ({ teardown, equal, same, comment }) => {
  const db = await connectAndResetDB()
  teardown(() => db.dispose())

  await db.query(db.sql`CREATE TABLE pages (
    id SERIAL PRIMARY KEY,
    title VARCHAR(42)
  );`)
  const file = join(os.tmpdir(), `some-plugin-${process.pid}.js`)
  const config = join(os.tmpdir(), `config-${process.pid}.json`)

  await Promise.all([
    writeFile(file, `
      Object.defineProperty(exports, "__esModule", { value: true })
      exports.default = async function plugin (app) {
        app.get('/test', {}, async function (request, response) {
          return { res: "plugin, version 1"}
        })
      }`
    ),

    writeFile(config, `
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
    "stopTimeout": 1000,
    "watch": true,
    "watchOptions": {
      "hotReload": false
    }
  },
  "core": {
    "connectionString": "postgres://postgres:postgres@127.0.0.1/postgres"
  },
  "authorization": {}
}
    `)
  ])

  comment('files written')

  const { child, url } = await start('-c', config)

  comment('server started')

  {
    const res = await request(`${url}/test`, {
      method: 'GET'
    })
    equal(res.statusCode, 200)
    same(await res.body.json(), { res: 'plugin, version 1' }, 'get rest plugin')
  }

  await writeFile(file, `
    Object.defineProperty(exports, "__esModule", { value: true })
    exports.default = async function plugin (app) {
      app.get('/test', {}, async function (request, response) {
        return { res: "plugin, version 2"}
      })
    }`
  )

  await sleep(500)
  child.kill('SIGUSR2')

  {
    const res = await request(`${url}/test`, {
      method: 'GET'
    })
    equal(res.statusCode, 200)
    // must be unchanged
    same(await res.body.json(), { res: 'plugin, version 1' }, 'get rest plugin')
  }

  child.kill('SIGINT')
})

test('hotreload disabled with default export', { skip: isWindows }, async ({ teardown, equal, same, comment }) => {
  const db = await connectAndResetDB()
  teardown(() => db.dispose())

  await db.query(db.sql`CREATE TABLE pages (
    id SERIAL PRIMARY KEY,
    title VARCHAR(42)
  );`)
  const file = join(os.tmpdir(), `some-plugin-${process.pid}.js`)
  const config = join(os.tmpdir(), `config-${process.pid}.json`)

  await Promise.all([
    writeFile(file, `
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.default = (app) => {
        app.get('/test', {}, async function (request, response) {
          return { res: "plugin, version 1"}
        })
      };`
    ),

    writeFile(config, `
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
    "stopTimeout": 1000,
    "watch": true,
    "watchOptions": {
      "hotReload": false
    }
  },
  "core": {
    "connectionString": "postgres://postgres:postgres@127.0.0.1/postgres"
  },
  "authorization": {}
}
    `)
  ])

  comment('files written')

  const { child, url } = await start('-c', config)

  comment('server started')

  {
    const res = await request(`${url}/test`, {
      method: 'GET'
    })
    equal(res.statusCode, 200)
    same(await res.body.json(), { res: 'plugin, version 1' }, 'get rest plugin')
  }

  await writeFile(file, `
    module.exports = async function plugin (app) {
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.default = (app) => {
        app.get('/test', {}, async function (request, response) {
          return { res: "plugin, version 2"}
        })
      };`
  )

  await sleep(500)
  child.kill('SIGUSR2')

  {
    const res = await request(`${url}/test`, {
      method: 'GET'
    })
    equal(res.statusCode, 200)
    // must be unchanged
    same(await res.body.json(), { res: 'plugin, version 1' }, 'get rest plugin')
  }

  child.kill('SIGINT')
})

test('do not crash on reload', { skip: isWindows }, async ({ teardown, match, comment }) => {
  const db = await connectAndResetDB()
  teardown(() => db.dispose())

  await db.query(db.sql`CREATE TABLE pages (
    id SERIAL PRIMARY KEY,
    title VARCHAR(42)
  );`)

  const file = join(os.tmpdir(), `some-plugin-${process.pid}.js`)
  const config = join(os.tmpdir(), `config-${process.pid}.json`)

  await Promise.all([
    writeFile(file, `
      module.exports = async function (app) {
      }`
    ),

    writeFile(config, `
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
  }
}
    `)
  ])

  comment('files written')

  const { child } = await start('-c', config)
  // child.stderr.pipe(process.stderr)

  comment('server started')

  await writeFile(file, `
    module.exports = async function (app) {
      console.error('plugin loaded')
      throw new Error('kaboom')
    }`)

  await sleep(500)

  child.kill('SIGUSR2')
  comment('signal sent')

  // the plugin is reloaded
  for await (const log of child.ndj) {
    comment(log.msg)
    if (log.msg === 'failed to restart') {
      break
    }
  }

  child.kill('SIGINT')
})

test('log the error', { skip: isWindows }, async ({ teardown, match, comment }) => {
  const db = await connectAndResetDB()
  teardown(() => db.dispose())

  await db.query(db.sql`CREATE TABLE pages (
    id SERIAL PRIMARY KEY,
    title VARCHAR(42)
  );`)

  const file = join(os.tmpdir(), `some-plugin-${process.pid}.js`)
  const config = join(os.tmpdir(), `config-${process.pid}.json`)

  await Promise.all([
    writeFile(file, `
      module.exports = async function (app) {
      }`
    ),

    writeFile(config, `
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
  }
}
    `)
  ])

  comment('files written')

  const { child } = await start('-c', config)
  // child.stderr.pipe(process.stderr)

  comment('server started')

  await writeFile(file, `
    module.exports = async function (app) {
      console.error('plugin loaded')
      setTimeout(() => {
        console.error('timeout triggered')
        throw new Error('kaboom')
      }, 2000)
    }`)

  await sleep(500)
  comment('sending signal')
  child.kill('SIGUSR2')

  for await (const log of child.ndj) {
    if (log.message === 'error encounterated within the isolate, routing to uncaughtException, use onError option to catch') {
      match(log, {
        err: {
          message: 'kaboom'
        }
      })
    }

    if (log.message === 'exiting') {
      match(log, {
        err: {
          message: 'kaboom'
        }
      })
    }
  }
})
