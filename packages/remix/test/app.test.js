import assert from 'node:assert'
import path from 'node:path'
import { test } from 'node:test'
import { request } from 'undici'
import { createRuntime } from '../../basic/test/helper.js'

export const cliPath = path.join(import.meta.dirname, '../../cli', 'cli.js')

const envs = {
  production: {
    build: true,
    production: true
  },
  dev: {
    build: false,
    production: false
  }
}

for (const [env, options] of Object.entries(envs)) {
  test(`remix application properly response with correct headers - ${env}`, async t => {
    const { url } = await createRuntime({
      t,
      root: path.resolve(import.meta.dirname, './fixtures/standalone'),
      build: options.build,
      production: options.production
    })

    {
      const res = await request(`${url}/`)
      const body = await res.body.text()

      assert.ok(res.headers['content-type'].startsWith('text/html'))
      assert.ok(res.headers['date'].length > 0)
      assert.strictEqual(res.headers['connection'], 'keep-alive')
      assert.strictEqual(res.headers['keep-alive'], 'timeout=5')
      assert.strictEqual(res.headers['transfer-encoding'], 'chunked')
      assert.strictEqual(res.headers['x-powered-by'], undefined)

      assert.ok(body.length > 0)
      assert.strictEqual(res.statusCode, 200)
    }
  })
}
