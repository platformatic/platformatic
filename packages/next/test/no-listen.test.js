import { deepStrictEqual } from 'node:assert'
import path from 'node:path'
import { test } from 'node:test'
import { prepareRuntime } from '../../basic/test/helper.js'

for (const production of [false, true]) {
  const mode = production ? 'production' : 'development'

  test(`a managed Next.js application does not listen without server.port in ${mode}`, async t => {
    const { runtime } = await prepareRuntime({
      t,
      root: path.resolve(import.meta.dirname, './fixtures/standalone'),
      production
    })

    deepStrictEqual(await runtime.start(), {})
    deepStrictEqual(runtime.getUrls(), {})
  })
}
