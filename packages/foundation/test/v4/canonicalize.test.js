import { deepStrictEqual, ok, strictEqual, throws } from 'node:assert'
import { test } from 'node:test'
import { canonicalize, formatPointer, isDeferredSlot, spliceDeferredSlot } from '../../lib/v4/index.js'

function invalidAt (pointer, fragment) {
  return error => {
    strictEqual(error.code, 'PLT_INVALID_CONFIG_VALUE')
    ok(error.message.includes(pointer), `${error.message} should name ${pointer}`)

    if (fragment) {
      ok(error.message.includes(fragment), `${error.message} should mention ${fragment}`)
    }

    return true
  }
}

test('the snapshot is built, not the original object', () => {
  const original = { logger: { level: 'info' }, applications: [{ id: 'api' }] }
  const { config } = canonicalize(original)

  deepStrictEqual(config, original)
  ok(config !== original)
  ok(config.logger !== original.logger)
  ok(config.applications[0] !== original.applications[0])
})

test('object properties whose value is undefined are omitted, not preserved', () => {
  // structuredClone is not JSON.stringify: it preserves own properties whose value is undefined,
  // so omitting them is something this pass does rather than something the boundary does for it.
  const { config } = canonicalize({ cache: { url: undefined, adapter: 'redis' } })

  deepStrictEqual(config, { cache: { adapter: 'redis' } })
  ok(!('url' in config.cache))
})

test('undefined inside an array is a hard error', () => {
  throws(() => canonicalize({ applications: [undefined] }), invalidAt('/applications/0'))
})

test('accessor properties are rejected wherever they appear', () => {
  // A property that computes on read cannot be transported, and permitting it would make the
  // snapshot unreproducible.
  const config = { logger: {} }
  Object.defineProperty(config.logger, 'level', { get: () => 'info', enumerable: true, configurable: true })

  throws(() => canonicalize(config), invalidAt('/logger/level', 'accessor'))
})

test('a getter cannot return one shape to the check and another to the clone', () => {
  // The time-of-check/time-of-use gap this pass exists to close: reads is incremented only if the
  // getter is ever invoked, and rejecting the descriptor means it never is.
  let reads = 0
  const config = {}
  Object.defineProperty(config, 'applications', {
    enumerable: true,
    configurable: true,
    get () {
      reads++
      return reads === 1 ? [{ id: 'a' }] : [{ id: 'b' }]
    }
  })

  throws(() => canonicalize(config), invalidAt('/applications', 'accessor'))
  strictEqual(reads, 0)
})

test('Proxies are rejected', () => {
  const proxied = new Proxy({ level: 'info' }, {})

  throws(() => canonicalize({ logger: proxied }), invalidAt('/logger', 'Proxies'))
})

test('non-finite numbers, bigints and symbols are hard errors', () => {
  throws(() => canonicalize({ port: NaN }), invalidAt('/port', 'finite'))
  throws(() => canonicalize({ port: Infinity }), invalidAt('/port', 'finite'))
  throws(() => canonicalize({ port: 1n }), invalidAt('/port', 'bigint'))
  throws(() => canonicalize({ tag: Symbol('x') }), invalidAt('/tag', 'symbol'))
})

test('circular references are hard errors, but a shared reference is not', () => {
  const circular = { name: 'root' }
  circular.self = circular

  throws(() => canonicalize(circular), invalidAt('/self', 'circular'))

  const shared = { level: 'info' }
  const { config } = canonicalize({ a: shared, b: shared })

  deepStrictEqual(config, { a: { level: 'info' }, b: { level: 'info' } })
})

test('non-plain instances are hard errors, named by what they are', () => {
  throws(() => canonicalize({ at: new Date(0) }), invalidAt('/at', 'Date instance'))
  throws(() => canonicalize({ seen: new Map() }), invalidAt('/seen', 'Map instance'))

  class Options {}
  throws(() => canonicalize({ options: new Options() }), invalidAt('/options', 'Options instance'))
})

test('null survives the walk, and arrays and nested nulls are ordinary values', () => {
  const { config } = canonicalize({ a: null, b: [null, 1, 'two', true] })

  deepStrictEqual(config, { a: null, b: [null, 1, 'two', true] })
})

test('a function is an error unless it sits in a deferred slot', () => {
  const callback = () => ({ module: '@platformatic/node' })

  throws(() => canonicalize({ logger: { transport: callback } }), invalidAt('/logger/transport', 'functions'))
  throws(() => canonicalize({ application: { config: callback } }), invalidAt('/application/config', 'functions'))

  const { config, deferred } = canonicalize({ application: { config: callback } }, { deferred: true })

  strictEqual(deferred.length, 1)
  strictEqual(deferred[0].pointer, '/application/config')
  strictEqual(deferred[0].value, callback)
  // The slot is left pending in the snapshot rather than filled with a placeholder.
  deepStrictEqual(config, { application: {} })
})

test('the deferred carve-out is a structural path test, and only those two paths', () => {
  ok(isDeferredSlot(['application', 'config']))
  ok(isDeferredSlot(['applications', 0, 'config']))
  ok(!isDeferredSlot(['applications', 'config']))
  ok(!isDeferredSlot(['application', 'config', 'nested']))
  ok(!isDeferredSlot(['config']))
  ok(!isDeferredSlot(['applications', 0, 'transform']))

  const callback = () => ({})
  const { deferred } = canonicalize(
    { applications: [{ id: 'a', config: callback }, { id: 'b', config: { module: '@platformatic/node' } }] },
    { deferred: true }
  )

  strictEqual(deferred.length, 1)
  strictEqual(deferred[0].pointer, '/applications/0/config')
})

test('a deferred result is canonicalized with no carve-out of its own', () => {
  // A deferred config may not itself return a function.
  throws(() => canonicalize({ application: { config: () => {} } }), invalidAt('/application/config'))
})

test('a resolved slot splices back into the position its function occupied', () => {
  const { config, deferred } = canonicalize(
    { applications: [{ id: 'a' }, { id: 'b', config: () => ({}) }] },
    { deferred: true }
  )

  spliceDeferredSlot(config, deferred[0].path, { module: '@platformatic/node' })

  deepStrictEqual(config, {
    applications: [{ id: 'a' }, { id: 'b', config: { module: '@platformatic/node' } }]
  })
})

test('pointers escape the JSON Pointer metacharacters', () => {
  strictEqual(formatPointer([]), '/')
  strictEqual(formatPointer(['applications', 0, 'config']), '/applications/0/config')
  strictEqual(formatPointer(['a/b', 'c~d']), '/a~1b/c~0d')
})

test('a top-level value that is not an object still canonicalizes, and classification refuses it', () => {
  // The walk is total over canonical data — arrays and null survive it legitimately — so the
  // plain-object test that ends the unwrap belongs to classification, not to this pass.
  deepStrictEqual(canonicalize(null).config, null)
  deepStrictEqual(canonicalize([1, 2]).config, [1, 2])
  deepStrictEqual(canonicalize('text').config, 'text')
})
