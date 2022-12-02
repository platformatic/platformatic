'use strict'

require('./helper')
const { test } = require('tap')
const { buildServer } = require('..')
const { request } = require('undici')
const { join } = require('path')
const os = require('os')
const { writeFile } = require('fs/promises')

test('config reloads', async ({ teardown, equal, pass, same }) => {
  const file = join(os.tmpdir(), `${process.pid}-1.js`)

  await writeFile(file, `
    module.exports = async function (app, options) {
      app.get('/', () => options.message)
    }`)

  const server = await buildServer({
    server: {
      hostname: '127.0.0.1',
      port: 0
    },
    plugin: {
      path: file,
      options: {
        message: 'hello'
      }
    },
    metrics: false
  })
  teardown(server.stop)
  await server.listen()

  {
    const res = await request(`${server.url}/`)
    equal(res.statusCode, 200, 'add status code')
    same(await res.body.text(), 'hello', 'response')
  }

  await server.app.platformatic.configManager.update({
    server: {
      hostname: '127.0.0.1',
      port: 0
    },
    plugin: {
      path: file,
      options: {
        message: 'ciao mondo'
      }
    },
    metrics: false
  })

  await server.restart()

  {
    const res = await request(`${server.url}/`)
    equal(res.statusCode, 200, 'add status code')
    same(await res.body.text(), 'ciao mondo', 'response')
  }
})

test('config reloads from a written file', async ({ teardown, equal, pass, same }) => {
  const config = join(os.tmpdir(), `${process.pid}-2.json`)
  const file = join(os.tmpdir(), `${process.pid}-2.js`)

  await writeFile(config, JSON.stringify({
    server: {
      hostname: '127.0.0.1',
      port: 0
    },
    plugin: {
      path: file,
      options: {
        message: 'hello'
      }
    },
    metrics: false
  }))

  await writeFile(file, `
    module.exports = async function (app, options) {
      app.get('/', () => options.message)
    }`)

  const server = await buildServer(config)
  teardown(server.stop)
  await server.listen()

  {
    const res = await request(`${server.url}/`)
    equal(res.statusCode, 200, 'add status code')
    same(await res.body.text(), 'hello', 'response')
  }

  await server.app.platformatic.configManager.update({
    server: {
      hostname: '127.0.0.1',
      port: 0
    },
    plugin: {
      path: file,
      options: {
        message: 'ciao mondo'
      }
    },
    metrics: false
  })

  await server.restart()

  {
    const res = await request(`${server.url}/`)
    equal(res.statusCode, 200, 'add status code')
    same(await res.body.text(), 'ciao mondo', 'response')
  }
})

test('config reloads from a written file from a route', async ({ teardown, equal, pass, same }) => {
  const config = join(os.tmpdir(), `${process.pid}-3.json`)
  const file = join(os.tmpdir(), `${process.pid}-3.js`)

  await writeFile(config, JSON.stringify({
    server: {
      hostname: '127.0.0.1',
      logger: { level: 'error' },
      port: 0
    },
    plugin: {
      path: file,
      options: {
        message: 'hello'
      }
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
          plugin: {
            path: '${file}',
            options: {
              message: 'ciao mondo'
            }
          },
          metrics: false
        })

        await app.restart()

        return true
      })
    }`)

  const server = await buildServer(config)
  teardown(server.stop)
  await server.listen()

  {
    const res = await request(`${server.url}/`)
    equal(res.statusCode, 200, 'add status code')
    same(await res.body.text(), 'hello', 'response')
  }

  {
    const res = await request(`${server.url}/restart`, {
      method: 'POST'
    })
    equal(res.statusCode, 200, 'add status code')
  }

  {
    const res = await request(`${server.url}/`)
    equal(res.statusCode, 200, 'add status code')
    same(await res.body.text(), 'ciao mondo', 'response')
  }
})
