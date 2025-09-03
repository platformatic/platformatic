import { deepStrictEqual, ok } from 'node:assert'
import { resolve } from 'node:path'
import { test } from 'node:test'
import { isWindows, setFixturesDir, verifyReusePort } from '../../basic/test/helper.js'
import { copyServerEntrypoint } from './helper.js'

setFixturesDir(resolve(import.meta.dirname, './fixtures'))

test('applications are started with multiple workers even for the entrypoint when Node.js supports reusePort', async t => {
  await verifyReusePort(t, 'standalone', async res => {
    const text = await res.body.text()

    deepStrictEqual(res.statusCode, 200)
    ok(/<script type="module" crossorigin src="\/assets\/index-[a-z0-9-_]+.js"><\/script>/i.test(text))
  })
})

test(
  'applications are started with multiple workers even for the entrypoint when Node.js supports reusePort in SSR mode',
  {
    // Disabled on Windows due to https://github.com/fastify/fastify-vite/issues/162
    skip: isWindows
  },
  async t => {
    await verifyReusePort(
      t,
      'ssr-standalone',
      async res => {
        const text = await res.body.text()

        deepStrictEqual(res.statusCode, 200)
        ok(/<div id="app"><div>Hello from v\d+ t\d+<\/div><\/div>/i.test(text))
      },
      root => {
        return copyServerEntrypoint(root)
      }
    )
  }
)
