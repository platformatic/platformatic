import { createDirectory, safeRemove } from '@platformatic/utils'
import desm from 'desm'
import { cp, mkdtemp, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { test } from 'node:test'
import { createCjsLoggingPlugin, start } from './helper.mjs'

const fixturesDir = join(desm(import.meta.url), '..', '..', 'fixtures')

const base = join(desm(import.meta.url), '..', 'tmp')

try {
  await createDirectory(base)
} catch {}

async function waitForMessageAndWatch (child, expected, watchMessage = 'start watching files') {
  let received = false

  for await (const log of child.ndj.iterator({ destroyOnReturn: false })) {
    if (log.msg === expected) {
      received = true

      if (!watchMessage) {
        break
      }
    }

    if (received && log.msg === watchMessage) {
      break
    }
  }

  return received
}

test('do not crash on syntax error', async t => {
  const tmpDir = await mkdtemp(join(base, 'do-no-crash-'))
  t.after(() => safeRemove(tmpDir))
  console.log(`using ${tmpDir}`)
  const configFileSrc = join(fixturesDir, 'configs', 'monorepo-watch.json')
  const configFileDst = join(tmpDir, 'configs', 'monorepo.json')
  const appSrc = join(fixturesDir, 'monorepo')
  const appDst = join(tmpDir, 'monorepo')
  const cjsPluginFilePath = join(appDst, 'serviceAppWithLogger', 'plugin.js')

  await Promise.all([cp(configFileSrc, configFileDst), cp(appSrc, appDst, { recursive: true })])

  await writeFile(cjsPluginFilePath, createCjsLoggingPlugin('v0', true))
  const { child } = await start('-c', configFileDst)

  await waitForMessageAndWatch(child, 'RELOADED v0')

  t.after(() => child.kill('SIGKILL'))

  await writeFile(cjsPluginFilePath, createCjsLoggingPlugin('v1', true))
  await waitForMessageAndWatch(child, 'RELOADED v1')

  // This has a syntax error, there is no trailing }
  await writeFile(cjsPluginFilePath, ` module.exports = async (app) => { app.get('/version', () => 'v2')`)
  await waitForMessageAndWatch(child, 'Unexpected end of input', null)

  await writeFile(cjsPluginFilePath, createCjsLoggingPlugin('v2', true))
  await waitForMessageAndWatch(child, 'RELOADED v2')

  child.ndj.destroy()
})
