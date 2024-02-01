import assert from 'node:assert'
import { cp, writeFile, mkdtemp, mkdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { test } from 'node:test'
import { setTimeout as sleep } from 'node:timers/promises'
import desm from 'desm'
import { start, createCjsLoggingPlugin } from '../helper.mjs'

const fixturesDir = join(desm(import.meta.url), '..', '..', '..', 'fixtures')

const base = join(desm(import.meta.url), '..', '..', 'tmp')

try {
  await mkdir(base, { recursive: true })
} catch {
}

function saferm (path) {
  return rm(path, { recursive: true, force: true }).catch(() => {})
}

test('watches CommonJS files with hotreload', async (t) => {
  const tmpDir = await mkdtemp(join(base, 'watch-'))
  t.after(() => saferm(tmpDir))
  console.log(`using ${tmpDir}`)
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
  t.after(() => child.kill('SIGKILL'))

  // Need this sleep to await for the CI linux machine to start watching
  await sleep(2000)
  await writeFile(cjsPluginFilePath, createCjsLoggingPlugin('v2', true))

  let restartedSecondTime = false
  let restartedThirdTime = false

  for await (const log of child.ndj) {
    if (log.msg === 'RELOADED v2') {
      restartedSecondTime = true
    } else if (log.msg === 'RELOADED v3') {
      restartedThirdTime = true
      break
    } else if (log.msg?.match(/restarted/)) {
      await writeFile(cjsPluginFilePath, createCjsLoggingPlugin('v3', true))

      // Need this sleep to await for the CI linux machine to start watching
      await sleep(2000)
    }
  }

  assert.ok(restartedSecondTime)
  assert.ok(restartedThirdTime)
})
