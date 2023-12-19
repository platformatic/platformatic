import assert from 'node:assert'
import { cp, writeFile, mkdtemp, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { test, beforeEach, afterEach } from 'node:test'
import { setTimeout as sleep } from 'node:timers/promises'
import desm from 'desm'
import { start } from './helper.mjs'

import why from 'why-is-node-running'
setTimeout(() => {
  console.log('-----------------watch-5 - start')
  why()
  console.log('-----------------watch-5 - end')
}, 40000).unref()

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

// function saferm (path) {
//   return rm(path, { recursive: true, force: true }).catch((error) => {
//     console.log(error)
//   })
// }

test('watches CommonJS files with hotreload on a single service', { timeout: 60000 }, async (t) => {
  console.log('watch-5 started')
  const tmpDir = await mkdtemp(join(base, 'watch-'))
  // t.after(() => saferm(tmpDir))
  t.diagnostic(`using ${tmpDir}`)
  const appSrc = join(fixturesDir, 'monorepo', 'serviceAppWithLogger')
  const appDst = join(tmpDir)
  const cjsPluginFilePath = join(appDst, 'plugin.js')

  await Promise.all([
    cp(appSrc, appDst, { recursive: true })
  ])

  await writeFile(cjsPluginFilePath, createCjsLoggingPlugin('v1', false))
  const { child } = await start('-c', join(appDst, 'platformatic.service.json'))
  t.after(() => {
    child.kill('SIGINT')
    // saferm(tmpDir)
  })

  await writeFile(cjsPluginFilePath, createCjsLoggingPlugin('v2', true))

  let restartedSecondTime = false
  let restartedThirdTime = false

  for await (const log of child.ndj) {
    console.log(log)
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
  console.log('watch-5 ended')
})
