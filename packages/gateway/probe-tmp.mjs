import { createGatewayInRuntime } from './test/helper.js'
import { resolve } from 'node:path'
import { mkdir, symlink, rm } from 'node:fs/promises'

const nodeModulesRoot = resolve(import.meta.dirname, './test/proxy/fixtures/node/node_modules')
await rm(nodeModulesRoot, { recursive: true, force: true })
await mkdir(resolve(nodeModulesRoot, '@platformatic'), { recursive: true })
await symlink(resolve(import.meta.dirname, '../node'), resolve(nodeModulesRoot, '@platformatic/node'), 'dir')

const runtime = await createGatewayInRuntime(
  { after () {} }, 'probe', { gateway: { refreshTimeout: 1000 } },
  [
    { id: 'first', path: resolve(import.meta.dirname, './test/proxy/fixtures/service') },
    { id: 'third', path: resolve(import.meta.dirname, './test/proxy/fixtures/node') }
  ]
)
await runtime.start()
const config = await runtime.getRuntimeConfig(true)
console.log('runtime basePath:', JSON.stringify(config.basePath))
for (const id of ['first', 'third']) {
  const meta = await runtime.getApplicationMeta(id)
  console.log(id, 'meta:', JSON.stringify(meta.gateway ?? meta.composer))
}
await runtime.close()
