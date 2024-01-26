'use strict'

const { readFile, rm } = require('node:fs/promises')
const { test, afterEach } = require('node:test')
const assert = require('node:assert')
const { join } = require('node:path')

const { fakeLogger, getTempDir } = require('./helpers')
const { StackableGenerator } = require('../lib/stackable-generator')

afterEach(async () => {
  try {
    await rm(join(__dirname, 'tmp'), { recursive: true })
  } catch (err) {
    // do nothing
  }
})

test('should create a stackable project without typescript', async (t) => {
  const dir = await getTempDir()
  const gen = new StackableGenerator({
    logger: fakeLogger
  })

  gen.setConfig({
    targetDirectory: dir
  })

  await gen.run()
  // check files are created
  const packageJson = JSON.parse(await readFile(join(dir, 'package.json'), 'utf8'))
  assert.ok(packageJson.scripts)
  assert.ok(packageJson.dependencies)
  assert.ok(packageJson.engines)

  const indexFile = await readFile(join(dir, 'index.js'), 'utf8')
  assert.ok(indexFile.length > 0)

  const indexTypesFile = await readFile(join(dir, 'index.d.ts'), 'utf8')
  assert.ok(indexTypesFile.length > 0)

  const schemaFile = await readFile(join(dir, 'lib', 'schema.js'), 'utf8')
  assert.ok(schemaFile.length > 0)

  const generatorFile = await readFile(join(dir, 'lib', 'generator.js'), 'utf8')
  assert.ok(generatorFile.length > 0)

  const startCommandFile = await readFile(join(dir, 'cli', 'start.js'), 'utf8')
  assert.ok(startCommandFile.length > 0)

  const createCommandFile = await readFile(join(dir, 'cli', 'create.js'), 'utf8')
  assert.ok(createCommandFile.length > 0)

  const gitignore = await readFile(join(dir, '.gitignore'), 'utf8')
  assert.ok(gitignore.length > 0)
})

test('should create a stackable project with typescript', async (t) => {
  const dir = await getTempDir()
  const gen = new StackableGenerator({
    logger: fakeLogger
  })

  gen.setConfig({
    targetDirectory: dir,
    typescript: true
  })

  await gen.run()
  // check files are created
  const packageJson = JSON.parse(await readFile(join(dir, 'package.json'), 'utf8'))
  assert.ok(packageJson.scripts)
  assert.ok(packageJson.dependencies)
  assert.ok(packageJson.engines)

  const indexFile = await readFile(join(dir, 'index.ts'), 'utf8')
  assert.ok(indexFile.length > 0)

  const indexTypesFile = await readFile(join(dir, 'index.d.ts'), 'utf8')
  assert.ok(indexTypesFile.length > 0)

  const schemaFile = await readFile(join(dir, 'lib', 'schema.ts'), 'utf8')
  assert.ok(schemaFile.length > 0)

  const generatorFile = await readFile(join(dir, 'lib', 'generator.ts'), 'utf8')
  assert.ok(generatorFile.length > 0)

  const startCommandFile = await readFile(join(dir, 'cli', 'start.ts'), 'utf8')
  assert.ok(startCommandFile.length > 0)

  const createCommandFile = await readFile(join(dir, 'cli', 'create.ts'), 'utf8')
  assert.ok(createCommandFile.length > 0)

  const gitignore = await readFile(join(dir, '.gitignore'), 'utf8')
  assert.ok(gitignore.length > 0)
})
