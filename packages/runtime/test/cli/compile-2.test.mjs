import { test } from 'node:test'
import assert from 'node:assert'
import { join } from 'desm'
import path from 'node:path'
import { cliPath, delDir } from './helper.mjs'
import { execa } from 'execa'
import { mkdtemp, cp, mkdir } from 'node:fs/promises'

const base = join(import.meta.url, '..', 'tmp')

try {
  await mkdir(base, { recursive: true })
} catch {
}

test('compile with tsconfig custom flags', async (t) => {
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
  const expected = [{
    name: 'movies',
    msg: 'Typescript compilation completed successfully.'
  }, {
    name: 'titles',
    msg: 'Typescript compilation completed successfully.'
  }]

  for (let i = 0; i < expected.length; i++) {
    assert.deepStrictEqual(lines[i].name, expected[i].name)
    assert.deepStrictEqual(lines[i].msg, expected[i].msg)
  }
})

test('compile single service', async (t) => {
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
  const expected = [{
    msg: 'Typescript compilation completed successfully.'
  }]

  for (let i = 0; i < expected.length; i++) {
    assert.deepStrictEqual(lines[i].msg, expected[i].msg)
  }
})
