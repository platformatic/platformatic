// The audit's value is entirely in its classification, so that is what this pins: a placeholder
// branch is recognised, a real union is not mistaken for one, and a property carrying a keyword
// migrate cannot intersect is flagged rather than passed over.

import assert from 'node:assert'
import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
import test from 'node:test'

const ROOT = resolve(import.meta.dirname, '..', '..')
const SCRIPT = resolve(ROOT, 'scripts', 'audit-schemas.mjs')

function run () {
  return JSON.parse(execFileSync(process.execPath, [SCRIPT, '--json'], { encoding: 'utf-8', maxBuffer: 64 * 1024 * 1024 }))
}

test('a bare string branch beside a typed one is placeholder-shaped', () => {
  const { unions } = run()

  /*
    v3's `{PLT_X}` placeholders were strings, so a typed property grew a string branch to let one
    through. `port` is the canonical case: integer | string, where the string never meant a port.
  */
  const port = unions.find(union => union.pointer === '/properties/server/properties/port')

  assert.ok(port, 'expected server.port to be a union site')
  assert.strictEqual(port.placeholderBranch, true)
})

test('a genuine union is not mistaken for a placeholder', () => {
  const { unions } = run()

  // boolean | object is a real union: the boolean is a shorthand, not a way to smuggle a string.
  const genuine = unions.filter(
    union => !union.placeholderBranch && union.branches.includes('boolean') && union.branches.includes('object')
  )

  assert.ok(genuine.length > 0, 'expected at least one boolean | object union to survive classification')

  for (const union of genuine) {
    assert.strictEqual(union.placeholderBranch, false)
  }
})

test('every table row carries its constraints, not just its type', () => {
  const { table } = run()

  const bounded = table.find(row => row.constraints.minimum !== undefined)
  const enumerated = table.find(row => row.constraints.enum !== undefined)

  /*
    migrate intersects constraints across every position a shared variable occupies, and a type
    alone cannot decide whether a value satisfying two positions exists.
  */
  assert.ok(bounded, 'expected at least one numeric bound in the table')
  assert.ok(enumerated, 'expected at least one enum in the table')
  assert.ok(Array.isArray(enumerated.constraints.enum))
})

test('a property outside the supported keyword subset is flagged', () => {
  const { table, unsupported } = run()

  assert.ok(unsupported.length > 0, 'expected the shipped schemas to carry keywords migrate cannot intersect')

  // The flag is what the pre-flight refusal reads, so it has to be on the row rather than only in
  // a separate list the migrator would have to join against.
  const flagged = table.filter(row => !row.supported)
  assert.ok(flagged.length > 0, 'expected the flag to reach the table rows')
})

test('a candidate whose string form is parsed somewhere carries that evidence', () => {
  const { unions } = run()

  /*
    `health.maxHeapTotal` is shape-identical to a placeholder union and its string branch is real —
    it accepts '1 GB'. The schema says nothing; the code that reads it does, through the
    `typeof x === 'string' ? parse…(x) : x` guard that is a real branch's signature. Surfacing that
    is what turns a blind classification into a reviewable one.
  */
  const heap = unions.find(union => union.pointer.endsWith('/health/properties/maxHeapTotal'))

  assert.ok(heap, 'expected maxHeapTotal to be a union site')
  assert.strictEqual(heap.placeholderBranch, true, 'it is placeholder-shaped, which is the whole problem')
  assert.ok(heap.stringFormEvidence.length > 0, 'expected the parser call sites to be reported')
  assert.ok(
    heap.stringFormEvidence.some(where => where.includes('runtime.js')),
    `expected a runtime call site, got ${heap.stringFormEvidence.join(', ')}`
  )
})

test('the string-form evidence matches whole identifiers, not substrings', () => {
  const { unions } = run()

  /*
    `port` occurs inside `export` and `reported`, and a substring test reported those two lines as
    evidence that a string port is parsed somewhere. This list is what protects the genuine
    counter-examples -- `maxHeapTotal`, whose string form really is parsed -- from a mechanical
    deletion of the string branch, so a false entry in it is worse than a missing one: it withdraws
    the protection from the properties that need it and grants it to one that does not.
  */
  const port = unions.find(union => union.pointer === '/properties/server/properties/port')

  assert.ok(port, 'expected server.port to be a union site')
  assert.deepStrictEqual(port.stringFormEvidence, [])

  for (const union of unions) {
    for (const line of union.stringFormEvidence ?? []) {
      assert.ok(!line.includes('foundation/lib/string.js'), `parseMemorySize is not evidence about ${union.pointer}`)
    }
  }
})
