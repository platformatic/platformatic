import { deepStrictEqual, match, ok, strictEqual } from 'node:assert'
import { test } from 'node:test'
import { convert, toSource } from '../convert-fixtures.mjs'

function sourceOf (config, file) {
  return convert(config, { file }).source
}

test('the capability is taken from $schema, from module, or from the filename', () => {
  strictEqual(convert({ $schema: 'https://schemas.platformatic.dev/@platformatic/next/2.0.0.json' }).module, '@platformatic/next')
  strictEqual(convert({ module: '@platformatic/php' }).module, '@platformatic/php')

  // A good part of the corpus predates $schema entirely: platformatic.service.json says what it is
  // without saying it twice.
  strictEqual(convert({}, { file: '/x/platformatic.service.json' }).module, '@platformatic/service')
  strictEqual(convert({}, { file: '/x/platformatic.db.json' }).module, '@platformatic/db')

  // composer is the v3 spelling of gateway.
  strictEqual(convert({}, { file: '/x/platformatic.composer.json' }).module, '@platformatic/gateway')

  // wattpm is the runtime under another name.
  strictEqual(
    convert({ $schema: 'https://schemas.platformatic.dev/wattpm/2.0.0.json' }).module,
    '@platformatic/runtime'
  )
})

test('module leads, because it is the discriminator classification reads', () => {
  const source = sourceOf({ service: { openapi: true } }, '/x/platformatic.service.json')

  match(source, /export default \{\n {2}module: '@platformatic\/service',/)
})

test('services and web merge into applications, which is v4 spelling', () => {
  const { source } = convert({
    $schema: 'https://schemas.platformatic.dev/@platformatic/runtime/2.0.0.json',
    services: [{ id: 'a', path: './a' }],
    web: [{ id: 'b', path: './b' }],
    applications: [{ id: 'c', path: './c' }]
  })

  match(source, /applications: \[/)
  ok(!source.includes('services:'))
  ok(!source.includes('web:'))

  // Order follows the v3 merge: applications, then services, then web.
  const ids = [...source.matchAll(/id: '([abc])'/g)].map(m => m[1])
  deepStrictEqual(ids, ['c', 'a', 'b'])
})

test('a whole-string placeholder becomes the variable, and a numeric one is coerced', () => {
  // v4 turns AJV coercion off, so a string where the schema says number is a validation failure
  // rather than a silent conversion — the coercion has to be in the emitted source.
  const source = sourceOf({ server: { port: '{PORT}', hostname: '{{HOST}}' } }, '/x/platformatic.service.json')

  // `?? 0` because an unset variable is a state v3 tolerated, and NaN is one v4 refuses.
  match(source, /port: Number\(process\.env\.PORT \?\? 0\)/)
  match(source, /hostname: process\.env\.HOST/)
})

test('a literal numeric string is coerced too, because v4 refuses the string', () => {
  // v3 read `"port": "0"` through a validator with coerceTypes on; v4's is off, so the same value
  // has to be spelled as a number.
  const source = sourceOf({ server: { port: '0', hostname: '127.0.0.1' } }, '/x/platformatic.service.json')

  match(source, /port: 0\b/)
  match(source, /hostname: '127\.0\.0\.1'/)
})

test('an embedded placeholder becomes a template literal, keeping the surrounding text', () => {
  const source = sourceOf({ service: { path: 'prefix-{NAME}-suffix' } }, '/x/platformatic.service.json')

  match(source, /path: `prefix-\$\{process\.env\.NAME\}-suffix`/)
})

test('an entry config path is dropped and reported, because v4 discovers by directory', () => {
  const result = convert({
    $schema: 'https://schemas.platformatic.dev/@platformatic/runtime/2.0.0.json',
    services: [{ id: 'api', path: './web/api', config: 'platformatic.service.json' }]
  })

  ok(!result.source.includes('config:'))
  strictEqual(result.notes.length, 1)
  match(result.notes[0], /entry 'api' referenced platformatic\.service\.json/)
})

test('a root server block and an entrypoint are dropped, because the upgrade chain drops them', () => {
  // Not a judgement call about which application should own the port: the shipped upgrade to
  // 4.0.0 already deletes both on the way in, so neither reaches the runtime that reads them.
  // Moving a port nothing honours into an application would change behaviour, not preserve it.
  const result = convert({
    $schema: 'https://schemas.platformatic.dev/@platformatic/runtime/2.0.0.json',
    server: { port: 3042 },
    entrypoint: 'api'
  })

  strictEqual(result.refusals.length, 0)
  ok(!result.source.includes('server'))
  ok(!result.source.includes('entrypoint'))
  strictEqual(result.notes.length, 2)
})

test('a configuration whose capability cannot be determined is refused', () => {
  const result = convert({ logger: { level: 'info' } }, { file: '/x/platformatic.json' })

  match(result.refusals[0], /capability cannot be determined/)
})

test('the emitted source uses the repository style', () => {
  strictEqual(toSource({ a: 1, b: 'two' }), "{\n  a: 1,\n  b: 'two'\n}")
  strictEqual(toSource([]), '[]')
  strictEqual(toSource({}), '{}')

  // A key that is not an identifier still has to be quoted.
  strictEqual(toSource({ 'not-an-identifier': true }), '{\n  "not-an-identifier": true\n}')

  // And a string containing an apostrophe falls back rather than emitting broken source.
  strictEqual(toSource({ a: "it's" }), '{\n  a: "it\'s"\n}')
})
