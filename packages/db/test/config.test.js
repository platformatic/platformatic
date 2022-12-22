'use strict'

const { buildConfig, connInfo } = require('./helper')
const { test } = require('tap')
const { buildServer } = require('..')
const { request } = require('undici')
const { tmpdir } = require('os')
const { writeFile, unlink } = require('fs/promises')
const { join, basename } = require('path')
const os = require('os')
const DBConfigManager = require('../lib/config')

test('return config with adminSecret', async ({ teardown, equal, same }) => {
  const server = await buildServer(buildConfig({
    server: {
      hostname: '127.0.0.1',
      port: 0
    },
    core: {
      ...connInfo
    },
    dashboard: true,
    authorization: {
      adminSecret: 'secret'
    }
  }))
  teardown(server.stop)
  await server.listen()
  const res = await (request(`${server.url}/_admin/config`))
  equal(res.statusCode, 200)
  same(await res.body.json(), {
    loginRequired: true
  })
})

test('return config without adminSecret', async ({ teardown, equal, same }) => {
  const server = await buildServer(buildConfig({
    server: {
      hostname: '127.0.0.1',
      port: 0
    },
    dashboard: true,
    core: {
      ...connInfo
    }
  }))
  teardown(server.stop)
  await server.listen()
  const res = await (request(`${server.url}/_admin/config`))
  equal(res.statusCode, 200)
  same(await res.body.json(), {
    loginRequired: false
  })
})

test('return config file', async ({ teardown, equal, same }) => {
  const server = await buildServer(buildConfig({
    server: {
      hostname: '127.0.0.1',
      port: 0
    },
    core: {
      ...connInfo
    },
    authorization: {
      adminSecret: 'secret'
    },
    dashboard: {
      rootPath: false
    }
  }))
  teardown(server.stop)
  await server.listen()
  const res = await (request(`${server.url}/_admin/config-file`, {
    headers: {
      'X-PLATFORMATIC-ADMIN-SECRET': 'secret'
    }
  }))
  equal(res.statusCode, 200)
  const body = await res.body.json()
  same(body, {
    server: {
      hostname: '127.0.0.1',
      port: 0
    },
    core: {
      ...connInfo
    },
    authorization: {
      adminSecret: 'secret',
      roleKey: 'X-PLATFORMATIC-ROLE',
      anonymousRole: 'anonymous'
    },
    dashboard: {
      rootPath: false
    }
  })
})

test('no need for configFileLocation to return config', async ({ teardown, equal, same }) => {
  const targetConfigFile = join(tmpdir(), 'platformatic.json')
  const theConfig = buildConfig({
    server: {
      hostname: '127.0.0.1',
      port: 0
    },
    dashboard: true,
    core: {
      ...connInfo
    },
    authorization: {
      adminSecret: 'secret'
    }
  })

  await writeFile(targetConfigFile, JSON.stringify(theConfig, null, 2))
  const server = await buildServer({
    ...theConfig
  })

  teardown(server.stop)
  teardown(() => unlink(targetConfigFile))
  await server.listen()
  const res = await (request(`${server.url}/_admin/config-file`, {
    headers: {
      'X-PLATFORMATIC-ADMIN-SECRET': 'secret'
    }
  }))
  equal(res.statusCode, 200)
  const body = await res.body.json()
  same(body, {
    server: {
      hostname: '127.0.0.1',
      port: 0
    },
    core: {
      ...connInfo
    },
    dashboard: true,
    authorization: {
      adminSecret: 'secret',
      roleKey: 'X-PLATFORMATIC-ROLE',
      anonymousRole: 'anonymous'
    }
  })
})

test('ignore watch sqlite file', async ({ teardown, equal, same, comment }) => {
  {
    // absolute path
    const config = join(__dirname, 'fixtures', 'sqlite', 'ignore-watch-sqlite.json')
    const cm = new DBConfigManager({
      source: config,
      schema: {}
    })
    const parseResult = await cm.parse()
    equal(parseResult, true)

    const configFileName = basename(cm.fullPath)
    same(cm.fileWatcher.allowToWatch, ['.env', configFileName])
  }

  {
    // Relative Path
    const config = join(__dirname, 'fixtures', 'sqlite', 'relative.json')
    const cm = new DBConfigManager({
      source: config,
      schema: {}
    })
    const parseResult = await cm.parse()
    equal(parseResult, true)

    const configFileName = basename(cm.fullPath)
    same(cm.fileWatcher.allowToWatch, ['.env', configFileName])
  }
})

test('config reloads from a written file', async ({ teardown, equal, pass, same }) => {
  const config = join(os.tmpdir(), `some-config-${process.pid}-2.json`)
  const file = join(os.tmpdir(), `some-plugin-${process.pid}-2.js`)

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
    dashboard: true,
    core: {
      ...connInfo
    },
    metrics: false
  }))

  await writeFile(file, `
    module.exports = async function (app, options) {
      app.get('/message', () => options.message)
    }`)

  const server = await buildServer(config)
  teardown(server.stop)
  await server.listen()

  {
    const res = await request(`${server.url}/message`)
    equal(res.statusCode, 200, 'add status code')
    same(await res.body.text(), 'hello', 'response')
  }

  await server.app.platformatic.configManager.update({
    server: {
      hostname: '127.0.0.1',
      port: 0
    },
    core: {
      ...connInfo
    },
    dashboard: true,
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
    const res = await request(`${server.url}/message`)
    equal(res.statusCode, 200, 'add status code')
    same(await res.body.text(), 'ciao mondo', 'response')
  }
})
