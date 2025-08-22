import { deepStrictEqual, ok } from 'node:assert'
import { resolve } from 'node:path'
import { test } from 'node:test'
import { setFixturesDir, verifyReusePort } from '../../basic/test/helper.js'

setFixturesDir(resolve(import.meta.dirname, './fixtures'))

test('applications are started with multiple workers even for the entrypoint when Node.js supports reusePort - direct', async t => {
  await verifyReusePort(t, 'node-no-configuration-standalone', async res => {
    const json = await res.body.json()

    deepStrictEqual(res.statusCode, 200)
    ok(json.production)
  })
})

test('applications are started with multiple workers even for the entrypoint when Node.js supports reusePort - custom commands', async t => {
  await verifyReusePort(t, 'node-no-build-standalone', async res => {
    const json = await res.body.json()

    deepStrictEqual(res.statusCode, 200)
    ok(json.production)
  })
})
