import assert from 'node:assert'
import { registerHooks } from 'node:module'
import { join } from 'node:path'
import { test } from 'node:test'

// Record the URL of every module resolved from now on. This must run before any
// Platformatic module is imported, which is why every import below is dynamic,
// and the file relies on the default per-file process isolation of node:test.
const resolvedUrls = []
registerHooks({
  resolve (specifier, context, next) {
    const result = next(specifier, context)
    resolvedUrls.push(result.url)
    return result
  }
})

const { create } = await import('../../index.js')
const { createFromConfig } = await import('../helper.js')

const GRAPHQL_MODULES = /\/node_modules\/(graphql|mercurius)\//

function graphqlModulesLoaded () {
  return resolvedUrls.some(url => GRAPHQL_MODULES.test(url))
}

test('mercurius and graphql are not loaded when graphql is disabled', async t => {
  assert.ok(!graphqlModulesLoaded(), 'mercurius or graphql were loaded by importing @platformatic/service')

  const capability = await create(join(import.meta.dirname, '..', 'fixtures', 'directories'))
  t.after(() => capability.stop())
  await capability.start({ listen: true })

  assert.strictEqual(await capability.getGraphqlSchema(), null)
  assert.ok(!graphqlModulesLoaded(), 'mercurius and graphql must not be loaded')
})

test('mercurius and graphql are loaded when graphql is enabled', async t => {
  const capability = await createFromConfig(t, {
    server: { hostname: '127.0.0.1', port: 0, logger: { level: 'fatal' } },
    service: { graphql: true },
    plugins: { paths: [join(import.meta.dirname, '..', 'fixtures', 'hello-world-resolver.js')] },
    watch: false
  })
  t.after(() => capability.stop())
  await capability.start({ listen: true })

  assert.strictEqual(await capability.getGraphqlSchema(), 'type Query {\n  hello: String\n}')
  assert.ok(resolvedUrls.some(url => /\/node_modules\/mercurius\//.test(url)), 'mercurius must be loaded')
  assert.ok(resolvedUrls.some(url => /\/node_modules\/graphql\//.test(url)), 'graphql must be loaded')
})
