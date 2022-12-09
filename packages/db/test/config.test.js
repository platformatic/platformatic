'use strict'

const { buildConfig, connInfo } = require('./helper')
const { test } = require('tap')
const { buildServer } = require('..')
const { request } = require('undici')
const { tmpdir } = require('os')
const { readFile, writeFile, unlink } = require('fs/promises')
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
    authorization: {
      adminSecret: 'secret',
      roleKey: 'X-PLATFORMATIC-ROLE',
      anonymousRole: 'anonymous'
    }
  })
})

test('update config file', async ({ teardown, equal, same }) => {
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
    }
  }))

  teardown(server.stop)
  await server.listen()

  const res = await (request(`${server.url}/_admin/config-file`, {
    headers: {
      'content-type': 'application/json',
      'X-PLATFORMATIC-ADMIN-SECRET': 'secret'
    },
    method: 'POST',
    body: JSON.stringify({
      foo: 'bar'
    })
  }))
  equal(res.statusCode, 200)
  const body = await res.body.json()
  same(body, {
    success: true
  })
})

test('not update config file if unauthorized', { skip: true }, async ({ teardown, equal, same }) => {
  const targetConfigFile = join(tmpdir(), 'platformatic.json')

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
    configFileLocation: targetConfigFile
  }))
  teardown(server.stop)
  await server.listen()
  const res = await (request(`${server.url}/_admin/config-file`, {
    headers: {
      'content-type': 'application/json'
    },
    method: 'POST',
    body: JSON.stringify({
      foo: 'bar'
    })
  }))
  equal(res.statusCode, 401)
  const body = await res.body.json()
  same(body, { success: false, message: 'Unauthorized' })
})

test('ignore watch sqlite file', async ({ teardown, equal, same, comment }) => {
  {
    // absolute path
    const config = {
      server: {
        hostname: '127.0.0.1',
        port: 0
      },
      core: {
        connectionString: 'sqlite://db-watchIgnore.sqlite'
      }
    }
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
    const config = {
      server: {
        hostname: '127.0.0.1',
        port: 0
      },
      core: {
        connectionString: 'sqlite://./databases/db-watchIgnore.sqlite'
      }
    }
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

test('should save config with relative paths', async ({ teardown, equal }) => {
  const configPath = join(__dirname, 'fixtures', 'config-to-replace.json')
  const configFile = await readFile(configPath, 'utf8')
  const config = JSON.parse(configFile)

  teardown(() => writeFile(configPath, configFile))

  const cm = new DBConfigManager({
    source: configPath,
    schema: {}
  })
  const parseResult = await cm.parse()
  equal(parseResult, true)

  await cm.save()

  const savedConfigFile = await readFile(configPath, 'utf8')
  const savedConfig = JSON.parse(savedConfigFile)

  equal(savedConfig.core.connectionString, config.core.connectionString)
  equal(savedConfig.plugin.path, config.plugin.path)
  equal(savedConfig.migrations.dir, config.migrations.dir)
  equal(savedConfig.migrations.table, 'versions')
})

test('should set migrations table to public.versions if there are postgresql schema', async ({ teardown, equal }) => {
  const configPath = join(__dirname, 'fixtures', 'postgresql-with-schema.json')
  const configFile = await readFile(configPath, 'utf8')

  teardown(() => writeFile(configPath, configFile))

  const cm = new DBConfigManager({
    source: configPath,
    schema: {}
  })
  const parseResult = await cm.parse()
  equal(parseResult, true)

  await cm.save()

  const savedConfigFile = await readFile(configPath, 'utf8')
  const savedConfig = JSON.parse(savedConfigFile)

  equal(savedConfig.migrations.table, 'public.versions')
})

test('should set migrations table to versions if there are no postgresql schema', async ({ teardown, equal }) => {
  const configPath = join(__dirname, 'fixtures', 'postgresql-without-schema.json')
  const configFile = await readFile(configPath, 'utf8')

  teardown(() => writeFile(configPath, configFile))

  const cm = new DBConfigManager({
    source: configPath,
    schema: {}
  })
  const parseResult = await cm.parse()
  equal(parseResult, true)

  await cm.save()

  const savedConfigFile = await readFile(configPath, 'utf8')
  const savedConfig = JSON.parse(savedConfigFile)

  equal(savedConfig.migrations.table, 'versions')
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
    core: {
      ...connInfo
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
    core: {
      ...connInfo
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
