import assert from 'node:assert'
import { cp, writeFile, mkdtemp, mkdir, rm, utimes } from 'node:fs/promises'
import { join } from 'node:path'
import { test, beforeEach, afterEach } from 'node:test'
import { setTimeout as sleep } from 'node:timers/promises'
import desm from 'desm'
import { request } from 'undici'
import { start } from './helper.mjs'
import { on } from 'node:events'

beforeEach(async (t) => {
  console.log('starting cli test')
  await sleep(3000)
})

afterEach(async (t) => {
  console.log('ending cli test')
  await sleep(3000)
})

const fixturesDir = join(desm(import.meta.url), '..', '..', 'fixtures')

const base = join(desm(import.meta.url), '..', 'tmp')

try {
  await mkdir(base, { recursive: true })
} catch {
}

function createCjsLoggingPlugin (text, reloaded) {
  return `\
    module.exports = async (app) => {
      if (${reloaded}) {
        app.log.info('RELOADED ' + '${text}')
      }
      app.get('/version', () => '${text}')
    }
  `
}

function saferm (path) {
  return rm(path, { recursive: true, force: true }).catch(() => {})
}

test('watches CommonJS files with hotreload on a single service', { timeout: 60000 }, async (t) => {
  const tmpDir = await mkdtemp(join(base, 'watch-'))
  t.after(() => saferm(tmpDir))
  t.diagnostic(`using ${tmpDir}`)
  const appSrc = join(fixturesDir, 'monorepo', 'serviceAppWithLogger')
  const appDst = join(tmpDir)
  const cjsPluginFilePath = join(appDst, 'plugin.js')

  await Promise.all([
    cp(appSrc, appDst, { recursive: true })
  ])

  await writeFile(cjsPluginFilePath, createCjsLoggingPlugin('v1', false))
  const { child } = await start('-c', join(appDst, 'platformatic.service.json'))
  t.after(() => child.kill('SIGINT'))

  await writeFile(cjsPluginFilePath, createCjsLoggingPlugin('v2', true))

  let restartedSecondTime = false
  let restartedThirdTime = false

  for await (const log of child.ndj) {
    if (log.msg === 'RELOADED v2') {
      restartedSecondTime = true
    } else if (log.msg === 'RELOADED v3') {
      assert.ok(restartedSecondTime)
      restartedThirdTime = true
      break
    } else if (log.msg?.match(/listening/)) {
      await writeFile(cjsPluginFilePath, createCjsLoggingPlugin('v3', true))
    }
  }

  assert.ok(restartedThirdTime)
})

test('do not hot reload dependencies', { timeout: 60000 }, async (t) => {
  process.env.PORT = 0
  const config = join(fixturesDir, 'do-not-reload-dependencies', 'platformatic.service.json')
  const { child, url } = await start('-c', config)
  t.after(() => child.kill('SIGINT'))
  t.after(() => delete process.env.PORT)

  const res1 = await request(`${url}/plugin1`)
  const plugin1 = (await res1.body.json()).hello

  const res2 = await request(`${url}/plugin2`)
  const plugin2 = (await res2.body.json()).hello

  utimes(config, new Date(), new Date()).catch(() => {})

  // wait for restart
  for await (const messages of on(child.ndj, 'data')) {
    let url
    for (const message of messages) {
      if (message.msg) {
        url = message.msg.match(/server listening at (.+)/i)?.[1]

        if (url !== undefined) {
          break
        }
      }
    }

    if (url !== undefined) {
      break
    }
  }

  const res3 = await request(`${url}/plugin1`)
  assert.strictEqual((await res3.body.json()).hello, plugin1)

  const res4 = await request(`${url}/plugin2`)
  assert.strictEqual((await res4.body.json()).hello, plugin2)
})

test('watches CommonJS files with hotreload on a single service', { timeout: 60000 }, async (t) => {
  const tmpDir = await mkdtemp(join(base, 'watch-'))
  t.after(() => saferm(tmpDir))
  t.diagnostic(`using ${tmpDir}`)
  const appSrc = join(fixturesDir, 'monorepo', 'serviceAppWithLogger')
  const appDst = join(tmpDir)
  const cjsPluginFilePath = join(appDst, 'plugin.js')

  await Promise.all([
    cp(appSrc, appDst, { recursive: true })
  ])

  await writeFile(cjsPluginFilePath, createCjsLoggingPlugin('v1', false))
  const { child } = await start('-c', join(appDst, 'platformatic.service.json'))
  t.after(() => child.kill('SIGINT'))

  await writeFile(cjsPluginFilePath, createCjsLoggingPlugin('v2', true))

  let restartedSecondTime = false
  let restartedThirdTime = false

  for await (const log of child.ndj) {
    if (log.msg === 'RELOADED v2') {
      restartedSecondTime = true
    } else if (log.msg === 'RELOADED v3') {
      assert.ok(restartedSecondTime)
      restartedThirdTime = true
      break
    } else if (log.msg?.match(/listening/)) {
      await writeFile(cjsPluginFilePath, createCjsLoggingPlugin('v3', true))
    }
  }

  assert.ok(restartedThirdTime)
})

test('should not watch files if watch = false', async (t) => {
  const tmpDir = await mkdtemp(join(base, 'watch-'))
  t.after(() => saferm(tmpDir))
  t.diagnostic(`using ${tmpDir}`)
  const configFileSrc = join(fixturesDir, 'configs', 'monorepo-watch.json')
  const configFileDst = join(tmpDir, 'configs', 'monorepo-watch.json')
  const appSrc = join(fixturesDir, 'monorepo-watch')
  const appDst = join(tmpDir, 'monorepo-watch')
  const cjsPluginFilePath = join(appDst, 'service1', 'plugin.js')

  await Promise.all([
    cp(configFileSrc, configFileDst),
    cp(appSrc, appDst, { recursive: true })
  ])

  await writeFile(cjsPluginFilePath, createCjsLoggingPlugin('v1', false))
  const { child, url } = await start('-c', configFileDst)
  t.after(() => child.kill('SIGINT'))
  await writeFile(cjsPluginFilePath, createCjsLoggingPlugin('v2', true))
  await sleep(5000)
  const res = await request(`${url}/version`)
  const version = await res.body.text()
  assert.strictEqual(version, 'v1')
})
