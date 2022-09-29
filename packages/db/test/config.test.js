'use strict'

const { buildConfig, connInfo } = require('./helper')
const { test } = require('tap')
const { buildServer } = require('..')
const { request } = require('undici')
const { tmpdir } = require('os')
const { readFile, writeFile, unlink } = require('fs/promises')
const { join } = require('path')
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
      enabled: true,
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
      enabled: true,
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
    },
    dashboard: {
      rootPath: false
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
    same(cm.watchIgnore, ['*.ts', 'db-watchIgnore.sqlite', 'db-watchIgnore.sqlite-journal', '.esm*'])
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
    same(cm.watchIgnore, ['*.ts', join('databases', 'db-watchIgnore.sqlite'), join('databases', 'db-watchIgnore.sqlite-journal'), '.esm*'])
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
})
