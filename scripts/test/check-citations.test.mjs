// Proves the citation gate actually gates. The failure this covers is real: a
// citation added in round 23 sat unblessed while the verifier printed a warning
// and exited 0, so CI could not enforce the anchoring the document claims.

import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import assert from 'node:assert'
import test from 'node:test'

const ROOT = resolve(import.meta.dirname, '..', '..')
const SCRIPT = join(ROOT, 'scripts', 'check-citations.mjs')

// A real file so resolution succeeds; the point under test is blessing, not lookup.
const DOC = 'Cited here: `runtime/lib/utils.js:12-14`.\n'

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
  const dir = mkdtempSync(join(tmpdir(), 'citations-'))
  t.after(() => rmSync(dir, { recursive: true, force: true }))

  const doc = join(dir, 'DOC.md')
  const lock = join(dir, 'lock.json')
  writeFileSync(doc, DOC)

  // A lockfile that is non-empty but does not know this citation. Empty means
  // "bootstrap", which deliberately blesses rather than fails.
  writeFileSync(lock, JSON.stringify({
    citations: { 'packages/runtime/lib/runtime.js:1': { sha: 'x', head: 'y', lines: 1 } }
  }))

  const before = run([doc], lock)
  assert.equal(before.code, 1, 'unblessed citation must fail verification')
  assert.match(before.stdout, /not in the lockfile/)

  const blessed = run([doc, '--update'], lock)
  assert.equal(blessed.code, 0)

  const after = run([doc], lock)
  assert.equal(after.code, 0, 'blessed citation must pass')
  assert.match(after.stdout, /OK/)
})

test('content drifting under a blessed citation fails', t => {
  const dir = mkdtempSync(join(tmpdir(), 'citations-'))
  t.after(() => rmSync(dir, { recursive: true, force: true }))

  const doc = join(dir, 'DOC.md')
  const lock = join(dir, 'lock.json')
  writeFileSync(doc, DOC)
  run([doc, '--update'], lock)

  // Same line count, different content: this is drift, not a move, so there is
  // nothing to follow and a human has to look at it.
  writeFileSync(lock, JSON.stringify({
    citations: { 'packages/runtime/lib/utils.js:12-14': { sha: 'deadbeefdeadbeef', head: 'not this', lines: 3 } }
  }))

  const result = run([doc], lock)
  assert.equal(result.code, 1, 'drifted citation must fail verification')
})
