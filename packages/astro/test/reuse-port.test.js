import { deepStrictEqual, ok } from 'node:assert'
import { resolve } from 'node:path'
import { test } from 'node:test'
import { setFixturesDir, verifyReusePort } from '../../basic/test/helper.js'

setFixturesDir(resolve(import.meta.dirname, './fixtures'))

test('applications are started with multiple workers even for the entrypoint when Node.js supports reusePort', async t => {
  await verifyReusePort(t, 'standalone', async res => {
    const text = await res.body.text()

    deepStrictEqual(res.statusCode, 200)
    ok(/Hello from (v(<!-- -->)?\d+)(\s*(t(<!-- -->)?\d+))?/i.test(text))
  })
})

test('applications are started with multiple workers even for the entrypoint when Node.js supports reusePort in SSR mode', async t => {
  await verifyReusePort(t, 'ssr-standalone', async res => {
    const text = await res.body.text()

    deepStrictEqual(res.statusCode, 200)
    ok(/Hello from (v(<!-- -->)?\d+)(\s*(t(<!-- -->)?\d+))?/i.test(text))
  })
})
