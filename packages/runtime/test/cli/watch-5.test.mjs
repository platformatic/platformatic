import assert from 'node:assert'
import { cp, writeFile, mkdtemp, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { test } from 'node:test'
import desm from 'desm'
import { start } from './helper.mjs'

import why from 'why-is-node-running'
setTimeout(() => {
  console.log('-----------------watch-5 - start')
  why()
  console.log('-----------------watch-5 - end')
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
//   return rm(path, { recursive: true, force: true }).catch((error) => {
//     console.log(error)
//   })
// }

test('watches CommonJS files with hotreload on a single service', { timeout: 60000 }, async (t) => {
  console.log('watch-5 started')
  const tmpDir = await mkdtemp(join(base, 'watch-'))
  console.log('watch-5 1.1')
  // t.after(() => saferm(tmpDir))
  t.diagnostic(`using ${tmpDir}`)
  console.log('watch-5 1.2')
  const appSrc = join(fixturesDir, 'monorepo', 'serviceAppWithLogger')
  const appDst = join(tmpDir)
  const cjsPluginFilePath = join(appDst, 'plugin.js')

  console.log('watch-5 1.3')
  await Promise.all([
    cp(appSrc, appDst, { recursive: true })
  ])
  console.log('watch-5 1.4')

  await writeFile(cjsPluginFilePath, createCjsLoggingPlugin('v1', false))
  console.log('watch-5 1.5')
  const { child } = await start('-c', join(appDst, 'platformatic.service.json'))


  // Need this sleep to await for the CI linux machine to start watching
  await sleep(2000)

  t.after(() => {
    console.log('watch-5 close 1')
    child.kill('SIGINT')
    console.log('watch-5 close 2')
    // saferm(tmpDir)
  })

  console.log('watch-5 1.6')
  await writeFile(cjsPluginFilePath, createCjsLoggingPlugin('v2', true))
  console.log('watch-5 1.7')

  let restartedSecondTime = false
  let restartedThirdTime = false

  for await (const log of child.ndj) {
    console.log('watch-5 message', log)
    if (log.msg === 'RELOADED v2') {
      restartedSecondTime = true
    } else if (log.msg === 'RELOADED v3') {
      assert.ok(restartedSecondTime)
      restartedThirdTime = true
      break
    } else if (log.msg?.match(/listening/)) {
      await writeFile(cjsPluginFilePath, createCjsLoggingPlugin('v3', true))

      // Need this sleep to await for the CI linux machine to start watching
      await sleep(2000)
    }
  }

  console.log('watch-5 1.9')

  assert.ok(restartedThirdTime)
  console.log('watch-5 ended')
})
