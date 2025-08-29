import { createDirectory, safeRemove } from '@platformatic/foundation'
import assert from 'node:assert'
import { cp, mkdtemp, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { test } from 'node:test'
import { setTimeout as sleep } from 'node:timers/promises'
import { request } from 'undici'
import { createCjsLoggingPlugin, start } from '../helper.js'

const fixturesDir = join(import.meta.dirname, '..', '..', '..', 'fixtures')
const base = join(import.meta.dirname, '..', '..', 'tmp')

try {
  await createDirectory(base)
} catch {}

test('should not watch files if watch = false', async t => {
  const tmpDir = await mkdtemp(join(base, 'watch-'))
  t.after(() => safeRemove(tmpDir))
  const configFileSrc = join(fixturesDir, 'configs', 'monorepo-watch-single.json')
  const configFileDst = join(tmpDir, 'configs', 'monorepo-watch.json')
  const appSrc = join(fixturesDir, 'monorepo-watch')
  const appDst = join(tmpDir, 'monorepo-watch')
  const cjsPluginFilePath = join(appDst, 'service1', 'plugin.js')

  await Promise.all([cp(configFileSrc, configFileDst), cp(appSrc, appDst, { recursive: true })])

  await writeFile(cjsPluginFilePath, createCjsLoggingPlugin('v1', false))
  const { child, url } = await start(configFileDst, { env: { PLT_USE_PLAIN_CREATE: 'true' } })
  t.after(() => child.kill('SIGKILL'))

  // Need this sleep to await for the CI linux machine to start watching
  await sleep(2000)

  await writeFile(cjsPluginFilePath, createCjsLoggingPlugin('v2', true))
  await sleep(5000)
  const res = await request(`${url}/version`)
  const version = await res.body.text()
  assert.strictEqual(version, 'v1')
})
