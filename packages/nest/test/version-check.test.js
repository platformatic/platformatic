import { safeRemove } from '@platformatic/utils'
import { ok, rejects } from 'node:assert'
import { readFile, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { test } from 'node:test'
import { prepareRuntime, setFixturesDir } from '../../basic/test/helper.js'
import { buildServer } from '../../runtime/index.js'

setFixturesDir(resolve(import.meta.dirname, './fixtures'))

async function swapVersion (t) {
  const require = createRequire(import.meta.url)
  const nestCoreRoot = dirname(require.resolve('@nestjs/core'))
  const nestCorePackageJson = resolve(nestCoreRoot, './package.json')

  const originalContents = await readFile(nestCorePackageJson, 'utf-8')
  const newContents = JSON.parse(originalContents)

  newContents.version = '1.0.0'
  await writeFile(nestCorePackageJson, JSON.stringify(newContents))
  t.after(() => writeFile(nestCorePackageJson, originalContents))
}

async function setLogFile (t, root) {
  const originalEnv = process.env.PLT_RUNTIME_LOGGER_STDOUT
  process.env.PLT_RUNTIME_LOGGER_STDOUT = resolve(root, 'log.txt')

  t.after(() => {
    process.env.PLT_RUNTIME_LOGGER_STDOUT = originalEnv
  })
}

async function getLogs (root) {
  return (await readFile(resolve(root, 'log.txt'), 'utf-8')).split('\n').filter(Boolean).map(JSON.parse)
}

test('NestJS version is checked in development', async t => {
  const { root, config } = await prepareRuntime(t, 'express-standalone', false, null, async root => {
    await swapVersion(t)
    await setLogFile(t, root)
  })

  process.chdir(root)
  const runtime = await buildServer(config.configManager.current, config.args)

  t.after(async () => {
    await runtime.close()
    await safeRemove(root)
  })

  await rejects(runtime.start())
  const logs = await getLogs(root)

  ok(logs.some(l => l.msg.includes('@nestjs/core version 1.0.0 is not supported')))
})

test('NestJS version is not checked in production', async t => {
  const { root, config } = await prepareRuntime(t, 'express-standalone', true, null, async root => {
    await swapVersion(t)
    await setLogFile(t, root)
  })

  process.chdir(root)
  const runtime = await buildServer(config.configManager.current, config.args)

  t.after(async () => {
    await runtime.close()
    await safeRemove(root)
  })

  await rejects(runtime.start())
  const logs = await getLogs(root)

  ok(!logs.some(l => l.msg.includes('@nestjs/core version 1.0.0 is not supported')))
})
