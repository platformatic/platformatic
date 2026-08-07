import { ok, rejects } from 'node:assert'
import { rm } from 'node:fs/promises'
import { resolve } from 'node:path'
import { test } from 'node:test'
import {
  buildRuntime,
  getLogsFromFile,
  prepareRuntime,
  setAdditionalDependencies,
  setFixturesDir
} from '../../basic/test/helper.js'
import { loadConfiguration, NitroCapability, NitroViteCapability } from '../index.js'

setFixturesDir(resolve(import.meta.dirname, './fixtures'))
setAdditionalDependencies(['nitro', 'nitropack', 'vite'])

for (const fixture of ['standalone', 'standalone-nitro']) {
  test(`${fixture} reports a missing production output directory`, async t => {
    const { runtime, root } = await prepareRuntime(t, fixture, true)
    await rejects(runtime.start())
    const logs = await getLogsFromFile(root)
    ok(logs.some(log => log.err?.message.includes("Please run the 'build' command")))
  })

  test(`${fixture} reports a missing production entrypoint`, async t => {
    const { runtime, root } = await prepareRuntime(t, fixture, true)
    await buildRuntime(root)
    await rm(resolve(root, 'services/frontend/.output/server/index.mjs'))
    await rejects(runtime.start())
    const logs = await getLogsFromFile(root)
    ok(logs.some(log => log.err?.message.includes('Cannot access Nitro entrypoint')))
  })
}

test('rejects server.http2 in application configuration', async () => {
  await rejects(
    loadConfiguration(resolve(import.meta.dirname, '..'), { server: { http2: true } }),
    /server: must NOT have additional properties/
  )
})

for (const property of ['ssr', 'notFoundHandler']) {
  test(`rejects unsupported vite.${property} configuration`, async () => {
    await rejects(
      loadConfiguration(resolve(import.meta.dirname, '..'), { vite: { [property]: true } }),
      /vite: must NOT have additional properties/
    )
  })
}

for (const Capability of [NitroCapability, NitroViteCapability]) {
  test(`${Capability.name} rejects inherited runtime server.http2`, async () => {
    const root = resolve(import.meta.dirname, '..')
    const config = await loadConfiguration(root, {})
    const capability = new Capability(root, config, { isProduction: true, serverConfig: { http2: true } })

    await rejects(
      capability.init(),
      /Nitro does not support server.http2. Remove it from the application or runtime server configuration./
    )
  })
}

for (const [property, https] of [
  ['key', { key: 'inline key', cert: { path: 'certificate.pem' } }],
  ['cert', { key: { path: 'key.pem' }, cert: [{ path: 'certificate.pem' }] }]
]) {
  test(`standalone Nitropack rejects development HTTPS ${property} values that are not a single path`, async () => {
    const root = resolve(import.meta.dirname, 'fixtures/standalone-nitro/services/frontend')
    const config = await loadConfiguration(root, { server: { https } })
    const capability = new NitroCapability(root, config, { isProduction: false })

    await capability.init()
    await rejects(
      capability.start({ listen: true }),
      new RegExp(`server\\.https\\.${property}.*single \\{ path \\} value`)
    )
  })
}
