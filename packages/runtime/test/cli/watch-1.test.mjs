import { cp, writeFile, mkdtemp, mkdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { test, beforeEach, afterEach } from 'node:test'
import { setTimeout as sleep } from 'node:timers/promises'
import desm from 'desm'
import { start } from './helper.mjs'

beforeEach(async (t) => {
  console.log('starting cli test')
  await sleep(3000)
})

afterEach(async (t) => {
  console.log('ending cli test')
  await sleep(3000)
})

const why = require('why-is-node-running')
setTimeout(() => {
  console.log('-----------------watch-1 - start')
  why()
  console.log('-----------------watch-1 - end')
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

function createEsmLoggingPlugin (text, reloaded) {
  return `\
    import fs from 'fs' // No node: scheme. Coverage for the loader.
    import dns from 'node:dns' // With node: scheme. Coverage for the loader.

    try {
      await import('./relative.mjs') // Relative path. Coverage for the loader.
    } catch {
      // Ignore err. File does not exist.
    }

    export default async function (app) {
      if (${reloaded}) {
        app.log.info('RELOADED ' + '${text}')
      }
      app.get('/version', () => '${text}')
    }
  `
}

function saferm (path) {
  return rm(path, { recursive: true, force: true }).catch(() => {})
}

test('watches CommonJS files', async (t) => {
  const tmpDir = await mkdtemp(join(base, 'watch-'))
  t.after(() => saferm(tmpDir))
  t.diagnostic(`using ${tmpDir}`)
  const configFileSrc = join(fixturesDir, 'configs', 'monorepo.json')
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
  t.after(() => child.kill('SIGINT'))

  await writeFile(cjsPluginFilePath, createCjsLoggingPlugin('v2', true))

  for await (const log of child.ndj) {
    if (log.msg === 'RELOADED v2') {
      break
    }
  }
})

test('watches ESM files', async (t) => {
  const tmpDir = await mkdtemp(join(base, 'watch-'))
  t.after(() => saferm(tmpDir))
  t.diagnostic(`using ${tmpDir}`)
  const configFileSrc = join(fixturesDir, 'configs', 'monorepo.json')
  const configFileDst = join(tmpDir, 'configs', 'monorepo.json')
  const appSrc = join(fixturesDir, 'monorepo')
  const appDst = join(tmpDir, 'monorepo')
  const esmPluginFilePath = join(appDst, 'serviceAppWithMultiplePlugins', 'plugin2.mjs')

  await Promise.all([
    cp(configFileSrc, configFileDst),
    cp(appSrc, appDst, { recursive: true })
  ])

  await writeFile(esmPluginFilePath, createEsmLoggingPlugin('v1', false))
  const { child } = await start('-c', configFileDst)
  t.after(() => child.kill('SIGINT'))
  await writeFile(esmPluginFilePath, createEsmLoggingPlugin('v2', true))

  for await (const log of child.ndj) {
    if (log.msg === 'RELOADED v2') {
      break
    }
  }
})
