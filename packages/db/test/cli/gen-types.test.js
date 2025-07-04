'use strict'

const { createDirectory, safeRemove } = require('@platformatic/utils')
const { execa } = require('execa')
const assert = require('node:assert/strict')
const { existsSync } = require('node:fs')
const { cp, readFile, symlink } = require('node:fs/promises')
const { resolve } = require('node:path')
const { test } = require('node:test')
const { setTimeout } = require('node:timers/promises')
const split = require('split2')
const { cliPath, safeKill, startPath } = require('./helper.js')

let counter = 0

let pathToTSD = resolve(__dirname, '../../node_modules/.bin/tsd')

if (!existsSync(pathToTSD)) {
  pathToTSD = resolve(__dirname, '../../../../node_modules/.bin/tsd')
}

async function prepareTemporaryDirectory (t, testDir) {
  const cwd = resolve(__dirname, '..', 'tmp', `gen-types-clone-${counter++}`)

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
  await symlink(resolve(__dirname, '../../'), resolve(root, 'node_modules/@platformatic/db'), 'dir')
}

test('generate ts types', async t => {
  const testDir = resolve(__dirname, '..', 'fixtures', 'gen-types')
  const cwd = await prepareTemporaryDirectory(t, testDir)

  await execa('node', [cliPath, 'applyMigrations', resolve(cwd, 'platformatic.db.json')], { cwd })
  await execa('node', [cliPath, 'types', resolve(cwd, 'platformatic.db.json')], { cwd })

  await execa(pathToTSD, { cwd })
})

test('generate ts types twice', async t => {
  const testDir = resolve(__dirname, '..', 'fixtures', 'gen-types')
  const cwd = await prepareTemporaryDirectory(t, testDir)
  const configFile = resolve(cwd, 'platformatic.db.json')

  await execa('node', [cliPath, 'applyMigrations', configFile], { cwd })
  await execa('node', [cliPath, 'types', configFile], { cwd })
  await execa('node', [cliPath, 'types', configFile], { cwd })
  await execa(pathToTSD, { cwd })
})

test('should show warning if there is no entities', async t => {
  const testDir = resolve(__dirname, '..', 'fixtures', 'auto-gen-types')
  const cwd = await prepareTemporaryDirectory(t, testDir)
  const configFile = resolve(cwd, 'platformatic.db.json')

  const { stdout } = await execa('node', [cliPath, 'types', configFile], { cwd })
  assert.ok(stdout.includes('No entities found in your schema. Types were NOT generated.'))
  assert.ok(stdout.includes('Make sure you have applied all the migrations and try again.'))
})

test('run migrate command with type generation', async t => {
  const testDir = resolve(__dirname, '..', 'fixtures', 'auto-gen-types')
  const cwd = await prepareTemporaryDirectory(t, testDir)
  const configFile = resolve(cwd, 'platformatic.db.json')

  const fieldRegex = /\n\s*(\w+)\??:/g

  const child = await execa('node', [cliPath, 'applyMigrations', configFile], { cwd })
  assert.equal(child.stdout.includes('Generated type for Movie entity.'), true)

  const indexDTs = await readFile(resolve(cwd, 'types', 'index.d.ts'), 'utf8')
  assert.equal(indexDTs.indexOf('AggregateRating') < indexDTs.indexOf('Movie'), true)
  const aggregateRatingDTs = await readFile(resolve(cwd, 'types', 'aggregateRating.d.ts'), 'utf8')
  assert.deepEqual(
    [...aggregateRatingDTs.matchAll(fieldRegex)].map(m => m[1]),
    ['id', 'movieId', 'rating', 'ratingType']
  )
  const movieDTs = await readFile(resolve(cwd, 'types', 'Movie.d.ts'), 'utf8')
  assert.deepEqual(
    [...movieDTs.matchAll(fieldRegex)].map(m => m[1]),
    ['id', 'boxOffice', 'title', 'year']
  )

  await execa(pathToTSD, { cwd })
})

test('run migrate command with type generation without plugin in config', async t => {
  const testDir = resolve(__dirname, '..', 'fixtures', 'auto-gen-types-no-plugin')
  const cwd = await prepareTemporaryDirectory(t, testDir)
  const configFile = resolve(cwd, 'platformatic.db.json')

  const child = await execa('node', [cliPath, 'applyMigrations', configFile], { cwd })
  assert.equal(child.stdout.includes('Generated type for Graph entity.'), true)

  await execa(pathToTSD, { cwd })
})

test('generate types on start', async t => {
  const testDir = resolve(__dirname, '..', 'fixtures', 'auto-gen-types')
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
  const testDir = resolve(__dirname, '..', 'fixtures', 'auto-gen-types')
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
  const testDir = resolve(__dirname, '..', 'fixtures', 'chars-gen-types')
  const cwd = await prepareTemporaryDirectory(t, testDir)
  const configFile = resolve(cwd, 'platformatic.db.json')

  const child = await execa('node', [cliPath, 'applyMigrations', configFile], { cwd })
  assert.equal(child.stdout.includes('Generated type for PltDb entity.'), true)
})

test('use types directory from config as target folder', async t => {
  const testDir = resolve(__dirname, '..', 'fixtures', 'gen-types-dir')
  const cwd = await prepareTemporaryDirectory(t, testDir)
  const configFile = resolve(cwd, 'platformatic.db.json')

  const child = await execa('node', [cliPath, 'applyMigrations', configFile], { cwd })
  assert.equal(child.stdout.includes('Generated type for Graph entity.'), true)

  await execa(pathToTSD, { cwd })
})

test('generate types on start while considering types directory', async t => {
  const testDir = resolve(__dirname, '..', 'fixtures', 'auto-gen-types-dir')
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
