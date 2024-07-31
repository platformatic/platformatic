'use strict'

const { test } = require('node:test')
const { join } = require('node:path')
const { writeFile, readFile, access } = require('node:fs/promises')
const assert = require('node:assert')
const os = require('node:os')
const pino = require('pino')
const pinoTest = require('pino-test')

const { compile } = require('../compile.js')
const { safeRemove, createDirectory } = require('@platformatic/utils')

const tmpDir = os.tmpdir()
const cwd = process.cwd()

test('empty folder', async t => {
  process.chdir(tmpDir)
  t.after(() => {
    process.chdir(cwd)
  })

  const stream = pinoTest.sink()
  const logger = pino(stream)

  const res = await compile({ cwd: tmpDir, logger })

  assert.strictEqual(res, false)

  pinoTest.consecutive(stream, [{ level: 40, msg: 'The tsc executable was not found.' }])
})

test('successfully compile', async t => {
  const localTmpDir = join(tmpDir, 'compiled')
  await createDirectory(join(localTmpDir), true)
  t.after(async () => {
    await safeRemove(localTmpDir)
  })

  await writeFile(
    join(localTmpDir, 'tsconfig.json'),
    JSON.stringify({
      compilerOptions: {
        outDir: 'dist',
      },
    })
  )

  await writeFile(join(localTmpDir, 'index.ts'), 'console.log("Hello, World!")')

  const stream = pinoTest.sink()
  const logger = pino(stream)

  const res = await compile({ cwd: localTmpDir, logger })

  assert.strictEqual(res, true)

  await pinoTest.consecutive(stream, [{ level: 30, msg: 'Typescript compilation completed successfully.' }])

  const compiled = await readFile(join(localTmpDir, 'dist', 'index.js'), 'utf8')
  assert.strictEqual(compiled, 'console.log("Hello, World!");\n')
})

test('clean', async t => {
  const localTmpDir = join(tmpDir, 'compiled')
  await createDirectory(join(localTmpDir, 'dist'), true)
  t.after(async () => {
    await safeRemove(localTmpDir)
  })

  await writeFile(
    join(localTmpDir, 'tsconfig.json'),
    JSON.stringify({
      compilerOptions: {
        outDir: 'dist',
      },
    })
  )

  await writeFile(join(localTmpDir, 'dist', 'whaat'), '42')

  await writeFile(join(localTmpDir, 'index.ts'), 'console.log("Hello, World!")')

  const stream = pinoTest.sink()
  const logger = pino(stream)

  const res = await compile({ cwd: localTmpDir, logger, clean: true })

  assert.strictEqual(res, true)

  await pinoTest.consecutive(stream, [
    { level: 30, msg: 'Removing build directory ' + join(localTmpDir, 'dist') },
    { level: 30, msg: 'Typescript compilation completed successfully.' },
  ])

  await assert.rejects(access(join(localTmpDir, 'dist', 'whaat')))
})
