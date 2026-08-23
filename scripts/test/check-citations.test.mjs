// Proves the citation gate actually gates. Every case here is a way it once failed
// open: a citation added but never blessed, a lockfile deleted or emptied, and a
// historical SHA that cannot be read. Each printed a warning and exited 0.

import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import assert from 'node:assert'
import test from 'node:test'

const ROOT = resolve(import.meta.dirname, '..', '..')
const SCRIPT = join(ROOT, 'scripts', 'check-citations.mjs')

// A real file so resolution succeeds; what is under test is blessing, not lookup.
const DOC = 'Cited here: `runtime/lib/utils.js:12-14`.\n'
const HISTORICAL = 'Cited here: `runtime/lib/config.js:130` pre-`deadbeef1234`.\n'

function scratch (t, doc) {
  const dir = mkdtempSync(join(tmpdir(), 'citations-'))
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  const paths = { doc: join(dir, 'DOC.md'), lock: join(dir, 'lock.json') }
  writeFileSync(paths.doc, doc)
  return paths
}

function run (args, lock) {
  try {
    const stdout = execFileSync('node', [SCRIPT, ...args], {
      cwd: ROOT,
      env: { ...process.env, CITATIONS_LOCK: lock },
      encoding: 'utf8'
    })
    return { code: 0, stdout }
  } catch (error) {
    return { code: error.status, stdout: error.stdout ?? '' }
  }
}

test('a new citation fails verification until it is blessed', t => {
  const { doc, lock } = scratch(t, DOC)
  writeFileSync(lock, JSON.stringify({
    citations: { 'packages/runtime/lib/runtime.js:1': { sha: 'x', head: 'y', lines: 1 } }
  }))

  const before = run([doc], lock)
  assert.equal(before.code, 1, 'unblessed citation must fail verification')
  assert.match(before.stdout, /not in the lockfile/)

  assert.equal(run([doc, '--update'], lock).code, 0)

  const after = run([doc], lock)
  assert.equal(after.code, 0, 'blessed citation must pass')
  assert.match(after.stdout, /OK/)
})

test('a missing lockfile fails rather than bootstrapping', t => {
  const { doc, lock } = scratch(t, DOC)
  // Deliberately not written: deleting the lockfile must not disable the gate.
  const result = run([doc], lock)
  assert.equal(result.code, 1)
  assert.match(result.stdout, /No lockfile at/)
})

test('an empty lockfile fails rather than bootstrapping', t => {
  const { doc, lock } = scratch(t, DOC)
  writeFileSync(lock, JSON.stringify({ citations: {} }))

  const result = run([doc], lock)
  assert.equal(result.code, 1, 'an empty lock must not bless implicitly')
  assert.match(result.stdout, /not in the lockfile/)
})

test('an unreadable historical commit fails unless explicitly allowed', t => {
  const { doc, lock } = scratch(t, HISTORICAL)
  run([doc, '--update'], lock)

  const strict = run([doc], lock)
  assert.equal(strict.code, 1, 'an unreachable SHA must fail by default')
  assert.match(strict.stdout, /historical commit/)

  const allowed = run([doc, '--allow-unverifiable'], lock)
  assert.equal(allowed.code, 0, 'the escape hatch must still work for shallow clones')
})

test('content drifting under a blessed citation fails', t => {
  const { doc, lock } = scratch(t, DOC)
  run([doc, '--update'], lock)

  // Same line count, different content: drift, not a move, so there is nothing to
  // follow and a human has to look at it.
  writeFileSync(lock, JSON.stringify({
    citations: { 'packages/runtime/lib/utils.js:12-14': { sha: 'deadbeefdeadbeef', head: 'not this', lines: 3 } }
  }))

  assert.equal(run([doc], lock).code, 1, 'drifted citation must fail verification')
})
