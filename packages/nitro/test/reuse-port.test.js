import { ok, strictEqual } from 'node:assert'
import { resolve } from 'node:path'
import { test } from 'node:test'
import { setAdditionalDependencies, setFixturesDir, verifyReusePort } from '../../basic/test/helper.js'

setFixturesDir(resolve(import.meta.dirname, './fixtures'))
setAdditionalDependencies(['nitro', 'nitropack', 'vite'])

for (const [fixture, content] of [
  ['standalone', '<title>Nitro Vite</title>'],
  ['standalone-nitro', 'Hello from Nitro']
]) {
  test(`${fixture} starts generated production servers with multiple workers when reusePort is supported`, async t => {
    await verifyReusePort(t, fixture, async response => {
      strictEqual(response.statusCode, 200)
      ok((await response.body.text()).includes(content))
    })
  })
}
