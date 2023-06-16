'use strict'

const { join } = require('path')
const { tmpdir } = require('os')
const { writeFile, mkdtemp, rm } = require('fs/promises')

const { test } = require('tap')
const { request } = require('undici')

const { buildServer } = require('..')
require('./helper')

test('should stop watching files after disabling watch option', async ({ teardown, equal, pass, same }) => {
  const tmpDir = await mkdtemp(join(tmpdir(), 'platformatic.service.test-'))
  const pathToPlugin = join(tmpDir, 'plugin.js')
  const pathToConfig = join(tmpDir, 'platformatic.service.json')

  teardown(async () => {
    await rm(tmpDir, { recursive: true, force: true })
  })

  await writeFile(pathToPlugin, `
    module.exports = async function plugin (app) {
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
      stopTimeout: 1000
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

  equal(app.fileWatcher.isWatching, true)

  await app.platformatic.configManager.update({ ...config, watch: false })
  await app.restart()

  await writeFile(pathToPlugin, `
    module.exports = async function plugin (app) {
      app.get('/test', {}, async function (request, response) {
        return { res: "plugin, version 2"}
      })
    }`)

  // wait to be sure that app is not watching files anymore
  await new Promise((resolve) => setTimeout(resolve, 5000))

  equal(app.fileWatcher, undefined)

  {
    const res = await request(`${app.url}/test`, {
      method: 'GET'
    })
    equal(res.statusCode, 200)
    // must be unchanged
    same(await res.body.json(), { res: 'plugin, version 1' }, 'get rest plugin')
  }
})

test('should stop watching typescript files after disabling watch option', async ({ teardown, equal, ok, same }) => {
  const tmpDir = await mkdtemp(join(tmpdir(), 'platformatic.service.test-'))
  const pathToPlugin = join(tmpDir, 'plugin.ts')
  const pathToConfig = join(tmpDir, 'platformatic.service.json')
  const pathToTsConfig = join(tmpDir, 'tsconfig.json')

  teardown(async () => {
    await rm(tmpDir, { recursive: true, force: true })
  })

  const tsConfig = {
    compilerOptions: {
      module: 'commonjs',
      esModuleInterop: true,
      target: 'es6',
      moduleResolution: 'node',
      sourceMap: true,
      pretty: true,
      noEmitOnError: true,
      outDir: 'dist'
    },
    watchOptions: {
      watchFile: 'fixedPollingInterval',
      watchDirectory: 'fixedPollingInterval',
      fallbackPolling: 'dynamicPriority',
      synchronousWatchDirectory: true,
      excludeDirectories: [
        '**/node_modules',
        'dist'
      ]
    }
  }

  await writeFile(pathToPlugin, `
    export default async function plugin (app) {
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
      typescript: true
    },
    watch: true,
    metrics: false
  }

  await writeFile(pathToConfig, JSON.stringify(config, null, 2))
  await writeFile(pathToTsConfig, JSON.stringify(tsConfig, null, 2))

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

  ok(app.tsCompilerWatcher)

  await app.platformatic.configManager.update({ ...config, watch: false })
  await app.restart()

  await writeFile(pathToPlugin, `
    export default async function plugin (app) {
      app.get('/test', {}, async function (request, response) {
        return { res: "plugin, version 2"}
      })
    }`)

  // wait to be sure that app is not watching files anymore
  await new Promise((resolve) => setTimeout(resolve, 10000))

  equal(app.tsCompilerWatcher, undefined)

  {
    const res = await request(`${app.url}/test`, {
      method: 'GET'
    })
    equal(res.statusCode, 200)
    // must be unchanged
    same(await res.body.json(), { res: 'plugin, version 1' }, 'get rest plugin')
  }
})
