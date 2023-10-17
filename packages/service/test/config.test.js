'use strict'

const os = require('node:os')
const assert = require('node:assert')
const { test } = require('node:test')
const { join } = require('node:path')
const { writeFile, rm } = require('node:fs/promises')
const { request } = require('undici')
const { buildServer } = require('..')
// require('./helper')

test('config reloads', async (t) => {
  const file = join(os.tmpdir(), `${process.pid}-1.js`)

  await writeFile(file, `
    module.exports = async function (app, options) {
      app.get('/', () => options.message)
    }`)

  const app = await buildServer({
    server: {
      hostname: '127.0.0.1',
      port: 0
    },
    plugins: {
      paths: [{
        path: file,
        options: {
          message: 'hello'
        }
      }]
    },
    watch: false,
    metrics: false
  })

  t.after(async () => {
    await app.close()
  })
  await app.start()

  {
    const res = await request(`${app.url}/`)
    assert.strictEqual(res.statusCode, 200, 'add status code')
    assert.deepStrictEqual(await res.body.text(), 'hello', 'response')
  }

  await app.platformatic.configManager.update({
    server: {
      hostname: '127.0.0.1',
      port: 0
    },
    plugins: {
      paths: [{
        path: file,
        options: {
          message: 'ciao mondo'
        }
      }]
    },
    metrics: false
  })

  await app.restart()

  {
    const res = await request(`${app.url}/`)
    assert.strictEqual(res.statusCode, 200, 'add status code')
    assert.deepStrictEqual(await res.body.text(), 'ciao mondo', 'response')
  }
})

test('config reloads from a written file', async (t) => {
  const config = join(os.tmpdir(), `${process.pid}-2.json`)
  const file = join(os.tmpdir(), `${process.pid}-2.js`)

  await writeFile(config, JSON.stringify({
    server: {
      hostname: '127.0.0.1',
      port: 0
    },
    plugins: {
      paths: [{
        path: file,
        options: {
          message: 'hello'
        }
      }]
    },
    metrics: false
  }))

  await writeFile(file, `
    module.exports = async function (app, options) {
      app.get('/', () => options.message)
    }`)

  const app = await buildServer(config)

  t.after(async () => {
    await app.close()
  })
  await app.start()

  {
    const res = await request(`${app.url}/`)
    assert.strictEqual(res.statusCode, 200, 'add status code')
    assert.deepStrictEqual(await res.body.text(), 'hello', 'response')
  }

  await app.platformatic.configManager.update({
    server: {
      hostname: '127.0.0.1',
      port: 0
    },
    plugins: {
      paths: [{
        path: file,
        options: {
          message: 'ciao mondo'
        }
      }]
    },
    metrics: false
  })

  await app.restart()

  {
    const res = await request(`${app.url}/`)
    assert.strictEqual(res.statusCode, 200, 'add status code')
    assert.deepStrictEqual(await res.body.text(), 'ciao mondo', 'response')
  }
})

test('config reloads from a written file from a route', async (t) => {
  const config = join(os.tmpdir(), `${process.pid}-3.json`)
  const file = join(os.tmpdir(), `${process.pid}-3.js`)

  await writeFile(config, JSON.stringify({
    server: {
      hostname: '127.0.0.1',
      logger: { level: 'error' },
      port: 0
    },
    plugins: {
      paths: [{
        path: file,
        options: {
          message: 'hello'
        }
      }]
    },
    metrics: false
  }))

  await writeFile(file, `
    module.exports = async function (app, options) {
      app.get('/', () => options.message)

      app.post('/restart', async (req, res) => {
        await app.platformatic.configManager.update({
          server: {
            hostname: '127.0.0.1',
            port: 0
          },
          plugins: {
            paths: [{
              path: '${file.replace(/\\/g, '\\\\')}',
              options: {
                message: 'ciao mondo'
              }
            }]
          },
          metrics: false
        })

        await app.restart()

        return true
      })
    }`)

  const app = await buildServer(config)

  t.after(async () => {
    await app.close()
  })
  await app.start()

  {
    const res = await request(`${app.url}/`)
    assert.strictEqual(res.statusCode, 200, 'add status code')
    assert.deepStrictEqual(await res.body.text(), 'hello', 'response')
  }

  {
    const res = await request(`${app.url}/restart`, {
      method: 'POST'
    })
    assert.strictEqual(res.statusCode, 200, 'add status code')
  }

  {
    const res = await request(`${app.url}/`)
    assert.strictEqual(res.statusCode, 200, 'add status code')
    assert.deepStrictEqual(await res.body.text(), 'ciao mondo', 'response')
  }
})

test('config is adjusted to handle custom loggers', async (t) => {
  const options = {
    server: {
      hostname: '127.0.0.1',
      port: 0,
      logger: {
        info () {},
        error () {},
        debug () {},
        fatal () {},
        warn () {},
        trace () {}
      }
    }
  }

  let called = false
  Object.defineProperty(options.server.logger, 'child', {
    value: function child () {
      called = true
      return this
    },
    enumerable: false
  })

  await buildServer(options)
  assert.strictEqual(called, true)
})

test('config reloads', async (t) => {
  const file = join(os.tmpdir(), `${process.pid}-1.js`)

  await writeFile(file, `
    module.exports = async function (app, options) {
      app.get('/', () => options.message)
    }`)

  const app = await buildServer({
    server: {
      hostname: '127.0.0.1',
      port: 0
    },
    plugins: {
      paths: [{
        path: file,
        options: {
          message: 'hello'
        }
      }]
    },
    metrics: false
  })

  t.after(async () => {
    await app.close()
  })
  await app.start()

  {
    const res = await request(`${app.url}/`)
    assert.strictEqual(res.statusCode, 200, 'add status code')
    assert.deepStrictEqual(await res.body.text(), 'hello', 'response')
  }

  await app.platformatic.configManager.update({
    server: {
      hostname: '127.0.0.1',
      port: 0
    },
    plugins: {
      paths: [{
        path: file,
        options: {
          message: 'ciao mondo'
        }
      }]
    },
    metrics: false
  })

  await app.restart()

  {
    const res = await request(`${app.url}/`)
    assert.strictEqual(res.statusCode, 200, 'add status code')
    assert.deepStrictEqual(await res.body.text(), 'ciao mondo', 'response')
  }
})

test('do not watch typescript outDir', async (t) => {
  process.env.PLT_CLIENT_URL = 'http://localhost:3042'
  const targetDir = join(__dirname, '..', 'fixtures', 'hello-client-ts')

  try {
    await rm(join(targetDir, 'dist'), { recursive: true })
  } catch {}

  const app = await buildServer(join(targetDir, 'platformatic.service.json'))
  t.after(async () => {
    await app.close()
  })

  assert.deepStrictEqual(app.platformatic.configManager.current.watch, {
    enabled: false,
    ignore: ['dist/**/*']
  })
})

test('start without server config', async (t) => {
  const app = await buildServer({
    watch: false,
    metrics: false
  })
  t.after(async () => {
    await app.close()
  })

  const url = await app.start()
  const res = await request(url)
  assert.strictEqual(res.statusCode, 200, 'add status code')
  assert.deepStrictEqual(await res.body.json(), {
    message: 'Welcome to Platformatic! Please visit https://docs.platformatic.dev'
  })
})
