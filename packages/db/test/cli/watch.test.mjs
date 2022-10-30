import os from 'os'
import { join, basename } from 'path'
import { writeFile, mkdtemp } from 'fs/promises'
import { setTimeout as sleep } from 'timers/promises'
import t, { test } from 'tap'
import { request } from 'undici'
import { start } from './helper.mjs'

t.jobs = 5

function createLoggingPlugin (text) {
  return `\
    module.exports = async (app) => {
      app.get('/version', () => '${text}')
    }
  `
}

test('should watch js files by default', async ({ equal, teardown }) => {
  const tmpDir = await mkdtemp(join(os.tmpdir(), 'watch-'))
  const pluginFilePath = join(tmpDir, 'plugin.js')
  const configFilePath = join(tmpDir, 'platformatic.db.json')

  const defaultConfig = {
    server: {
      logger: {
        level: 'info'
      },
      hostname: '127.0.0.1',
      port: 0
    },
    core: {
      connectionString: 'sqlite://db.sqlite'
    },
    plugin: {
      path: pluginFilePath,
      watch: true
    }
  }

  await Promise.all([
    writeFile(configFilePath, JSON.stringify(defaultConfig)),
    writeFile(pluginFilePath, createLoggingPlugin('v1'))
  ])

  const { child, url } = await start('-c', configFilePath)
  teardown(() => child.kill('SIGINT'))

  await writeFile(pluginFilePath, createLoggingPlugin('v2'))

  await sleep(5000)

  const res = await request(`${url}/version`)
  const version = await res.body.text()
  equal(version, 'v2')
})

test('should watch allowed file', async ({ comment, teardown }) => {
  const tmpDir = await mkdtemp(join(os.tmpdir(), 'watch-'))
  const jsonFilePath = join(tmpDir, 'plugin-config.json')
  const pluginFilePath = join(tmpDir, 'plugin.js')
  const configFilePath = join(tmpDir, 'platformatic.db.json')

  const config = {
    server: {
      logger: {
        level: 'info'
      },
      hostname: '127.0.0.1',
      port: 0
    },
    core: {
      connectionString: 'sqlite://db.sqlite'
    },
    plugin: {
      path: pluginFilePath,
      watch: true,
      watchOptions: {
        allow: ['*.js', '*.json']
      }
    }
  }

  const pluginCode = `\
  const readFileSync = require('fs').readFileSync
  const json = readFileSync(${JSON.stringify(jsonFilePath)}, 'utf8')

  module.exports = async function (app) {
    if (json === 'RESTARTED') {
      app.log.info('RESTARTED')
    }
  }`

  await Promise.all([
    writeFile(configFilePath, JSON.stringify(config)),
    writeFile(jsonFilePath, 'INITIAL'),
    writeFile(pluginFilePath, pluginCode)
  ])

  const { child } = await start('-c', configFilePath)
  teardown(() => child.kill('SIGINT'))

  writeFile(jsonFilePath, 'RESTARTED')
  for await (const log of child.ndj) {
    if (log.msg === 'RESTARTED') break
  }
})

test('should not watch ignored file', async ({ teardown, equal }) => {
  const tmpDir = await mkdtemp(join(os.tmpdir(), 'watch-'))
  const pluginFilePath = join(tmpDir, 'plugin.js')
  const configFilePath = join(tmpDir, 'platformatic.db.json')

  const config = {
    server: {
      logger: {
        level: 'info'
      },
      hostname: '127.0.0.1',
      port: 0
    },
    core: {
      connectionString: 'sqlite://db.sqlite'
    },
    plugin: {
      path: pluginFilePath,
      watch: true,
      watchOptions: {
        ignore: [basename(pluginFilePath)]
      }
    }
  }

  await Promise.all([
    writeFile(configFilePath, JSON.stringify(config)),
    writeFile(pluginFilePath, createLoggingPlugin('v1'))
  ])

  const { child, url } = await start('-c', configFilePath)
  teardown(() => child.kill('SIGINT'))

  await writeFile(pluginFilePath, createLoggingPlugin('v2'))
  await sleep(5000)

  const res = await request(`${url}/version`)
  const version = await res.body.text()
  equal(version, 'v1')
})

test('should not loop forever when doing ESM', async ({ comment, fail }) => {
  const tmpDir = await mkdtemp(join(os.tmpdir(), 'watch-'))
  const pluginFilePath = join(tmpDir, 'plugin.mjs')
  const configFilePath = join(tmpDir, 'platformatic.db.json')

  const config = {
    server: {
      logger: {
        level: 'info'
      },
      hostname: '127.0.0.1',
      port: 0
    },
    core: {
      connectionString: 'sqlite://db.sqlite'
    },
    plugin: {
      path: pluginFilePath,
      watch: true,
      watchOptions: {
        ignore: [basename(pluginFilePath)]
      }
    }
  }

  await Promise.all([
    writeFile(configFilePath, JSON.stringify(config)),
    writeFile(pluginFilePath, 'export default async (app) => {}')
  ])

  const { child } = await start('-c', configFilePath)

  await sleep(1000)

  child.kill('SIGINT')

  let linesCounter = 0
  for await (const line of child.ndj) {
    // lines will have a series of "config changed"
    // messages without an ignore
    comment(line.msg)
    if (++linesCounter > 2) {
      fail()
      break
    }
  }
})
