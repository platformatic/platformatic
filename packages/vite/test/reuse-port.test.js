import { deepStrictEqual, ok } from 'node:assert'
import { resolve } from 'node:path'
import { test } from 'node:test'
import { setFixturesDir, verifyReusePort } from '../../basic/test/helper.js'

process.setMaxListeners(100)
setFixturesDir(resolve(import.meta.dirname, './fixtures'))

test('services are started with multiple workers even for the entrypoint when Node.js supports reusePort', async t => {
  await verifyReusePort(t, 'standalone', async res => {
    const text = await res.body.text()

    deepStrictEqual(res.statusCode, 200)
    ok(/<script type="module" crossorigin src="\/assets\/index-[a-z0-9-_]+.js"><\/script>/i.test(text))
  })
})

test('services are started with multiple workers even for the entrypoint when Node.js supports reusePort in SSR mode', async t => {
  await verifyReusePort(t, 'ssr-standalone', async res => {
    const text = await res.body.text()

    deepStrictEqual(res.statusCode, 200)
    ok(/<div id="app"><div>Hello from v\d+ t\d+<\/div><\/div>/i.test(text))
  })
})
