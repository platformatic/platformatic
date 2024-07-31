import assert from 'node:assert'
import { cp, writeFile, mkdtemp, mkdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { test } from 'node:test'
import { setTimeout as sleep } from 'node:timers/promises'
import desm from 'desm'
import { request } from 'undici'
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

test('should not hot reload files with `--hot-reload false', async (t) => {
  const tmpDir = await mkdtemp(join(base, 'watch-'))
  t.after(() => saferm(tmpDir))
  const configFileSrc = join(fixturesDir, 'configs', 'monorepo.json')
  const configFileDst = join(tmpDir, 'configs', 'monorepo.json')
  const appSrc = join(fixturesDir, 'monorepo')
  const appDst = join(tmpDir, 'monorepo')
  const cjsPluginFilePath = join(appDst, 'serviceApp', 'plugin.js')

  await Promise.all([
    cp(configFileSrc, configFileDst),
    cp(appSrc, appDst, { recursive: true }),
  ])

  await writeFile(cjsPluginFilePath, createCjsLoggingPlugin('v1', false))

  const { child, url } = await start('-c', configFileDst, '--hot-reload', 'false')
  t.after(() => child.kill('SIGKILL'))

  // Need this sleep to await for the CI linux machine to start watching
  await sleep(2000)

  await writeFile(cjsPluginFilePath, createCjsLoggingPlugin('v2', true))
  await sleep(5000)
  const res = await request(`${url}/version`)
  const version = await res.body.text()
  assert.strictEqual(version, 'v1')
})
