import { deepStrictEqual, ok, rejects } from 'node:assert'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { major } from 'semver'
import { swapVersion } from '../../basic/test/helper-version.js'
import { getLogsFromFile, prepareRuntime, setFixturesDir, verifyHTMLViaHTTP } from '../../basic/test/helper.js'

setFixturesDir(resolve(import.meta.dirname, './fixtures'))

const htmlContents = ['<title>Vite App</title>', '<script type="module" src="/main.js"></script>']

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

// All the other tests of this package run against the Vite version installed as devDependency,
// so make sure that it is really Vite 8 and that it works out of the box in development.
test('Vite 8 is supported in development', async t => {
  const vitePackage = JSON.parse(await readFile(fileURLToPath(import.meta.resolve('vite/package.json')), 'utf-8'))
  deepStrictEqual(major(vitePackage.version), 8)

  const { runtime } = await prepareRuntime(t, 'standalone', false)
  const url = await runtime.start()

  await verifyHTMLViaHTTP(url, '/', htmlContents)
})

for (const version of ['5.0.0', '6.0.0', '7.0.0', '8.0.0', '8.99.99']) {
  test(`Vite version ${version} is accepted in development`, async t => {
    const { runtime, root } = await prepareRuntime(t, 'standalone', false, null, async root => {
      await swapVersion(t, root, 'vite', '../..', version)
    })

    const url = await runtime.start()
    await verifyHTMLViaHTTP(url, '/', htmlContents)

    const logs = await getLogsFromFile(root)
    ok(!logs.some(l => l.err?.message.includes('is not supported')))
  })
}

for (const version of ['4.5.0', '9.0.0']) {
  test(`Vite version ${version} is rejected in development`, async t => {
    const { runtime, root } = await prepareRuntime(t, 'standalone', false, null, async root => {
      await swapVersion(t, root, 'vite', '../..', version)
    })

    await rejects(runtime.start())
    const logs = await getLogsFromFile(root)

    ok(
      logs.some(
        l =>
          l.err?.message ===
          `vite version ${version} is not supported. Please use version ^5.0.0, ^6.0.0, ^7.0.0, or ^8.0.0.`
      )
    )
  })
}
