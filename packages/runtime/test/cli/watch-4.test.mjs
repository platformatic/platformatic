import assert from 'node:assert'
import { cp, writeFile, mkdtemp, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { test } from 'node:test'
import { setTimeout as sleep } from 'node:timers/promises'
import desm from 'desm'
import { request } from 'undici'
import { start } from './helper.mjs'

import why from 'why-is-node-running'

setTimeout(() => {
  console.log('-----------------watch-4 - start')
  why()
  console.log('-----------------watch-4 - end')
}, 40000).unref()

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

// function saferm (path) {
//   return rm(path, { recursive: true, force: true }).catch(() => {})
// }

test('should not hot reload files with `--hot-reload false', async (t) => {
  const tmpDir = await mkdtemp(join(base, 'watch-'))
  // t.after(() => saferm(tmpDir))
  t.diagnostic(`using ${tmpDir}`)
  const configFileSrc = join(fixturesDir, 'configs', 'monorepo.json')
  const configFileDst = join(tmpDir, 'configs', 'monorepo.json')
  const appSrc = join(fixturesDir, 'monorepo')
  const appDst = join(tmpDir, 'monorepo')
  const cjsPluginFilePath = join(appDst, 'serviceApp', 'plugin.js')

  await Promise.all([
    cp(configFileSrc, configFileDst),
    cp(appSrc, appDst, { recursive: true })
  ])

  await writeFile(cjsPluginFilePath, createCjsLoggingPlugin('v1', false))
  const { child, url } = await start('-c', configFileDst, '--hot-reload', 'false')
  t.after(() => child.kill('SIGINT'))
  await writeFile(cjsPluginFilePath, createCjsLoggingPlugin('v2', true))
  await sleep(5000)
  const res = await request(`${url}/version`)
  const version = await res.body.text()
  assert.strictEqual(version, 'v1')
})

test('watches CommonJS files with hotreload', { timeout: 60000 }, async (t) => {
  const tmpDir = await mkdtemp(join(base, 'watch-'))
  // t.after(() => saferm(tmpDir))
  t.diagnostic(`using ${tmpDir}`)
  const configFileSrc = join(fixturesDir, 'configs', 'hotreload.json')
  const configFileDst = join(tmpDir, 'configs', 'monorepo.json')
  const appSrc = join(fixturesDir, 'monorepo')
  const appDst = join(tmpDir, 'monorepo')
  const cjsPluginFilePath = join(appDst, 'serviceAppWithLogger', 'plugin.js')

  await Promise.all([
    cp(configFileSrc, configFileDst),
    cp(appSrc, appDst, { recursive: true })
  ])

  await writeFile(cjsPluginFilePath, createCjsLoggingPlugin('v1', false))
  const { child } = await start('-c', configFileDst)
  t.after(() => child.kill('SIGINT'))

  await sleep(5000)
  await writeFile(cjsPluginFilePath, createCjsLoggingPlugin('v2', true))

  let restartedSecondTime = false
  let restartedThirdTime = false

  for await (const log of child.ndj) {
    if (log.msg === 'RELOADED v2') {
      restartedSecondTime = true
    } else if (log.msg === 'RELOADED v3') {
      restartedThirdTime = true
      break
    } else if (log.msg?.match(/watching/)) {
      await writeFile(cjsPluginFilePath, createCjsLoggingPlugin('v3', true))
      await sleep(5000)
    }
  }

  assert.ok(restartedSecondTime)
  assert.ok(restartedThirdTime)
})
