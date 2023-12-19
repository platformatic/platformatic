import assert from 'node:assert'
import { cp, writeFile, mkdtemp, mkdir, utimes } from 'node:fs/promises'
import { join } from 'node:path'
import { test } from 'node:test'
import desm from 'desm'
import { request } from 'undici'
import { start } from './helper.mjs'
import { on } from 'node:events'

import why from 'why-is-node-running'
setTimeout(() => {
  console.log('-----------------watch-2 - start')
  why()
  console.log('-----------------watch-2 - end')
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

test('watches CommonJS files with hotreload on a single service', { timeout: 60000 }, async (t) => {
  console.log('watch-2 1 started')
  const tmpDir = await mkdtemp(join(base, 'watch-'))
  console.log('watch-2 1.1')
  // t.after(() => saferm(tmpDir))
  t.diagnostic(`using ${tmpDir}`)
  console.log('watch-2 1.2')
  const appSrc = join(fixturesDir, 'monorepo', 'serviceAppWithLogger')
  console.log('watch-2 1.3')
  const appDst = join(tmpDir)
  const cjsPluginFilePath = join(appDst, 'plugin.js')

  console.log('watch-2 1.4')
  await Promise.all([
    cp(appSrc, appDst, { recursive: true })
  ])
  console.log('watch-2 1.5')

  await writeFile(cjsPluginFilePath, createCjsLoggingPlugin('v1', false))

  console.log('watch-2 1.6')
  const { child } = await start('-c', join(appDst, 'platformatic.service.json'))

  console.log('watch-2 1.7')
  t.after(() => child.kill('SIGINT'))

  console.log('watch-2 1.8')

  await writeFile(cjsPluginFilePath, createCjsLoggingPlugin('v2', true))

  console.log('watch-2 1.9')

  let restartedSecondTime = false
  let restartedThirdTime = false

  console.log('watch-2 1.10')
  for await (const log of child.ndj) {
    console.log(log.msg)
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

  console.log('watch-2 1.11')
  assert.ok(restartedThirdTime)
  console.log('watch-2.1 ended')
})

test('do not hot reload dependencies', { timeout: 60000 }, async (t) => {
  console.log('watch-2 2 started')
  process.env.PORT = 0
  const config = join(fixturesDir, 'do-not-reload-dependencies', 'platformatic.service.json')
  console.log('watch-2 2.1')
  const { child, url } = await start('-c', config)
  console.log('watch-2 2.2')
  t.after(() => child.kill('SIGINT'))
  t.after(() => delete process.env.PORT)

  console.log('watch-2 2.3')

  const res1 = await request(`${url}/plugin1`)
  console.log('watch-2 2.4')
  const plugin1 = (await res1.body.json()).hello
  console.log('watch-2 2.5')

  const res2 = await request(`${url}/plugin2`)
  console.log('watch-2 2.6')
  const plugin2 = (await res2.body.json()).hello
  console.log('watch-2 2.7')

  utimes(config, new Date(), new Date()).catch(() => {})
  console.log('watch-2 2.8')

  // wait for restart
  for await (const messages of on(child.ndj, 'data')) {
    console.log('watch-2 2.9')
    let url
    for (const message of messages) {
      if (message.msg) {
        console.log(message.msg)
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

  console.log('watch-2 2.10')

  const res3 = await request(`${url}/plugin1`)
  console.log('watch-2 2.11')
  assert.strictEqual((await res3.body.json()).hello, plugin1)
  console.log('watch-2 2.12')

  const res4 = await request(`${url}/plugin2`)
  console.log('watch-2 2.13')
  assert.strictEqual((await res4.body.json()).hello, plugin2)

  console.log('watch-2.2 ended')
})
