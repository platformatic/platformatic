import { ok, rejects } from 'node:assert'
import { readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { swapVersion } from '../../basic/test/helper-version.js'
import { getLogsFromFile, prepareRuntime, setFixturesDir } from '../../basic/test/helper.js'

setFixturesDir(resolve(import.meta.dirname, './fixtures'))

async function swapVinextVersion (t, newVersion = '1.0.0') {
  const vinextEntrypoint = fileURLToPath(await import.meta.resolve('vinext'))
  const packageJsonPath = resolve(dirname(vinextEntrypoint), '../package.json')

  const originalContents = await readFile(packageJsonPath, 'utf-8')
  const newContents = JSON.parse(originalContents)

  newContents.version = newVersion
  await writeFile(packageJsonPath, JSON.stringify(newContents))
  t.after(() => writeFile(packageJsonPath, originalContents))
}

test('Vite version is checked in development', async t => {
  const { runtime, root } = await prepareRuntime(t, 'standalone', false, null, async root => {
    await swapVersion(t, root, 'vite', '../..')
  })

  await rejects(runtime.start())
  const logs = await getLogsFromFile(root)

  ok(logs.some(l => l.err?.message.includes('vite version 1.0.0 is not supported')))
})

test('Vite version is not checked in production', async t => {
  const { runtime, root } = await prepareRuntime(t, 'standalone', true, null, async root => {
    await swapVersion(t, root, 'vite', '../..')
  })

  await rejects(runtime.start())
  const logs = await getLogsFromFile(root)

  ok(!logs.some(l => l.err?.message.includes('vite version 1.0.0 is not supported')))
})

test('Vinext version is checked in development', async t => {
  const { runtime, root } = await prepareRuntime(t, 'standalone', false, null, async () => {
    await swapVinextVersion(t)
  })

  await rejects(runtime.start())
  const logs = await getLogsFromFile(root)

  ok(logs.some(l => l.err?.message.includes('vinext version 1.0.0 is not supported')))
})

test('Vinext version is not checked in production', async t => {
  const { runtime, root } = await prepareRuntime(t, 'standalone', true, null, async () => {
    await swapVinextVersion(t)
  })

  await rejects(runtime.start())
  const logs = await getLogsFromFile(root)

  ok(!logs.some(l => l.err?.message.includes('vinext version 1.0.0 is not supported')))
})
