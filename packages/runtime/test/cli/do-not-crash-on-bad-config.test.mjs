import { createDirectory, safeRemove } from '@platformatic/foundation'
import { cp, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { test } from 'node:test'
import { createCjsLoggingPlugin, start } from './helper.mjs'

const fixturesDir = join(import.meta.dirname, '..', '..', 'fixtures')

const base = join(import.meta.dirname, '..', 'tmp')

try {
  await createDirectory(base)
} catch {}

test('do not crash on bad config', async t => {
  const tmpDir = await mkdtemp(join(base, 'do-not-crash-'))
  t.after(() => safeRemove(tmpDir))
  const configFileSrc = join(fixturesDir, 'configs', 'monorepo.json')
  const configFileDst = join(tmpDir, 'configs', 'monorepo.json')
  const appSrc = join(fixturesDir, 'monorepo')
  const appDst = join(tmpDir, 'monorepo')
  const cjsPluginFilePath = join(appDst, 'serviceAppWithLogger', 'plugin.js')
  const applicationConfigFilePath = join(appDst, 'serviceAppWithLogger', 'platformatic.service.json')

  await Promise.all([cp(configFileSrc, configFileDst), cp(appSrc, appDst, { recursive: true })])

  const original = JSON.parse(await readFile(applicationConfigFilePath, 'utf8'))
  original.server.logger.level = 'trace'
  // Update the config file to enable watching
  const configFile = JSON.parse(await readFile(configFileDst, 'utf8'))
  configFile.watch = true
  await writeFile(configFileDst, JSON.stringify(configFile, null, 2))

  const { child } = await start(configFileDst, { env: { PLT_USE_PLAIN_CREATE: 'true' } })
  t.after(() => child.kill('SIGKILL'))

  await writeFile(applicationConfigFilePath, 'INVALID')
  await writeFile(cjsPluginFilePath, createCjsLoggingPlugin('v2', true))

  for await (const log of child.ndj.iterator({ destroyOnReturn: false })) {
    if (log.msg?.includes('Cannot parse config file') >= 0) {
      break
    }
  }

  await writeFile(applicationConfigFilePath, JSON.stringify(original))

  for await (const log of child.ndj) {
    if (log.msg === 'RELOADED v2') {
      break
    }
  }
})
