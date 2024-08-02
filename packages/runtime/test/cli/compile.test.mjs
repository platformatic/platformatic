import { createDirectory } from '@platformatic/utils'
import { join } from 'desm'
import { execa } from 'execa'
import assert from 'node:assert'
import { access, cp, mkdtemp } from 'node:fs/promises'
import path from 'node:path'
import { test } from 'node:test'
import { cliPath, delDir } from './helper.mjs'

const base = join(import.meta.url, '..', 'tmp')

try {
  await createDirectory(base)
} catch {}

test('compile without tsconfigs', async () => {
  const config = join(import.meta.url, '..', '..', 'fixtures', 'configs', 'monorepo.json')
  await execa(cliPath, ['compile', '-c', config])
})

test('compile with tsconfig', async t => {
  const tmpDir = await mkdtemp(path.join(base, 'test-runtime-compile-'))
  const prev = process.cwd()
  process.chdir(tmpDir)
  t.after(() => {
    process.chdir(prev)
  })

  t.after(delDir(tmpDir))

  const folder = join(import.meta.url, '..', '..', 'fixtures', 'typescript')
  await cp(folder, tmpDir, { recursive: true })

  const { stdout } = await execa(cliPath, ['compile'])

  const lines = stdout.split('\n').map(JSON.parse)
  const expected = [
    {
      name: 'composer',
      msg: 'No typescript configuration file was found, skipping compilation.',
    },
    {
      name: 'movies',
      msg: 'Typescript compilation completed successfully.',
    },
    {
      name: 'titles',
      msg: 'Typescript compilation completed successfully.',
    },
  ]

  for (let i = 0; i < expected.length; i++) {
    assert.deepStrictEqual(lines[i].name, expected[i].name)
    assert.deepStrictEqual(lines[i].msg, expected[i].msg)
  }
})

test('compile with tsconfig custom flags', async t => {
  const tmpDir = await mkdtemp(path.join(base, 'test-runtime-compile-'))
  const prev = process.cwd()
  process.chdir(tmpDir)
  t.after(() => {
    process.chdir(prev)
  })

  t.after(delDir(tmpDir))

  const folder = join(import.meta.url, '..', '..', 'fixtures', 'typescript-custom-flags')
  await cp(folder, tmpDir, { recursive: true })

  const { stdout } = await execa(cliPath, ['compile'])

  const lines = stdout.split('\n').map(JSON.parse)
  const expected = [
    {
      name: 'composer',
      msg: 'No typescript configuration file was found, skipping compilation.',
    },
    {
      name: 'movies',
      msg: 'Typescript compilation completed successfully.',
    },
    {
      name: 'titles',
      msg: 'Typescript compilation completed successfully.',
    },
  ]

  const outDir = path.join(tmpDir, 'services', 'movies', 'custom')

  await access(outDir)
  await access(path.join(outDir, 'plugin.js'))
  await access(path.join(outDir, 'plugin.js.map'))

  for (let i = 0; i < expected.length; i++) {
    assert.deepStrictEqual(lines[i].name, expected[i].name)
    assert.deepStrictEqual(lines[i].msg, expected[i].msg)
  }
})

test('compile single service', async t => {
  const tmpDir = await mkdtemp(path.join(base, 'test-runtime-compile-'))
  const prev = process.cwd()
  process.chdir(tmpDir)
  t.after(() => {
    process.chdir(prev)
  })

  t.after(delDir(tmpDir))

  const folder = join(import.meta.url, '..', '..', 'fixtures', 'typescript', 'services', 'movies')
  await cp(folder, tmpDir, { recursive: true })

  const { stdout } = await execa(cliPath, ['compile'])

  const lines = stdout.split('\n').map(JSON.parse)
  const expected = [
    {
      msg: 'Typescript compilation completed successfully.',
    },
  ]

  for (let i = 0; i < expected.length; i++) {
    assert.deepStrictEqual(lines[i].msg, expected[i].msg)
  }
})

test('compile with tsconfig and no .env', async t => {
  const tmpDir = await mkdtemp(path.join(base, 'test-runtime-compile-'))
  const prev = process.cwd()
  process.chdir(tmpDir)
  t.after(() => {
    process.chdir(prev)
  })

  t.after(delDir(tmpDir))

  const folder = join(import.meta.url, '..', '..', 'fixtures', 'typescript-no-env')
  await cp(folder, tmpDir, { recursive: true })

  const { stdout } = await execa(cliPath, ['compile'])

  const lines = stdout.split('\n').map(JSON.parse)
  const expected = [
    {
      name: 'composer',
      msg: 'No typescript configuration file was found, skipping compilation.',
    },
    {
      name: 'movies',
      msg: 'Typescript compilation completed successfully.',
    },
    {
      name: 'titles',
      msg: 'Typescript compilation completed successfully.',
    },
  ]

  for (let i = 0; i < expected.length; i++) {
    assert.deepStrictEqual(lines[i].name, expected[i].name)
    assert.deepStrictEqual(lines[i].msg, expected[i].msg)
  }
})
