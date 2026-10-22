import { deepStrictEqual, throws } from 'node:assert'
import test from 'node:test'
import { applyConfigPatch } from '../index.js'

test('applyConfigPatch - applies the RFC 6902 operations in order', () => {
  const config = { server: { port: 3000, https: { key: 'key' } }, logger: { level: 'info' } }

  const patched = applyConfigPatch(config, [
    { op: 'add', path: '/server/trustProxy', value: true },
    { op: 'remove', path: '/server/https' },
    { op: 'replace', path: '/logger/level', value: 'warn' },
    { op: 'copy', from: '/logger', path: '/backupLogger' }
  ])

  deepStrictEqual(patched, {
    server: { port: 3000, trustProxy: true },
    logger: { level: 'warn' },
    backupLogger: { level: 'warn' }
  })
})

test('applyConfigPatch - merge keeps the existing keys', () => {
  const config = { cache: { cacheComponents: true, prefix: 'old' } }

  const patched = applyConfigPatch(config, [
    { op: 'merge', path: '/cache', value: { adapter: 'valkey', prefix: 'new' } }
  ])

  deepStrictEqual(patched, { cache: { cacheComponents: true, adapter: 'valkey', prefix: 'new' } })
})

test('applyConfigPatch - merge creates the missing objects', () => {
  deepStrictEqual(applyConfigPatch({}, [{ op: 'merge', path: '/cache', value: { adapter: 'valkey' } }]), {
    cache: { adapter: 'valkey' }
  })

  deepStrictEqual(applyConfigPatch({}, [{ op: 'merge', path: '/a/b', value: { c: 1 } }]), {
    a: { b: { c: 1 } }
  })
})

test('applyConfigPatch - merge follows the RFC 7396 rules', () => {
  const config = { cache: { remote: { url: 'old' }, tags: ['a', 'b'], ignored: true } }

  const patched = applyConfigPatch(config, [
    { op: 'merge', path: '/cache', value: { remote: { prefix: 'p' }, tags: ['c'], ignored: null } }
  ])

  deepStrictEqual(patched, { cache: { remote: { url: 'old', prefix: 'p' }, tags: ['c'] } })
})

test('applyConfigPatch - merge at the root merges into the whole configuration', () => {
  const patched = applyConfigPatch({ a: 1, b: { c: 2 } }, [{ op: 'merge', path: '', value: { b: { d: 3 } } }])

  deepStrictEqual(patched, { a: 1, b: { c: 2, d: 3 } })
})

test('applyConfigPatch - merge unescapes the path keys', () => {
  const patched = applyConfigPatch({}, [{ op: 'merge', path: '/a~1b/c~0d', value: { e: 1 } }])

  deepStrictEqual(patched, { 'a/b': { 'c~d': { e: 1 } } })
})

test('applyConfigPatch - mixes merge and RFC 6902 operations in order', () => {
  deepStrictEqual(
    applyConfigPatch({ cache: { prefix: 'old' } }, [
      { op: 'remove', path: '/cache' },
      { op: 'merge', path: '/cache', value: { url: 'valkey://' } }
    ]),
    { cache: { url: 'valkey://' } }
  )

  deepStrictEqual(
    applyConfigPatch({ cache: { prefix: 'old' } }, [
      { op: 'merge', path: '/cache', value: { url: 'valkey://' } },
      { op: 'remove', path: '/cache' }
    ]),
    {}
  )
})

test('applyConfigPatch - merge cannot modify prototypes', () => {
  throws(() => applyConfigPatch({}, [{ op: 'merge', path: '/__proto__', value: { polluted: true } }]), TypeError)
  throws(
    () => applyConfigPatch({}, [{ op: 'merge', path: '', value: JSON.parse('{"__proto__": {"polluted": true}}') }]),
    TypeError
  )
  throws(() => applyConfigPatch({}, [{ op: 'merge', path: '/constructor/prototype', value: { polluted: 1 } }]), TypeError)

  deepStrictEqual({}.polluted, undefined)
})

test('applyConfigPatch - RFC 6902 operations cannot modify prototypes', () => {
  throws(() => applyConfigPatch({}, [{ op: 'add', path: '/__proto__/polluted', value: true }]), TypeError)
  deepStrictEqual({}.polluted, undefined)
})
