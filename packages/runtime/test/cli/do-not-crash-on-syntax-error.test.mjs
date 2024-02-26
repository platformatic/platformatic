import { cp, writeFile, mkdtemp, mkdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { test } from 'node:test'
import desm from 'desm'
import { start, createCjsLoggingPlugin } from './helper.mjs'
import { tspl } from '@matteo.collina/tspl'

const fixturesDir = join(desm(import.meta.url), '..', '..', 'fixtures')

const base = join(desm(import.meta.url), '..', 'tmp')

try {
  await mkdir(base, { recursive: true })
} catch {
}

function saferm (path) {
  return rm(path, { recursive: true, force: true }).catch(() => {})
}

test('do not crash on syntax error', async (t) => {
  const plan = tspl(t, { plan: 3 })
  const tmpDir = await mkdtemp(join(base, 'do-no-crash-'))
  t.after(() => saferm(tmpDir))
  console.log(`using ${tmpDir}`)
  const configFileSrc = join(fixturesDir, 'configs', 'monorepo-hotreload.json')
  const configFileDst = join(tmpDir, 'configs', 'monorepo.json')
  const appSrc = join(fixturesDir, 'monorepo')
  const appDst = join(tmpDir, 'monorepo')
  const cjsPluginFilePath = join(appDst, 'serviceAppWithLogger', 'plugin.js')

  await Promise.all([
    cp(configFileSrc, configFileDst),
    cp(appSrc, appDst, { recursive: true })
  ])

  await writeFile(cjsPluginFilePath, createCjsLoggingPlugin('v1', true))
  const { child } = await start('-c', configFileDst)
  t.after(() => child.kill('SIGKILL'))

  for await (const log of child.ndj.iterator({ destroyOnReturn: false })) {
    if (log.msg === 'RELOADED v1') {
      plan.ok('reloaded')
    }

    if (log.msg === 'start watching files') {
      break
    }
  }

  await writeFile(cjsPluginFilePath, `\
module.exports = async (app) => {
  app.get('/version', () => 'v2')
  `) // This has a syntax error

  for await (const log of child.ndj.iterator({ destroyOnReturn: false })) {
    if (log.msg === 'Unexpected end of input') {
      plan.ok('syntax error')
      break
    }
  }

  await writeFile(cjsPluginFilePath, createCjsLoggingPlugin('v2', true))

  for await (const log of child.ndj) {
    if (log.msg === 'RELOADED v2') {
      plan.ok('reloaded')
      break
    }
  }

  await plan.completed
})
