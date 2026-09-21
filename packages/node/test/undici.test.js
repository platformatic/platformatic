import assert from 'node:assert'
import { rm, symlink } from 'node:fs/promises'
import { createServer } from 'node:http'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { test } from 'node:test'
import { request } from 'undici'
import { createRuntime, setFixturesDir } from '../../basic/test/helper.js'

const require = createRequire(import.meta.url)
const undici8 = dirname(require.resolve('undici-8/package.json'))

setFixturesDir(resolve(import.meta.dirname, './fixtures'))

test('supports undici 8 in a node application when replacing the global dispatcher', async t => {
  const externalServer = createServer((req, res) => {
    res.setHeader('content-type', 'application/json')
    res.end(JSON.stringify({ receivedHeader: req.headers['x-user-dispatcher'] ?? null }))
  })
  t.after(() => externalServer.close())

  await new Promise(resolve => externalServer.listen(0, '127.0.0.1', resolve))
  const externalUrl = `http://127.0.0.1:${externalServer.address().port}`

  const { url } = await createRuntime(t, 'undici-8-global-dispatcher', false, false, 'platformatic.runtime.json', async (root, config) => {
    const undici = resolve(root, 'services/api/node_modules/undici')

    await rm(undici, { recursive: true, force: true })
    await symlink(undici8, undici, 'dir')

    config.env = { ...config.env, EXTERNAL_URL: externalUrl }
  })

  {
    const { statusCode, body } = await request(url, { path: '/fetch' })
    assert.strictEqual(statusCode, 200)
    assert.deepStrictEqual(await body.json(), { receivedHeader: null })
  }

  {
    const { statusCode, body } = await request(url, { path: '/request' })
    assert.strictEqual(statusCode, 200)
    assert.deepStrictEqual(await body.json(), { receivedHeader: null })
  }

  {
    const { statusCode, body } = await request(url, { path: '/external' })
    assert.strictEqual(statusCode, 200)
    assert.deepStrictEqual(await body.json(), { receivedHeader: 'yes' })
  }
})
