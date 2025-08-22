import { createDirectory, safeRemove } from '@platformatic/foundation'
import assert from 'node:assert'
import { cp, mkdtemp, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { test } from 'node:test'
import { setTimeout as sleep } from 'node:timers/promises'
import { createCjsLoggingPlugin, start } from '../helper.js'

const fixturesDir = join(import.meta.dirname, '..', '..', '..', 'fixtures')
const base = join(import.meta.dirname, '..', '..', 'tmp')

try {
  await createDirectory(base)
} catch {}

test('watches CommonJS files with watch on a single application', async t => {
  const tmpDir = await mkdtemp(join(base, 'watch-'))
  t.after(() => safeRemove(tmpDir))
  const appSrc = join(fixturesDir, 'monorepo', 'serviceAppWithLogger')
  const appDst = join(tmpDir)
  const cjsPluginFilePath = join(appDst, 'plugin.js')

  await Promise.all([cp(appSrc, appDst, { recursive: true })])

  await writeFile(cjsPluginFilePath, createCjsLoggingPlugin('v1', false))

  const { child } = await start(join(appDst, 'platformatic.service.json'), { env: { PLT_USE_PLAIN_CREATE: 'true' } })

  // Need this sleep to await for the CI linux machine to start watching
  await sleep(2000)

  t.after(() => child.kill('SIGKILL'))

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
      if (restartedSecondTime) {
        await writeFile(cjsPluginFilePath, createCjsLoggingPlugin('v3', true))
      }
    }
  }

  assert.ok(restartedThirdTime)
})
