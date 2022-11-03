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

  const server = await buildServer({
    server: {
      hostname: '127.0.0.1',
      port: 0
    },
    plugin: {
      path: file
    },
    metrics: false
  })
  teardown(server.stop)
  await server.listen()

  {
    const res = await request(`${server.url}/`)
    equal(res.statusCode, 404, 'status code')
  }

  await writeFile(file, `
    module.exports = async function (app) {
      app.get('/', () => "hello world" ) 
    }`)

  await server.restart()

  {
    const res = await request(`${server.url}/`)
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

  const server = await buildServer({
    server: {
      hostname: '127.0.0.1',
      port: 0
    },
    plugin: {
      path: file
    },
    metrics: false
  })
  teardown(server.stop)
  await server.listen()

  const res = await request(`${server.url}/`)
  equal(res.statusCode, 500, 'add status code')
  match(await res.body.json(), {
    message: 'kaboom'
  })
})

test('update config', async ({ teardown, equal, pass, same }) => {
  const file = join(os.tmpdir(), `some-plugin-${process.pid}.js`)
  await writeFile(file, `
    module.exports = async function (app) {
    }`
  )

  const server = await buildServer({
    server: {
      hostname: '127.0.0.1',
      port: 0
    },
    metrics: false
  })
  teardown(server.stop)
  await server.listen()

  {
    const res = await request(`${server.url}/`)
    equal(res.statusCode, 404, 'status code')
  }

  const file2 = join(os.tmpdir(), `some-plugin-${process.pid}-2.js`)
  await writeFile(file2, `
    module.exports = async function (app) {
      app.get('/', () => "hello world" ) 
    }`)

  await server.restart({
    plugin: {
      path: file2
    }
  })

  {
    const res = await request(`${server.url}/`)
    equal(res.statusCode, 200, 'add status code')
    same(await res.body.text(), 'hello world', 'response')
  }
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

  const server = await buildServer({
    server: {
      hostname: '127.0.0.1',
      port: 0
    },
    plugin: {
      path: join(__dirname, 'fixtures', 'undici-plugin.js')
    }
  })
  teardown(server.stop)
  await server.listen()

  const res = await request(`${server.url}/request`, {
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

  const server = await buildServer({
    server: {
      hostname: '127.0.0.1',
      port: 0
    },
    plugin: {
      path: file,
      stopTimeout: 1000,
      fallback: true
    }
  })
  teardown(server.stop)
  await server.listen()

  {
    const res = await request(`${server.url}/`)
    equal(res.statusCode, 404, 'status code')
  }

  await writeFile(file, `
    module.exports = async function (app) {
      app.get('/', () => "hello world" ) 
    }`)

  await server.restart()

  {
    const res = await request(`${server.url}/`)
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

  const server = await buildServer({
    server: {
      hostname: '127.0.0.1',
      port: 0
    },
    plugin: {
      path: file
    }
  })
  teardown(server.stop)
  await server.listen()

  {
    const res = await request(`${server.url}/`)
    equal(res.statusCode, 404, 'status code')
  }

  await writeFile(file, `
    export default async function (app) {
      app.get('/', () => "hello world" ) 
    }`)

  await server.restart()

  {
    const res = await request(`${server.url}/`)
    equal(res.statusCode, 200, 'add status code')
    same(await res.body.text(), 'hello world', 'response')
  }
})

test('server should be available after reload a compromised plugin', async ({ teardown, equal, pass }) => {
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
    plugin: {
      path: file
    }
  }
  const restartConfig = { ...config }
  delete restartConfig.server

  const server = await buildServer(config)
  await server.listen()
  await writeFile(file, compromisedModule)
  await server.restart(restartConfig).catch(() => {
    pass('plugin reload failed')
  })

  {
    const res = await request(`${server.url}/`, { method: 'GET' })
    equal(res.statusCode, 404, 'status code')
  }

  await writeFile(file, workingModule)
  await server.restart(restartConfig)

  {
    const res = await request(`${server.url}/`, { method: 'GET' })
    equal(res.statusCode, 404, 'add status code')
  }

  teardown(server.stop)
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

  const server = await buildServer({
    server: {
      hostname: '127.0.0.1',
      port: 0
    },
    plugin: {
      path: file,
      watch: true,
      watchOptions: {
        hotReload: false
      }
    }
  })
  teardown(server.stop)
  await server.listen()

  {
    const res = await request(`${server.url}/test`, {
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

  await server.restart()

  {
    const res = await request(`${server.url}/test`, {
      method: 'GET'
    })
    equal(res.statusCode, 200)
    // must be unchanged
    same(await res.body.json(), { res: 'plugin, version 1' }, 'get rest plugin')
  }
})

test('hot reload disabled, ESM', async ({ teardown, equal, pass, same }) => {
  const file = join(os.tmpdir(), `some-plugin-hot-rel-test-${process.pid}.mjs`)

  await writeFile(file, `
    export default async function (app) {
      app.get('/test', {}, async function (request, response) {
        return { res: "plugin, version 1"}
      })
    }`
  )

  const server = await buildServer({
    server: {
      hostname: '127.0.0.1',
      port: 0
    },
    plugin: {
      path: file,
      stopTimeout: 1000,
      watch: true,
      watchOptions: {
        hotReload: false
      }
    },
    metrics: false
  })
  teardown(server.stop)
  await server.listen()

  {
    const res = await request(`${server.url}/test`, {
      method: 'GET'
    })
    equal(res.statusCode, 200)
    same(await res.body.json(), { res: 'plugin, version 1' }, 'get rest plugin')
  }

  await writeFile(file, `
    export default async function (app) {
      app.get('/test', {}, async function (request, response) {
        return { res: "plugin, version 2"}
      })
    }`
  )

  await server.restart()

  {
    const res = await request(`${server.url}/test`, {
      method: 'GET'
    })
    equal(res.statusCode, 200)
    // must be unchanged
    same(await res.body.json(), { res: 'plugin, version 1' }, 'get rest plugin')
  }
})
