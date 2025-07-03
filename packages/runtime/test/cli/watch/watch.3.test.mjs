import { createDirectory, safeRemove } from '@platformatic/utils'
import desm from 'desm'
import { cp, mkdtemp, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { test } from 'node:test'
import { createEsmLoggingPlugin, start } from '../helper.mjs'

const fixturesDir = join(desm(import.meta.url), '..', '..', '..', 'fixtures')

const base = join(desm(import.meta.url), '..', '..', 'tmp')

try {
  await createDirectory(base)
} catch {}

test('watches ESM files', async t => {
  const tmpDir = await mkdtemp(join(base, 'watch-'))
  t.after(() => safeRemove(tmpDir))
  const configFileSrc = join(fixturesDir, 'configs', 'monorepo-watch.json')
  const configFileDst = join(tmpDir, 'configs', 'monorepo.json')
  const appSrc = join(fixturesDir, 'monorepo')
  const appDst = join(tmpDir, 'monorepo')
  const esmPluginFilePath = join(appDst, 'serviceAppWithMultiplePlugins', 'plugin2.mjs')

  await Promise.all([cp(configFileSrc, configFileDst), cp(appSrc, appDst, { recursive: true })])

  await writeFile(esmPluginFilePath, createEsmLoggingPlugin('v1', false))
  const { child } = await start('-c', configFileDst)
  t.after(() => child.kill('SIGKILL'))
  await writeFile(esmPluginFilePath, createEsmLoggingPlugin('v2', true))

  for await (const log of child.ndj) {
    if (log.msg === 'RELOADED v2') {
      break
    }
  }
})
