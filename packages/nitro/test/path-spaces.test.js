import { cp } from 'node:fs/promises'
import { resolve } from 'node:path'
import { test } from 'node:test'
import {
  createRuntime,
  createTemporaryDirectory,
  setAdditionalDependencies,
  verifyJSONViaHTTP
} from '../../basic/test/helper.js'

setAdditionalDependencies(['nitropack'])

for (const production of [false, true]) {
  test(`direct Nitro supports paths containing spaces in ${production ? 'production' : 'development'}`, async t => {
    const fixture = await createTemporaryDirectory(t, 'standalone nitro fixture')
    await cp(resolve(import.meta.dirname, './fixtures/standalone-nitro'), fixture, { recursive: true })

    const { url } = await createRuntime({
      t,
      root: fixture,
      build: production,
      production
    })

    await verifyJSONViaHTTP(url, '/api/hello', 200, { hello: 'nitropack' })
  })
}
