import assert from 'node:assert'
import { registerHooks } from 'node:module'
import { test } from 'node:test'

// Record the URL of every module resolved from now on. This must run before
// @platformatic/foundation is imported, which is why the import below is dynamic.
const resolvedUrls = []
registerHooks({
  resolve (specifier, context, next) {
    const result = next(specifier, context)
    resolvedUrls.push(result.url)
    return result
  }
})

const LAZY_DEPENDENCIES = ['undici', 'yaml', '@iarna/toml', 'json5', 'pino-pretty', 'boring-name-generator']

function loaded (name) {
  const matcher = new RegExp(`/node_modules/${name}/`)
  return resolvedUrls.some(url => matcher.test(url))
}

const foundation = await import('../index.js')

test('importing @platformatic/foundation does not load the dependencies that are only needed on demand', () => {
  for (const name of LAZY_DEPENDENCIES) {
    assert.ok(!loaded(name), `${name} must not be loaded by importing @platformatic/foundation`)
  }
})

test('the format parsers are loaded on first use', () => {
  assert.deepStrictEqual(foundation.getParser('config.yaml')('a: 1'), { a: 1 })
  assert.ok(loaded('yaml'))
  assert.ok(!loaded('json5') && !loaded('@iarna/toml'))

  assert.deepStrictEqual(foundation.getParser('config.json5')('{ a: 1 }'), { a: 1 })
  assert.ok(loaded('json5'))

  assert.deepStrictEqual(foundation.getParser('config.toml')('a = 1'), { a: 1 })
  assert.ok(loaded('@iarna/toml'))

  // Extra arguments are still forwarded to the underlying parser
  assert.ok(foundation.getParser('config.yaml')('a: 1', undefined, { mapAsMap: true }) instanceof Map)
  assert.deepStrictEqual(foundation.getParser('config.json5')('{ a: 1 }', (key, value) => (key === 'a' ? 2 : value)), { a: 2 })

  assert.strictEqual(foundation.getStringifier('config.yaml')({ a: 1 }), 'a: 1\n')
  assert.strictEqual(foundation.getStringifier('config.json5')({ a: 1 }), '{\n  a: 1,\n}')
  assert.strictEqual(foundation.getStringifier('config.toml')({ a: 1 }), 'a = 1\n')
})

test('boring-name-generator is loaded on first use', () => {
  assert.match(foundation.generateDashedName(), /^[a-z]+(-[a-z]+)+$/)
  assert.ok(loaded('boring-name-generator'))
})

test('pino-pretty is loaded on first use', () => {
  const logger = foundation.createCliLogger('info')
  assert.strictEqual(logger.level, 'info')
  assert.ok(loaded('pino-pretty'))
})
