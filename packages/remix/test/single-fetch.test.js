import { ok, strictEqual } from 'node:assert'
import { resolve } from 'node:path'
import { test } from 'node:test'
import { request } from 'undici'
import { createRuntime, setAdditionalDependencies, setFixturesDir } from '../../basic/test/helper.js'
import { additionalDependencies } from './helper.js'

process.setMaxListeners(100)
setFixturesDir(resolve(import.meta.dirname, './fixtures'))
setAdditionalDependencies(additionalDependencies)

// Single fetch serializes loader data with turbo-stream, so this exercises its encoder and the decoder used
// by @remix-run/react during hydration.
for (const [env, production] of [['production', true], ['dev', false]]) {
  test(`Remix single fetch serializes loader data - ${env}`, async t => {
    const { url } = await createRuntime({
      t,
      root: resolve(import.meta.dirname, './fixtures/single-fetch'),
      build: production,
      production
    })

    {
      const res = await request(`${url}/`)
      const body = await res.body.text()

      strictEqual(res.statusCode, 200)
      ok(body.includes('hello-from-loader'))
      ok(body.includes('deferred-value'), 'the streamed promise is flushed into the HTML')
    }

    {
      const res = await request(`${url}/other.data`)
      const body = await res.body.text()

      strictEqual(res.statusCode, 200)
      ok(res.headers['content-type'].startsWith('text/x-script'))
      ok(body.includes('hello-from-other'))
    }

    {
      // Route-selective data request, as issued on client side navigation
      const res = await request(`${url}/.data`, { query: { _routes: 'routes/_index' } })
      const body = await res.body.text()

      strictEqual(res.statusCode, 200)
      ok(res.headers['content-type'].startsWith('text/x-script'))
      ok(body.includes('hello-from-loader'))
      ok(body.includes('deferred-value'))
    }
  })
}
