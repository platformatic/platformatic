import { deepStrictEqual, strictEqual } from 'node:assert'
import path, { resolve } from 'node:path'
import { test } from 'node:test'
import { prepareRuntime, updateFile } from '../../basic/test/helper.js'

test('a managed Node factory does not listen without server.port', async t => {
  const { runtime } = await prepareRuntime({
    t,
    root: path.resolve(import.meta.dirname, './fixtures/node-no-configuration-standalone'),
    async additionalSetup (root) {
      await updateFile(resolve(root, 'services/frontend/index.mjs'), () => `
        import { createServer } from 'node:http'

        export function create () {
          return createServer((request, response) => {
            response.setHeader('content-type', 'application/json')
            response.end(JSON.stringify({ ok: true }))
          })
        }
      `)
    }
  })

  deepStrictEqual(await runtime.start(), {})

  const { statusCode, body } = await runtime.inject('frontend', '/')
  strictEqual(statusCode, 200)
  deepStrictEqual(JSON.parse(body), { ok: true })
})
