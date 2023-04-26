import os from 'os'
import { join, basename } from 'path'
import { writeFile, mkdtemp } from 'fs/promises'
import t, { test } from 'tap'
import { request } from 'undici'
import { setTimeout as sleep } from 'timers/promises'
import { start } from './helper.mjs'

t.jobs = 5

function createLoggingPlugin (text, reloaded = false) {
  return `\
    module.exports = async (app) => {
      app.log.info({ reloaded: ${reloaded}, text: '${text}' }, 'debugme')
      if (${reloaded}) {
        app.log.info('RELOADED')
      }
      app.get('/version', () => '${text}')
    }
  `
}

test('should watch js files by default', async ({ equal, teardown, comment }) => {
  const tmpDir = await mkdtemp(join(os.tmpdir(), 'watch-'))
  comment(`using ${tmpDir}`)
  const pluginFilePath = join(tmpDir, 'plugin.js')
  const configFilePath = join(tmpDir, 'platformatic.service.json')

  const defaultConfig = {
    server: {
      logger: {
        level: 'info'
      },
      hostname: '127.0.0.1',
      port: 0
    },
    watch: true,
    plugins: {
      paths: [pluginFilePath]
    }
  }

  await Promise.all([
    writeFile(configFilePath, JSON.stringify(defaultConfig)),
    writeFile(pluginFilePath, createLoggingPlugin('v1'))
  ])

  const { child, url } = await start('-c', configFilePath)
  teardown(() => child.kill('SIGINT'))

  await writeFile(pluginFilePath, createLoggingPlugin('v2', true))

  for await (const log of child.ndj) {
    if (log.msg === 'RELOADED') break
  }

  const res = await request(`${url}/version`)
  const version = await res.body.text()
  equal(version, 'v2')
})

test('should watch allowed file', async ({ comment, teardown }) => {
  const tmpDir = await mkdtemp(join(os.tmpdir(), 'watch-'))
  const jsonFilePath = join(tmpDir, 'plugin-config.json')
  const pluginFilePath = join(tmpDir, 'plugin.js')
  const configFilePath = join(tmpDir, 'platformatic.service.json')

  const config = {
    server: {
      logger: {
        level: 'info'
      },
      hostname: '127.0.0.1',
      port: 0
    },
    watch: {
      allow: ['*.js', '*.json']
    },
    plugins: {
      paths: [pluginFilePath]
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
  const configFilePath = join(tmpDir, 'platformatic.service.json')

  const config = {
    server: {
      logger: {
        level: 'info'
      },
      hostname: '127.0.0.1',
      port: 0
    },
    watch: {
      ignore: [basename(pluginFilePath)]
    },
    plugins: {
      paths: [pluginFilePath]
    }
  }

  await Promise.all([
    writeFile(configFilePath, JSON.stringify(config)),
    writeFile(pluginFilePath, createLoggingPlugin('v1'))
  ])

  const { child, url } = await start('-c', configFilePath)
  teardown(() => child.kill('SIGINT'))

  await writeFile(pluginFilePath, createLoggingPlugin('v2', true))

  await sleep(5000)

  const res = await request(`${url}/version`)
  const version = await res.body.text()
  equal(version, 'v1')
})

test('should not loop forever when doing ESM', async ({ comment, fail }) => {
  const tmpDir = await mkdtemp(join(os.tmpdir(), 'watch-esm-'))
  const pluginFilePath = join(tmpDir, 'plugin.mjs')
  const configFilePath = join(tmpDir, 'platformatic.service.json')

  const config = {
    server: {
      logger: {
        level: 'info'
      },
      hostname: '127.0.0.1',
      port: 0
    },
    watch: {
      ignore: [basename(pluginFilePath)]
    },
    plugins: {
      paths: [pluginFilePath]
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

test('should watch config file', async ({ comment, teardown }) => {
  const tmpDir = await mkdtemp(join(os.tmpdir(), 'watch-config-'))
  const pluginFilePath = join(tmpDir, 'plugin.js')
  const configFilePath = join(tmpDir, 'platformatic.service.json')

  const config = {
    server: {
      logger: {
        level: 'info'
      },
      hostname: '127.0.0.1',
      port: 0
    },
    watch: {
      allow: ['*.js', '*.json']
    },
    plugins: {
      paths: [pluginFilePath]
    }
  }

  const config2 = {
    server: {
      logger: {
        level: 'info'
      },
      hostname: '127.0.0.1',
      port: 0
    },
    plugins: {
      paths: [{
        path: pluginFilePath,
        options: {
          log: true
        }
      }]
    }
  }

  const pluginCode = `\
  module.exports = async function (app, opts) {
    if (opts.log) {
      app.log.info('RESTARTED')
    }
  }`

  await Promise.all([
    writeFile(configFilePath, JSON.stringify(config)),
    writeFile(pluginFilePath, pluginCode)
  ])

  const { child } = await start('-c', configFilePath)
  teardown(() => child.kill('SIGINT'))

  // We do not await
  writeFile(configFilePath, JSON.stringify(config2))
  for await (const log of child.ndj) {
    if (log.msg === 'RESTARTED') break
  }
})

test('should not hot reload files with `--hot-reload false`', async ({ teardown, equal }) => {
  const tmpDir = await mkdtemp(join(os.tmpdir(), 'watch-'))
  const pluginFilePath = join(tmpDir, 'plugin.js')
  const configFilePath = join(tmpDir, 'platformatic.service.json')

  const config = {
    server: {
      logger: {
        level: 'info'
      },
      hostname: '127.0.0.1',
      port: 0
    },
    plugins: {
      paths: [pluginFilePath]
    }
  }

  await Promise.all([
    writeFile(configFilePath, JSON.stringify(config)),
    writeFile(pluginFilePath, createLoggingPlugin('v1'))
  ])

  const { child, url } = await start('-c', configFilePath, '--hot-reload', 'false')
  teardown(() => child.kill('SIGINT'))

  {
    const res = await request(`${url}/version`)
    const version = await res.body.text()
    equal(version, 'v1')
  }

  await writeFile(pluginFilePath, createLoggingPlugin('v2', true))

  await sleep(5000)

  {
    const res = await request(`${url}/version`)
    const version = await res.body.text()
    equal(version, 'v1')
  }
})
