#!/usr/bin/env node
// Verify the source citations in a design document against the tree.
//
// A citation is a backticked `path/to/file.js:12-34` (or a bare `:12-34`, or a
// short `file.js:12`, both of which inherit the previously named file). Checking
// that the line numbers are in bounds is not enough: a rebase moves code, the
// range stays in bounds, and the citation silently points at something else. So
// every citation is anchored to the *content* it was blessed against, recorded in
// a lockfile beside this script.
//
//   node scripts/check-citations.mjs [doc]        verify
//   node scripts/check-citations.mjs [doc] --update   re-bless (records current content)
//   node scripts/check-citations.mjs [doc] --fix      follow moved content, rewriting doc + lock
//   node scripts/check-citations.mjs [doc] --audit    flag citations the prose does not corroborate
//
// A citation followed by "pre-`<sha>`" in the prose is read from that commit's
// parent instead of the working tree, so deliberately historical references stay
// checkable.

import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

const ROOT = resolve(import.meta.dirname, '..')
const LOCK = join(ROOT, 'scripts', 'citations.lock.json')
const PACKAGES = join(ROOT, 'packages')

const args = process.argv.slice(2)
const mode = args.includes('--update')
  ? 'update'
  : args.includes('--fix') ? 'fix' : args.includes('--audit') ? 'audit' : 'verify'
const docPath = resolve(ROOT, args.find(a => !a.startsWith('--')) ?? 'NEW_CONFIG.md')

// ---------------------------------------------------------------- extraction

const CITATION = /`([A-Za-z0-9_./@-]*(?:\.(?:js|ts|mjs|json))?):(\d[\d,–-]*)`/g

function extract (doc) {
  const out = []
  for (const m of doc.matchAll(CITATION)) {
    const spec = m[2].replace(/–/g, '-')
    if (!/^\d+(?:[-,]\d+)*$/.test(spec)) continue
    // `http://127.0.0.1:3000-3002` and friends: a citation never follows a word char
    if (m.index > 0 && /[A-Za-z0-9]/.test(doc[m.index - 1])) continue
    const after = doc.slice(m.index + m[0].length, m.index + m[0].length + 60)
    const historical = after.match(/^[^.`]{0,20}pre-`([0-9a-f]{7,40})`/)
    out.push({
      raw: m[0],
      pathish: m[1],
      spec,
      index: m.index,
      ref: historical ? `${historical[1]}^` : null
    })
  }
  return out
}

// ---------------------------------------------------------------- resolution

const findCache = new Map()

function findByTail (tail) {
  if (findCache.has(tail)) return findCache.get(tail)
  const hits = []
  const walk = dir => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist') continue
      const full = join(dir, entry.name)
      if (entry.isDirectory()) walk(full)
      else if (full.endsWith('/' + tail)) hits.push(full)
    }
  }
  if (existsSync(PACKAGES)) walk(PACKAGES)
  findCache.set(tail, hits)
  return hits
}

// Resolve the way a reader does: an explicit path wins; a short `external.js:441`
// means the external.js the prose already named; a bare `:12` is the file the
// previous citation named. Only when nothing has been named does it fall back to
// searching the tree, and then only if the answer is unambiguous.
function resolveFile (pathish, context, named) {
  if (pathish === '') return context
  for (const cand of [join(ROOT, pathish), join(PACKAGES, pathish)]) {
    if (existsSync(cand) && statSync(cand).isFile()) return cand
  }
  const remembered = named.get(pathish)
  if (remembered) return remembered
  if (context) {
    const sameDir = join(dirname(context), pathish)
    if (existsSync(sameDir)) return sameDir
    const pkg = context.slice(PACKAGES.length + 1).split('/')[0]
    const samePkg = join(PACKAGES, pkg, pathish)
    if (existsSync(samePkg)) return samePkg
  }
  const hits = findByTail(pathish)
  return hits.length === 1 ? hits[0] : null
}

// ------------------------------------------------------------------- content

const fileCache = new Map()

function fileLines (path, ref) {
  const key = `${ref ?? ''}:${path}`
  if (fileCache.has(key)) return fileCache.get(key)
  let text
  if (ref) {
    const rel = path.slice(ROOT.length + 1)
    try {
      text = execFileSync('git', ['show', `${ref}:${rel}`], {
        cwd: ROOT,
        maxBuffer: 1 << 28,
        stdio: ['ignore', 'pipe', 'ignore']
      }).toString()
    } catch {
      // A shallow clone does not have the commit. Say so rather than failing:
      // the citation is deliberately historical and cannot be re-read here.
      const err = new Error(`unreachable commit ${ref}`)
      err.unreachable = true
      throw err
    }
  } else {
    text = readFileSync(path, 'utf8')
  }
  const lines = text.split('\n')
  fileCache.set(key, lines)
  return lines
}

function ranges (spec) {
  return spec.split(',').map(part => {
    const [a, b] = part.split('-').map(Number)
    return [a, b ?? a]
  })
}

// The blessed content is the cited lines with indentation stripped: a citation
// should survive its code being re-indented, and should not survive its code
// being replaced.
function contentOf (path, spec, ref) {
  const lines = fileLines(path, ref)
  const picked = []
  for (const [a, b] of ranges(spec)) {
    if (b > lines.length) return null
    for (let n = a; n <= b; n++) picked.push(lines[n - 1].trim())
  }
  return picked
}

const hash = picked => createHash('sha256').update(picked.join('\n')).digest('hex').slice(0, 16)

// Where else in the file does this exact block live? A rebase moves code without
// changing it, which is the case worth repairing rather than merely reporting.
function locate (path, picked, spec, ref) {
  const lines = fileLines(path, ref).map(l => l.trim())
  const rs = ranges(spec)
  if (rs.length !== 1) return null // multi-range citations are not contiguous
  const found = []
  for (let i = 0; i + picked.length <= lines.length; i++) {
    let ok = true
    for (let j = 0; j < picked.length; j++) {
      if (lines[i + j] !== picked[j]) { ok = false; break }
    }
    if (ok) found.push(i + 1)
  }
  return found.length === 1 ? found[0] : null
}

const shift = (spec, start) => {
  const [[a, b]] = ranges(spec)
  return b === a ? String(start) : `${start}-${start + (b - a)}`
}

// ---------------------------------------------------------------------- main

// The document may not exist on every branch this runs from. That is not a
// failure — there is simply nothing to check.
if (!existsSync(docPath)) {
  console.log(`${docPath.slice(ROOT.length + 1)}: not present, nothing to check`)
  process.exit(0)
}

let doc = readFileSync(docPath, 'utf8')
const lock = existsSync(LOCK) ? JSON.parse(readFileSync(LOCK, 'utf8')) : { citations: {} }
const seen = new Set()
const problems = { unresolved: [], outOfRange: [], drifted: [], moved: [], unblessed: [], unavailable: [] }
const nextLock = {}
const rewrites = []

let context = null
let contextRef = null
let count = 0
// Every suffix of a resolved path, so a later `external.js` or
// `lib/commands/external.js` finds the file the prose already named.
const named = new Map()
const remember = path => {
  const parts = path.slice(PACKAGES.length + 1).split('/')
  for (let i = parts.length - 1; i >= 0; i--) named.set(parts.slice(i).join('/'), path)
}

for (const cite of extract(doc)) {
  count++
  const path = resolveFile(cite.pathish, context, named)
  if (!path) { problems.unresolved.push(cite); continue }
  // A bare `:12-34` continues the previous citation, historical ref included.
  if (cite.pathish === '' && cite.ref === null) cite.ref = contextRef
  context = path
  contextRef = cite.ref
  remember(path)

  const rel = path.slice(ROOT.length + 1)
  const key = `${rel}:${cite.spec}${cite.ref ? `@${cite.ref}` : ''}`
  let picked
  try {
    picked = contentOf(path, cite.spec, cite.ref)
  } catch (error) {
    if (!error.unreachable) throw error
    problems.unavailable.push({ ...cite, rel })
    if (lock.citations[key]) nextLock[key] = lock.citations[key]
    seen.add(key)
    continue
  }

  if (picked === null) {
    problems.outOfRange.push({ ...cite, rel })
    continue
  }

  const sha = hash(picked)
  const blessed = lock.citations[key]

  if (mode === 'update' || !blessed) {
    if (mode !== 'update' && blessed === undefined && Object.keys(lock.citations).length) {
      problems.unblessed.push({ ...cite, rel })
    }
    nextLock[key] = { sha, head: picked[0] ?? '', lines: picked.length }
    seen.add(key)
    continue
  }

  seen.add(key)
  if (blessed.sha === sha) {
    nextLock[key] = blessed
    continue
  }

  // Content changed under the citation. Did it move, or did it change?
  const want = blessed.head
  const at = want ? locate(path, [want], cite.spec, cite.ref) : null
  if (at !== null && blessed.lines) {
    const newSpec = shift(cite.spec, at)
    const moved = contentOf(path, newSpec, cite.ref)
    if (moved && hash(moved) === blessed.sha) {
      problems.moved.push({ ...cite, rel, from: cite.spec, to: newSpec })
      if (mode === 'fix') {
        rewrites.push([cite.raw, `\`${cite.pathish}:${newSpec}\``, cite.index])
        nextLock[`${rel}:${newSpec}${cite.ref ? `@${cite.ref}` : ''}`] = blessed
      } else {
        nextLock[key] = blessed
      }
      continue
    }
  }
  problems.drifted.push({ ...cite, rel, was: blessed.head, now: picked[0] })
  nextLock[key] = blessed
}

// ------------------------------------------------------------------- audit
//
// The lockfile catches a citation that *drifts*. It cannot catch one that was
// wrong when it was blessed. So before blessing, ask a cheap question of every
// citation: the prose around it names identifiers in backticks, and at least one
// of them should appear in the lines being cited. Silence is not proof of error —
// plenty of citations point at a line whose identifier the prose never spells —
// but it is where the errors are.

const PROSE_ONLY = new Set([
  'true', 'false', 'null', 'undefined', 'string', 'number', 'boolean', 'object',
  'this', 'that', 'watt.config', 'package.json', 'node_modules'
])

function audit () {
  const suspects = []
  let context = null
  let contextRef = null
  const named = new Map()
  const remember = path => {
    const parts = path.slice(PACKAGES.length + 1).split('/')
    for (let i = parts.length - 1; i >= 0; i--) named.set(parts.slice(i).join('/'), path)
  }

  for (const cite of extract(doc)) {
    const path = resolveFile(cite.pathish, context, named)
    if (!path) continue
    if (cite.pathish === '' && cite.ref === null) cite.ref = contextRef
    context = path
    contextRef = cite.ref
    remember(path)

    const picked = contentOf(path, cite.spec, cite.ref)
    if (!picked) continue
    const body = picked.join('\n')

    const window = doc.slice(Math.max(0, cite.index - 320), cite.index + 60)
    const candidates = [...window.matchAll(/`([^`\n]{3,60})`/g)]
      .map(m => m[1])
      .filter(t => /^[A-Za-z_#$][A-Za-z0-9_.#$]*(\(\))?$/.test(t))
      .filter(t => !PROSE_ONLY.has(t) && !/^\d/.test(t))
      .map(t => t.replace(/\(\)$/, ''))
      .map(t => t.split('.').pop())
      .filter(t => t.length >= 4)

    if (!candidates.length) continue
    if (candidates.some(t => body.includes(t))) continue
    suspects.push({ cite, path, candidates: [...new Set(candidates)].slice(0, 4), head: picked[0] })
  }

  console.log(`${suspects.length} citations name nothing the prose around them mentions:\n`)
  for (const s of suspects) {
    console.log(`  ${s.path.slice(ROOT.length + 1)}:${s.cite.spec}`)
    console.log(`      prose: ${s.candidates.join(', ')}`)
    console.log(`      code:  ${s.head.slice(0, 90)}`)
  }
}

if (mode === 'audit') {
  audit()
  process.exit(0)
}

if (mode === 'fix' && rewrites.length) {
  for (const [from, to, index] of rewrites.sort((a, b) => b[2] - a[2])) {
    doc = doc.slice(0, index) + to + doc.slice(index + from.length)
  }
  writeFileSync(docPath, doc)
}

if (mode === 'update' || mode === 'fix') {
  writeFileSync(LOCK, JSON.stringify({ citations: nextLock }, null, 2) + '\n')
}

// ------------------------------------------------------------------ reporting

console.log(`${docPath.slice(ROOT.length + 1)}: ${count} citations, ${seen.size} distinct`)

const report = (label, list, fmt) => {
  if (!list.length) return
  console.log(`\n${label} (${list.length}):`)
  for (const item of list) console.log('  ' + fmt(item))
}

report('unresolved — no such file', problems.unresolved, c => `${c.raw}`)
report('out of range', problems.outOfRange, c => `${c.rel}:${c.spec}`)
report('drifted — cited lines hold different code now', problems.drifted,
  c => `${c.rel}:${c.spec}\n      blessed: ${c.was}\n      found:   ${c.now}`)
report(mode === 'fix' ? 'moved — rewritten' : 'moved — content found elsewhere (run --fix)', problems.moved,
  c => `${c.rel}: ${c.from} -> ${c.to}`)
report('not in the lockfile (run --update to bless)', problems.unblessed, c => `${c.rel}:${c.spec}`)
report('not verifiable here — historical commit absent (shallow clone?)', problems.unavailable,
  c => `${c.rel}:${c.spec} @ ${c.ref}`)

const stale = Object.keys(lock.citations).filter(k => !seen.has(k))
if (stale.length && mode === 'verify') {
  console.log(`\nlockfile entries no longer cited (${stale.length}): run --update to prune`)
}

const failed = problems.unresolved.length + problems.outOfRange.length +
  problems.drifted.length + (mode === 'verify' ? problems.moved.length : 0)
if (mode === 'verify' && failed) {
  console.log(`\nFAIL: ${failed}`)
  if (problems.moved.length) {
    console.log('Cited code moved. Run: node scripts/check-citations.mjs --fix')
  }
  if (problems.drifted.length) {
    console.log('Cited code changed. Re-read the document around each citation, then --update.')
  }
  process.exit(1)
}
console.log(`\nOK${mode === 'verify' ? '' : ` (${mode})`}`)
