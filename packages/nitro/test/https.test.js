import { ok, rejects } from 'node:assert'
import { resolve } from 'node:path'
import { test } from 'node:test'
import {
  buildRuntime,
  configureHTTPS,
  createHTTPSDispatcher,
  getLogsFromFile,
  prepareRuntime,
  setAdditionalDependencies,
  setFixturesDir,
  startRuntime,
  verifyHTMLViaHTTPS
} from '../../basic/test/helper.js'

setFixturesDir(resolve(import.meta.dirname, './fixtures'))
setAdditionalDependencies(['nitro', 'nitropack', 'vite'])

for (const fixture of ['standalone', 'standalone-nitro']) {
  for (const production of [false, true]) {
    test(`${fixture} supports HTTPS in ${production ? 'production' : 'development'}`, async t => {
      const { runtime, root } = await prepareRuntime(t, fixture, production, null, configureHTTPS)
      if (production) {
        await buildRuntime(root)
      }

      const url = await startRuntime(t, runtime)
      ok(url.startsWith('https://'))
      await verifyHTMLViaHTTPS(url, '/', fixture === 'standalone' ? ['Nitro Vite'] : ['Hello from Nitro'], createHTTPSDispatcher(t))
    })
  }
}

test('standalone Nitro 3 rejects HTTPS in development', async t => {
  const { runtime, root } = await prepareRuntime(t, 'standalone-nitro-v3', false, null, configureHTTPS)

  await rejects(runtime.start())
  const logs = await getLogsFromFile(root)
  ok(logs.some(log => log.err?.message.includes('HTTPS is not supported by the Nitro 3 CLI')))
})

test('standalone Nitro 3 supports HTTPS in production', async t => {
  const { runtime, root } = await prepareRuntime(t, 'standalone-nitro-v3', true, null, configureHTTPS)
  await buildRuntime(root)

  const url = await startRuntime(t, runtime)
  ok(url.startsWith('https://'))
  await verifyHTMLViaHTTPS(url, '/', ['Hello from Nitro 3'], createHTTPSDispatcher(t))
})
