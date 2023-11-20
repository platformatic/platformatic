import assert from 'node:assert/strict'
import { test } from 'node:test'
import { join } from 'node:path'
import { setTimeout } from 'node:timers/promises'
import { rm, mkdir, cp, readFile, writeFile } from 'node:fs/promises'
import { execa } from 'execa'
import stripAnsi from 'strip-ansi'
import split from 'split2'
import { urlDirname } from '../../lib/utils.js'
import { cliPath } from './helper.js'

let counter = 0

const pathToTSD = join(urlDirname(import.meta.url), '../../node_modules/.bin/tsd')

async function safeRm (dir) {
  // we are running on CI, no need for clean up
  if (process.env.CI) {
    return
  }

  let _err = null
  let count = 0

  while (count++ < 10) {
    try {
      _err = null
      await rm(dir, { force: true, recursive: true })
    } catch (err) {
      _err = err
      if (err.code === 'EBUSY') {
        await setTimeout(count * 100)
      } else {
        break
      }
    }
  }

  if (_err) {
    throw _err
  }
}

async function adjustTypeReferenceToAvoidLoops (cwd) {
  let types = await readFile(join(cwd, 'global.d.ts'), 'utf8')
  types = types.replace('@platformatic/db', '../../../index')
  await writeFile(join(cwd, 'global.d.ts'), types, 'utf8')
}

test('generate ts types', async (t) => {
  const testDir = join(urlDirname(import.meta.url), '..', 'fixtures', 'gen-types')
  const cwd = join(urlDirname(import.meta.url), '..', 'tmp', `gen-types-clone-${counter++}`)

  try {
    await safeRm(cwd)
  } catch {}

  await mkdir(cwd)
  await cp(testDir, cwd, { recursive: true })

  t.after(async () => {
    await safeRm(cwd)
  })

  try {
    t.diagnostic('running migrations')
    await execa('node', [cliPath, 'migrations', 'apply'], { cwd })
    t.diagnostic('generating types')
    await execa('node', [cliPath, 'types'], { cwd })

    t.diagnostic('Adjusting type reference to avoid loops')
    await adjustTypeReferenceToAvoidLoops(cwd)

    t.diagnostic('running tsd')
    await execa(pathToTSD, { cwd })
  } catch (err) {
    console.log(err)
    assert.fail('Failed to generate types')
  }
})

test('generate ts types twice', async (t) => {
  const testDir = join(urlDirname(import.meta.url), '..', 'fixtures', 'gen-types')
  const cwd = join(urlDirname(import.meta.url), '..', 'tmp', `gen-types-clone-${counter++}`)

  try {
    await safeRm(cwd)
  } catch {}

  t.diagnostic(cwd)
  await mkdir(cwd)
  await cp(testDir, cwd, { recursive: true })

  t.after(async () => {
    await safeRm(cwd)
  })

  try {
    t.diagnostic('running migrations')
    await execa('node', [cliPath, 'migrations', 'apply'], { cwd })
    t.diagnostic('first command')
    await execa('node', [cliPath, 'types'], { cwd })
    t.diagnostic('second command')
    await execa('node', [cliPath, 'types'], { cwd })
    t.diagnostic('Adjusting type reference to avoid loops')
    await adjustTypeReferenceToAvoidLoops(cwd)
    t.diagnostic('running tsd')
    await execa(pathToTSD, { cwd })
  } catch (err) {
    console.log(err.stdout)
    console.log(err.stderr)
    assert.fail(err.stderr)
  }
})

test('should show warning if there is no entities', async (t) => {
  const testDir = join(urlDirname(import.meta.url), '..', 'fixtures', 'auto-gen-types')
  const cwd = join(urlDirname(import.meta.url), '..', 'tmp', `gen-types-clone-${counter++}`)

  try {
    await safeRm(cwd)
  } catch {}

  await cp(testDir, cwd, { recursive: true })

  t.after(async () => {
    await safeRm(cwd)
  })

  try {
    const { stdout } = await execa('node', [cliPath, 'types'], { cwd })
    assert.ok(stdout.includes('No entities found in your schema. Types were NOT generated.'))
    assert.ok(stdout.includes('Please run `platformatic db migrations apply` to generate types.'))
  } catch (err) {
    console.log(err)
    assert.fail('Failed to generate types')
  }
})

test('run migrate command with type generation', async (t) => {
  const testDir = join(urlDirname(import.meta.url), '..', 'fixtures', 'auto-gen-types')
  const cwd = join(urlDirname(import.meta.url), '..', 'tmp', `gen-types-clone-${counter++}`)

  const fieldRegex = /\n\s*(\w+)\??:/g

  try {
    await safeRm(cwd)
  } catch {}

  await cp(testDir, cwd, { recursive: true })

  t.after(async () => {
    await safeRm(cwd)
  })

  try {
    const child = await execa('node', [cliPath, 'migrations', 'apply'], { cwd })
    assert.equal(child.stdout.includes('Generated type for Movie entity.'), true)
    assert.equal(child.stdout.includes('Please run `npm i --save'), true)

    t.diagnostic('Adjusting type reference to avoid loops')
    await adjustTypeReferenceToAvoidLoops(cwd)

    const globalDTs = await readFile(join(cwd, 'global.d.ts'), 'utf8')
    const indexDTs = await readFile(join(cwd, 'types', 'index.d.ts'), 'utf8')
    assert.equal(globalDTs.indexOf('AggregateRating') < globalDTs.indexOf('Movie'), true)
    assert.equal(indexDTs.indexOf('AggregateRating') < indexDTs.indexOf('Movie'), true)
    const aggregateRatingDTs = await readFile(join(cwd, 'types', 'AggregateRating.d.ts'), 'utf8')
    assert.deepEqual(
      [...aggregateRatingDTs.matchAll(fieldRegex)].map(m => m[1]),
      ['id', 'movieId', 'rating', 'ratingType']
    )
    const movieDTs = await readFile(join(cwd, 'types', 'Movie.d.ts'), 'utf8')
    assert.deepEqual(
      [...movieDTs.matchAll(fieldRegex)].map(m => m[1]),
      ['id', 'boxOffice', 'title', 'year']
    )

    await execa(pathToTSD, { cwd })
  } catch (err) {
    assert.fail('Failed to generate types')
  }
})

test('run migrate command with type generation without plugin in config', async (t) => {
  const testDir = join(urlDirname(import.meta.url), '..', 'fixtures', 'auto-gen-types-no-plugin')
  const cwd = join(urlDirname(import.meta.url), '..', 'tmp', `gen-types-clone-${counter++}`)

  try {
    await safeRm(cwd)
  } catch {}

  await cp(testDir, cwd, { recursive: true })

  t.after(async () => {
    await safeRm(cwd)
  })

  try {
    const child = await execa('node', [cliPath, 'migrations', 'apply'], { cwd })
    assert.equal(child.stdout.includes('Generated type for Graph entity.'), true)
    assert.equal(child.stdout.includes('Please run `npm i --save'), true)

    t.diagnostic('Adjusting type reference to avoid loops')
    await adjustTypeReferenceToAvoidLoops(cwd)

    await execa(pathToTSD, { cwd })
  } catch (err) {
    console.log(err)
    assert.fail('Failed to generate types')
  }
})

test('missing config file', async (t) => {
  try {
    await execa('node', [cliPath, 'seed'])
  } catch (err) {
    assert.equal(err.exitCode, 1)
    assert.ok(err.stderr.includes('Missing config file'))
  }
})

test('generate types on start', async (t) => {
  const testDir = join(urlDirname(import.meta.url), '..', 'fixtures', 'auto-gen-types')
  const cwd = join(urlDirname(import.meta.url), '..', 'tmp', `gen-types-clone-${counter++}`)

  try {
    await safeRm(cwd)
  } catch {}

  await cp(testDir, cwd, { recursive: true })

  const child = execa('node', [cliPath, 'start'], { cwd })
  t.after(async () => {
    child.kill('SIGINT')
    await safeRm(cwd)
  })

  const splitter = split()
  child.stdout.pipe(splitter)

  let found = false
  for await (const data of splitter) {
    const sanitized = stripAnsi(data)
    if (sanitized.match(/(.*)Generated type for(.*)/)) {
      found = true
      break
    }
  }
  assert.equal(found, true)

  t.diagnostic('sleep a bit to allow the fs to write everything down')
  await setTimeout(100)

  t.diagnostic('Adjusting type reference to avoid loops')
  await adjustTypeReferenceToAvoidLoops(cwd)

  try {
    await execa(pathToTSD, { cwd })
  } catch (err) {
    console.log(err)
    assert.fail('Failed to generate types')
  }
})

test('correctly format entity type names', async (t) => {
  const testDir = join(urlDirname(import.meta.url), '..', 'fixtures', 'chars-gen-types')
  const cwd = join(urlDirname(import.meta.url), '..', 'tmp', `gen-types-clone-${counter++}`)

  try {
    await safeRm(cwd)
  } catch {}
  await cp(testDir, cwd, { recursive: true })

  t.after(async () => {
    await safeRm(cwd)
  })

  try {
    const child = await execa('node', [cliPath, 'migrations', 'apply'], { cwd })
    assert.equal(child.stdout.includes('Generated type for PltDb entity.'), true)
  } catch (err) {
    console.log(err)
    assert.fail('Failed to generate types')
  }
})

test('use types directory from config as target folder', async (t) => {
  const testDir = join(urlDirname(import.meta.url), '..', 'fixtures', 'gen-types-dir')
  const cwd = join(urlDirname(import.meta.url), '..', 'tmp', `gen-types-clone-${counter++}`)

  try {
    await safeRm(cwd)
  } catch {}
  await cp(testDir, cwd, { recursive: true })

  t.after(async () => {
    await safeRm(cwd)
  })

  try {
    const child = await execa('node', [cliPath, 'migrations', 'apply'], { cwd })
    assert.equal(child.stdout.includes('Generated type for Graph entity.'), true)

    t.diagnostic('Adjusting type reference to avoid loops')
    await adjustTypeReferenceToAvoidLoops(cwd)
    await execa(pathToTSD, { cwd })
  } catch (err) {
    console.log(err)
    assert.fail('Failed to generate types')
  }
})

test('generate types on start while considering types directory', async (t) => {
  const testDir = join(urlDirname(import.meta.url), '..', 'fixtures', 'auto-gen-types-dir')
  const cwd = join(urlDirname(import.meta.url), '..', 'tmp', `gen-types-clone-${counter++}`)

  try {
    await safeRm(cwd)
  } catch {}
  await cp(testDir, cwd, { recursive: true })

  const child = execa('node', [cliPath, 'start'], { cwd })
  t.after(async () => {
    child.kill('SIGINT')
    await safeRm(cwd)
  })

  const splitter = split()
  child.stdout.pipe(splitter)

  let found = false
  for await (const data of splitter) {
    const sanitized = stripAnsi(data)
    if (sanitized.match(/(.*)Generated type for(.*)/)) {
      found = true
      break
    }
  }
  assert.equal(found, true)

  t.diagnostic('Sleep to the the file system flush the file')
  await setTimeout(100)

  t.diagnostic('Adjusting type reference to avoid loops')
  await adjustTypeReferenceToAvoidLoops(cwd)

  try {
    await execa(pathToTSD, { cwd })
  } catch (err) {
    console.log(err)
    assert.fail('Failed to generate types')
  }
})
