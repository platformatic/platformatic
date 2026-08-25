import assert from 'node:assert'
import { registerHooks } from 'node:module'
import { test } from 'node:test'

// Record the URL of every module resolved from now on. This must run before
// @platformatic/db is imported, which is why the import below is dynamic.
const resolvedUrls = []
registerHooks({
  resolve (specifier, context, next) {
    const result = next(specifier, context)
    resolvedUrls.push(result.url)
    return result
  }
})

test('importing @platformatic/db does not load graphql or mercurius', async () => {
  await import('../index.js')

  const loaded = resolvedUrls.filter(url => /\/node_modules\/(graphql|mercurius)\//.test(url))
  assert.deepStrictEqual(loaded, [])
})
