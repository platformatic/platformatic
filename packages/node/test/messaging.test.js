import { deepStrictEqual } from 'node:assert'
import { resolve } from 'node:path'
import { test } from 'node:test'
import { prepareRuntime, setFixturesDir, startRuntime } from '../../basic/test/helper.js'

setFixturesDir(resolve(import.meta.dirname, './fixtures'))

test('supports pure IPC services', async t => {
  const { runtime } = await prepareRuntime(t, 'messaging')
  const url = await startRuntime(t, runtime)

  const res = await fetch(`${url}/abcde`)

  deepStrictEqual(res.status, 200)
  deepStrictEqual(await res.json(), { url: 'edcba/' })
})
