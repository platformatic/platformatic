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

  assert.strictEqual(res, true)

  pinoTest.consecutive(stream, [
    { level: 30, msg: 'No typescript configuration file was found, skipping compilation.' }
  ])
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
        outDir: 'dist'
      }
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
        outDir: 'dist'
      }
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
    { level: 30, msg: 'Typescript compilation completed successfully.' }
  ])

  await assert.rejects(access(join(localTmpDir, 'dist', 'whaat')))
})

test('throws on failed compilation', async t => {
  const localTmpDir = join(tmpDir, 'compiled')
  await createDirectory(join(localTmpDir), true)
  t.after(async () => {
    await safeRemove(localTmpDir)
  })

  await writeFile(
    join(localTmpDir, 'tsconfig.json'),
    JSON.stringify({
      compilerOptions: {
        outDir: 'dist'
      }
    })
  )

  await writeFile(join(localTmpDir, 'index.ts'), 'const x: string = 42', {
    message: /Type 'number' is not assignable to type 'string'/
  })

  const stream = pinoTest.sink()
  const logger = pino(stream)

  await assert.rejects(() => compile({ cwd: localTmpDir, logger }))
})
