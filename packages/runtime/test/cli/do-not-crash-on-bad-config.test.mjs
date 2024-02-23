import { cp, writeFile, mkdtemp, mkdir, rm, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { test } from 'node:test'
import desm from 'desm'
import { start, createCjsLoggingPlugin } from './helper.mjs'

const fixturesDir = join(desm(import.meta.url), '..', '..', 'fixtures')

const base = join(desm(import.meta.url), '..', 'tmp')

try {
  await mkdir(base, { recursive: true })
} catch {
}

function saferm (path) {
  return rm(path, { recursive: true, force: true }).catch(() => {})
}

test('do not crash on bad config', async (t) => {
  const tmpDir = await mkdtemp(join(base, 'do-not-crash-'))
  t.after(() => saferm(tmpDir))
  console.log(`using ${tmpDir}`)
  const configFileSrc = join(fixturesDir, 'configs', 'monorepo.json')
  const configFileDst = join(tmpDir, 'configs', 'monorepo.json')
  const appSrc = join(fixturesDir, 'monorepo')
  const appDst = join(tmpDir, 'monorepo')
  const cjsPluginFilePath = join(appDst, 'serviceAppWithLogger', 'plugin.js')
  const serviceConfigFilePath = join(appDst, 'serviceAppWithLogger', 'platformatic.service.json')

  await Promise.all([
    cp(configFileSrc, configFileDst),
    cp(appSrc, appDst, { recursive: true })
  ])

  const original = await readFile(serviceConfigFilePath, 'utf8')

  const { child } = await start('-c', configFileDst)
  t.after(() => child.kill('SIGKILL'))

  await writeFile(serviceConfigFilePath, '{')
  await writeFile(cjsPluginFilePath, createCjsLoggingPlugin('v2', true))

  for await (const log of child.ndj.iterator({ destroyOnReturn: false })) {
    if (log.msg?.includes('Cannot parse config file') >= 0) {
      break
    }
  }

  await writeFile(serviceConfigFilePath, original)

  for await (const log of child.ndj) {
    if (log.msg === 'RELOADED v2') {
      break
    }
  }
})
