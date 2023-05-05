'use strict'

require('./helper')
const { test } = require('tap')
const { buildServer } = require('..')
const { request, setGlobalDispatcher, getGlobalDispatcher, MockAgent } = require('undici')
const { join } = require('path')
const os = require('os')
const { writeFile } = require('fs/promises')

test('load and reload', async ({ teardown, equal, pass, same }) => {
  const file = join(os.tmpdir(), `some-plugin-${process.pid}.js`)

  await writeFile(file, `
    module.exports = async function (app) {
    }`
  )

  const app = await buildServer({
    server: {
      hostname: '127.0.0.1',
      port: 0
    },
    plugins: {
      paths: [file]
    },
    metrics: false
  })

  teardown(async () => {
    await app.close()
  })
  await app.start()

  {
    const res = await request(`${app.url}/`)
    equal(res.statusCode, 200, 'status code')
    const data = await res.body.json()
    same(data, { message: 'Welcome to Platformatic! Please visit https://oss.platformatic.dev' })
  }

  await writeFile(file, `
    module.exports = async function (app) {
      app.get('/', () => "hello world" )
    }`)

  await app.restart()

  {
    const res = await request(`${app.url}/`)
    equal(res.statusCode, 200, 'add status code')
    same(await res.body.text(), 'hello world', 'response')
  }
})

test('error', async ({ teardown, equal, pass, match }) => {
  const file = join(os.tmpdir(), `some-plugin-${process.pid}.js`)

  await writeFile(file, `
    module.exports = async function (app) {
      app.get('/', () => {
        throw new Error('kaboom')
      })
    }`)

  const app = await buildServer({
    server: {
      hostname: '127.0.0.1',
      port: 0
    },
    plugins: {
      paths: [file]
    },
    metrics: false
  })

  teardown(async () => {
    await app.close()
  })
  await app.start()

  const res = await request(`${app.url}/`)
  equal(res.statusCode, 500, 'add status code')
  match(await res.body.json(), {
    message: 'kaboom'
  })
})

test('mock undici is supported', async ({ teardown, equal, pass, same }) => {
  const previousAgent = getGlobalDispatcher()
  teardown(() => setGlobalDispatcher(previousAgent))

  const mockAgent = new MockAgent({
    keepAliveTimeout: 10,
    keepAliveMaxTimeout: 10
  })
  setGlobalDispatcher(mockAgent)

  const mockPool = mockAgent.get('http://localhost:42')

  // intercept the request
  mockPool.intercept({
    path: '/',
    method: 'GET'
  }).reply(200, {
    hello: 'world'
  })

  const app = await buildServer({
    server: {
      hostname: '127.0.0.1',
      port: 0
    },
    plugins: {
      paths: [join(__dirname, 'fixtures', 'undici-plugin.js')]
    }
  })

  teardown(async () => {
    await app.close()
  })
  await app.start()

  const res = await request(`${app.url}/request`, {
    method: 'GET'
  })
  equal(res.statusCode, 200)
  same(await res.body.json(), {
    hello: 'world'
  })
})

test('load and reload with the fallback', async ({ teardown, equal, pass, same }) => {
  const file = join(os.tmpdir(), `some-plugin-${process.pid}.js`)

  await writeFile(file, `
    module.exports = async function (app) {
    }`
  )

  const app = await buildServer({
    server: {
      hostname: '127.0.0.1',
      port: 0
    },
    plugins: {
      paths: [file],
      stopTimeout: 1000,
      fallback: true
    }
  })

  teardown(async () => {
    await app.close()
  })
  await app.start()

  {
    const res = await request(`${app.url}/`)
    equal(res.statusCode, 200, 'status code')
    const data = await res.body.json()
    same(data, { message: 'Welcome to Platformatic! Please visit https://oss.platformatic.dev' })
  }

  await writeFile(file, `
    module.exports = async function (app) {
      app.get('/', () => "hello world" )
    }`)

  await app.restart()

  {
    const res = await request(`${app.url}/`)
    equal(res.statusCode, 200, 'add status code')
    same(await res.body.text(), 'hello world', 'response')
  }
})

test('load and reload ESM', async ({ teardown, equal, pass, same }) => {
  const file = join(os.tmpdir(), `some-plugin-${process.pid}.mjs`)

  await writeFile(file, `
    export default async function (app) {
    }`
  )

  const app = await buildServer({
    server: {
      hostname: '127.0.0.1',
      port: 0
    },
    plugins: {
      paths: [file]
    }
  })

  teardown(async () => {
    await app.close()
  })
  await app.start()

  {
    const res = await request(`${app.url}/`)
    equal(res.statusCode, 200, 'status code')
    const data = await res.body.json()
    same(data, { message: 'Welcome to Platformatic! Please visit https://oss.platformatic.dev' })
  }

  await writeFile(file, `
    export default async function (app) {
      app.get('/', () => "hello world" )
    }`)

  await app.restart()

  {
    const res = await request(`${app.url}/`)
    equal(res.statusCode, 200, 'add status code')
    same(await res.body.text(), 'hello world', 'response')
  }
})

test('server should be available after reload a compromised plugin', async ({ teardown, equal, pass, same, rejects }) => {
  const file = join(os.tmpdir(), `some-plugin-${process.pid}.js`)

  const workingModule = `
    module.exports = async function (app) {
      (() => { /* console.log('loaded') */ })()
    }`
  const compromisedModule = '//console.log(\'loaded but server fails\')'
  await writeFile(file, workingModule)

  const config = {
    server: {
      hostname: '127.0.0.1',
      port: 0
    },
    plugins: {
      paths: [file]
    }
  }

  const app = await buildServer(config)

  teardown(async () => {
    await app.close()
  })
  await app.start()

  await writeFile(file, compromisedModule)
  await app.restart().catch(() => {
    pass('plugin reload failed')
  })

  {
    const res = await request(`${app.url}/`, { method: 'GET' })
    equal(res.statusCode, 200, 'status code')
    const data = await res.body.json()
    same(data, { message: 'Welcome to Platformatic! Please visit https://oss.platformatic.dev' })
  }

  await writeFile(file, workingModule)
  await app.restart()

  {
    const res = await request(`${app.url}/`, { method: 'GET' })
    equal(res.statusCode, 200, 'add status code')
    const data = await res.body.json()
    same(data, { message: 'Welcome to Platformatic! Please visit https://oss.platformatic.dev' })
  }
})

test('hot reload disabled, CommonJS', async ({ teardown, equal, pass, same }) => {
  const file = join(os.tmpdir(), `some-plugin-hot-rel-test-${process.pid}.js`)

  await writeFile(file, `
    module.exports = async function plugin (app) {
      app.get('/test', {}, async function (request, response) {
        return { res: "plugin, version 1"}
      })
    }`
  )

  const app = await buildServer({
    server: {
      hostname: '127.0.0.1',
      port: 0
    },
    plugins: {
      paths: [file],
      hotReload: false
    }
  })

  teardown(async () => {
    await app.close()
  })
  await app.start()

  {
    const res = await request(`${app.url}/test`, {
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

  await app.restart()

  {
    const res = await request(`${app.url}/test`, {
      method: 'GET'
    })
    equal(res.statusCode, 200)
    // must be unchanged
    same(await res.body.json(), { res: 'plugin, version 1' }, 'get rest plugin')
  }
})

test('hot reload disabled, ESM', async ({ teardown, equal, pass, same }) => {
  const pathToPlugin = join(os.tmpdir(), `some-plugin-hot-rel-test-${process.pid}.mjs`)
  const pathToConfig = join(os.tmpdir(), `platformatic.service.${process.pid}.json`)

  await writeFile(pathToPlugin, `
    export default async function (app) {
      app.get('/test', {}, async function (request, response) {
        return { res: "plugin, version 1"}
      })
    }`
  )

  const config = {
    server: {
      hostname: '127.0.0.1',
      port: 0
    },
    plugins: {
      paths: [pathToPlugin],
      stopTimeout: 1000,
      hotReload: false
    },
    watch: true,
    metrics: false
  }
  await writeFile(pathToConfig, JSON.stringify(config, null, 2))
  const app = await buildServer(pathToConfig)

  teardown(async () => {
    await app.close()
  })
  await app.start()

  {
    const res = await request(`${app.url}/test`, {
      method: 'GET'
    })
    equal(res.statusCode, 200)
    same(await res.body.json(), { res: 'plugin, version 1' }, 'get rest plugin')
  }

  await writeFile(pathToPlugin, `
    export default async function (app) {
      app.get('/test', {}, async function (request, response) {
        return { res: "plugin, version 2"}
      })
    }`
  )

  await app.restart()

  {
    const res = await request(`${app.url}/test`, {
      method: 'GET'
    })
    equal(res.statusCode, 200)
    // must be unchanged
    same(await res.body.json(), { res: 'plugin, version 1' }, 'get rest plugin')
  }
})

test('hot reload disabled, with default export', async ({ teardown, equal, pass, same }) => {
  const pathToPlugin = join(os.tmpdir(), `some-plugin-hot-rel-test-${process.pid}.js`)
  const pathToConfig = join(os.tmpdir(), `platformatic.service.${process.pid}.json`)

  await writeFile(pathToPlugin, `
    Object.defineProperty(exports, "__esModule", { value: true })
    exports.default = async function plugin (app) {
      app.get('/test', {}, async function (request, response) {
        return { res: "plugin, version 1"}
      })
    }`)

  const config = {
    server: {
      hostname: '127.0.0.1',
      port: 0
    },
    plugins: {
      paths: [pathToPlugin],
      stopTimeout: 1000,
      hotReload: false
    },
    watch: true,
    metrics: false
  }

  await writeFile(pathToConfig, JSON.stringify(config, null, 2))
  const app = await buildServer(pathToConfig)

  teardown(async () => {
    await app.close()
  })
  await app.start()

  {
    const res = await request(`${app.url}/test`, {
      method: 'GET'
    })
    same(await res.body.json(), { res: 'plugin, version 1' }, 'get rest plugin')
  }

  await writeFile(pathToPlugin, `
    Object.defineProperty(exports, "__esModule", { value: true })
    exports.default = async function plugin (app) {
      app.get('/test', {}, async function (request, response) {
        return { res: "plugin, version 2"}
      })
    }`
  )

  await app.restart()

  {
    const res = await request(`${app.url}/test`, {
      method: 'GET'
    })
    equal(res.statusCode, 200)
    // must be unchanged
    same(await res.body.json(), { res: 'plugin, version 1' }, 'get rest plugin')
  }
})
