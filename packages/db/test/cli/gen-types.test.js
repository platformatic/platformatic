import { createDirectory, safeRemove } from '@platformatic/foundation'
import { execa } from 'execa'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { cp, readFile, symlink } from 'node:fs/promises'
import { resolve } from 'node:path'
import { test } from 'node:test'
import { setTimeout } from 'node:timers/promises'
import split from 'split2'
import { applyMigrations } from '../../lib/commands/migrations-apply.js'
import { generateTypes } from '../../lib/commands/types.js'
import { safeKill, startPath } from './helper.js'
import { createCapturingLogger, createTestContext, withWorkingDirectory } from './test-utilities.js'

let counter = 0

let pathToTSD = resolve(import.meta.dirname, '../../node_modules/.bin/tsd')

if (!existsSync(pathToTSD)) {
  pathToTSD = resolve(import.meta.dirname, '../../../../node_modules/.bin/tsd')
}

async function prepareTemporaryDirectory (t, testDir) {
  const cwd = resolve(import.meta.dirname, '..', 'tmp', `gen-types-clone-${counter++}`)

  t.after(async () => {
    await safeRemove(cwd)
  })

  await safeRemove(cwd)
  await createDirectory(cwd)
  await cp(testDir, cwd, { recursive: true })
  await linkDependencies(cwd)

  return cwd
}

async function linkDependencies (root) {
  await createDirectory(resolve(root, 'node_modules/@platformatic'))
  await symlink(resolve(import.meta.dirname, '../../'), resolve(root, 'node_modules/@platformatic/db'), 'dir')
}

test('generate ts types', async t => {
  const testDir = resolve(import.meta.dirname, '..', 'fixtures', 'gen-types')
  const cwd = await prepareTemporaryDirectory(t, testDir)

  const logger = createCapturingLogger()
  const context = createTestContext()
  const configFile = resolve(cwd, 'platformatic.db.json')

  await withWorkingDirectory(cwd, async () => {
    await applyMigrations(logger, configFile, [], context)
    await generateTypes(logger, configFile, [], context)
  })()

  await execa(pathToTSD, { cwd })
})

test('generate ts types without changing the cwd', async t => {
  const testDir = resolve(import.meta.dirname, '..', 'fixtures', 'gen-types')
  const cwd = await prepareTemporaryDirectory(t, testDir)

  const logger = createCapturingLogger()
  const context = createTestContext()
  const configFile = resolve(cwd, 'platformatic.db.json')

  await withWorkingDirectory(cwd, async () => {
    await applyMigrations(logger, configFile, [], context)
  })()

  await generateTypes(logger, configFile, [], context)

  await execa(pathToTSD, { cwd })
})

test('generate ts types twice', async t => {
  const testDir = resolve(import.meta.dirname, '..', 'fixtures', 'gen-types')
  const cwd = await prepareTemporaryDirectory(t, testDir)
  const configFile = resolve(cwd, 'platformatic.db.json')

  const logger = createCapturingLogger()
  const context = createTestContext()

  await withWorkingDirectory(cwd, async () => {
    await applyMigrations(logger, configFile, [], context)
    await generateTypes(logger, configFile, [], context)
    await generateTypes(logger, configFile, [], context)
  })()

  await execa(pathToTSD, { cwd })
})

test('should show warning if there is no entities', async t => {
  const testDir = resolve(import.meta.dirname, '..', 'fixtures', 'auto-gen-types')
  const cwd = await prepareTemporaryDirectory(t, testDir)
  const configFile = resolve(cwd, 'platformatic.db.json')

  const logger = createCapturingLogger()
  const context = createTestContext()

  await withWorkingDirectory(cwd, async () => {
    await generateTypes(logger, configFile, [], context)
  })()

  const output = logger.getCaptured()
  assert.ok(output.includes('No entities found in your schema. Types were NOT generated.'))
  assert.ok(output.includes('Make sure you have applied all the migrations and try again.'))
})

test('run migrate command with type generation', async t => {
  const testDir = resolve(import.meta.dirname, '..', 'fixtures', 'auto-gen-types')
  const cwd = await prepareTemporaryDirectory(t, testDir)
  const configFile = resolve(cwd, 'platformatic.db.json')

  const fieldRegex = /\n\s*(\w+)\??:/g

  const logger = createCapturingLogger()
  const context = createTestContext()

  await withWorkingDirectory(cwd, async () => {
    await applyMigrations(logger, configFile, [], context)
  })()

  const output = logger.getCaptured()
  assert.equal(output.includes('Generated type for Movie entity.'), true)

  const indexDTs = await readFile(resolve(cwd, 'types', 'index.d.ts'), 'utf8')
  assert.equal(indexDTs.indexOf('AggregateRating') < indexDTs.indexOf('Movie'), true)
  const aggregateRatingDTs = await readFile(resolve(cwd, 'types', 'aggregateRating.d.ts'), 'utf8')
  assert.deepEqual(
    [...aggregateRatingDTs.matchAll(fieldRegex)].map(m => m[1]),
    ['id', 'movieId', 'rating', 'ratingType']
  )
  const movieDTs = await readFile(resolve(cwd, 'types', 'movie.d.ts'), 'utf8')
  assert.deepEqual(
    [...movieDTs.matchAll(fieldRegex)].map(m => m[1]),
    ['id', 'boxOffice', 'title', 'year']
  )

  await execa(pathToTSD, { cwd })
})

test('run migrate command with type generation without plugin in config', async t => {
  const testDir = resolve(import.meta.dirname, '..', 'fixtures', 'auto-gen-types-no-plugin')
  const cwd = await prepareTemporaryDirectory(t, testDir)
  const configFile = resolve(cwd, 'platformatic.db.json')

  const logger = createCapturingLogger()
  const context = createTestContext()

  await withWorkingDirectory(cwd, async () => {
    await applyMigrations(logger, configFile, [], context)
  })()

  const output = logger.getCaptured()
  assert.equal(output.includes('Generated type for Graph entity.'), true)

  await execa(pathToTSD, { cwd })
})

test('generate types on start', async t => {
  const testDir = resolve(import.meta.dirname, '..', 'fixtures', 'auto-gen-types')
  const cwd = await prepareTemporaryDirectory(t, testDir)

  const child = execa('node', [startPath], { cwd })
  t.after(async () => {
    await safeKill(child)
  })

  const splitter = split()
  child.stdout.pipe(splitter)

  let found = false
  for await (const data of splitter) {
    if (data.match(/(.*)Generated type for(.*)/)) {
      found = true
      break
    }
  }
  assert.equal(found, true)

  await setTimeout(100)

  await execa(pathToTSD, { cwd })
})

test('generate types on start in a different cwd', async t => {
  const testDir = resolve(import.meta.dirname, '..', 'fixtures', 'auto-gen-types')
  const cwd = await prepareTemporaryDirectory(t, testDir)
  const configFile = resolve(cwd, 'platformatic.db.json')

  const child = execa('node', [startPath, configFile], { cwd })
  t.after(async () => {
    await safeKill(child)
  })

  const splitter = split()
  child.stdout.pipe(splitter)

  let found = false
  for await (const data of splitter) {
    // Check if the output contains the expected message about generated types
    if (data.match(/(.*)Generated type for(.*)/)) {
      found = true
      break
    }
  }
  assert.equal(found, true)

  await setTimeout(100)

  await execa(pathToTSD, { cwd })
})

test('correctly format entity type names', async t => {
  const testDir = resolve(import.meta.dirname, '..', 'fixtures', 'chars-gen-types')
  const cwd = await prepareTemporaryDirectory(t, testDir)
  const configFile = resolve(cwd, 'platformatic.db.json')

  const logger = createCapturingLogger()
  const context = createTestContext()

  await withWorkingDirectory(cwd, async () => {
    await applyMigrations(logger, configFile, [], context)
  })()

  const output = logger.getCaptured()
  assert.equal(output.includes('Generated type for PltDb entity.'), true)
})

test('use types directory from config as target folder', async t => {
  const testDir = resolve(import.meta.dirname, '..', 'fixtures', 'gen-types-dir')
  const cwd = await prepareTemporaryDirectory(t, testDir)
  const configFile = resolve(cwd, 'platformatic.db.json')

  const logger = createCapturingLogger()
  const context = createTestContext()

  await withWorkingDirectory(cwd, async () => {
    await applyMigrations(logger, configFile, [], context)
  })()

  const output = logger.getCaptured()
  assert.equal(output.includes('Generated type for Graph entity.'), true)

  await execa(pathToTSD, { cwd })
})

test('generate types on start while considering types directory', async t => {
  const testDir = resolve(import.meta.dirname, '..', 'fixtures', 'auto-gen-types-dir')
  const cwd = await prepareTemporaryDirectory(t, testDir)
  const configFile = resolve(cwd, 'platformatic.db.json')

  const child = execa('node', [startPath, configFile], { cwd })
  t.after(async () => {
    await safeKill(child)
  })

  const splitter = split()
  child.stdout.pipe(splitter)

  let found = false
  for await (const data of splitter) {
    if (data.match(/(.*)Generated type for(.*)/)) {
      found = true
      break
    }
  }
  assert.equal(found, true)

  await setTimeout(100)

  await execa(pathToTSD, { cwd })
})
