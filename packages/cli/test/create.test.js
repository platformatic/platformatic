'use strict'
import assert from 'assert/strict'
import { test } from 'node:test'
import { join } from 'node:path'
import { execa } from 'execa'
import { tmpdir } from 'node:os'
import { readdir, rm, stat } from 'node:fs/promises'
import { cliPath } from './helper.js'

let count = 0
test('should create a service with base options', async (t) => {
  const dest = join(tmpdir(), `test-cli-create-${process.pid}-${count++}`)
  t.after(async () => {
    await rm(dest, { recursive: true })
  })

  const child = execa('node', [
    cliPath, 'service', 'create',
    '--dir', dest,
    '--install', 'false'
  ])
  await child

  // check file structure
  const files = ['.env', '.env.sample', '.gitignore', 'README.md', 'global.d.ts', 'package.json', 'platformatic.json']
  const dirs = ['plugins', 'routes', 'test']

  const dirContents = await readdir(dest)
  for (const file of dirContents) {
    const fileStat = await stat(join(dest, file))
    if (fileStat.isDirectory()) {
      assert.ok(dirs.includes(file), `Directory ${file} is expected`)
    }

    if (fileStat.isFile()) {
      assert.ok(files.includes(file), `File ${file} is expected`)
    }
  }
})

test('should create a db with base options', async (t) => {
  const dest = join(tmpdir(), `test-cli-create-${process.pid}-${count++}`)
  t.after(async () => {
    await rm(dest, { recursive: true })
  })

  const child = execa('node', [
    cliPath, 'db', 'create',
    '--dir', dest,
    '--install', 'false'
  ])
  await child

  // check file structure
  const files = ['.env', '.env.sample', '.gitignore', 'README.md', 'global.d.ts', 'package.json', 'platformatic.json']
  const dirs = ['migrations', 'plugins', 'routes', 'test']

  const dirContents = await readdir(dest)
  for (const file of dirContents) {
    const fileStat = await stat(join(dest, file))
    if (fileStat.isDirectory()) {
      assert.ok(dirs.includes(file), `Directory ${file} is expected`)
    }

    if (fileStat.isFile()) {
      assert.ok(files.includes(file), `File ${file} is expected`)
    }
  }
})

test('should create a composer with base options', async (t) => {
  const dest = join(tmpdir(), `test-cli-create-${process.pid}-${count++}`)
  t.after(async () => {
    await rm(dest, { recursive: true })
  })

  const child = execa('node', [
    cliPath, 'composer', 'create',
    '--dir', dest,
    '--install', 'false'
  ])
  await child

  // check file structure
  const files = ['.env', '.env.sample', '.gitignore', 'README.md', 'global.d.ts', 'package.json', 'platformatic.json']
  const dirs = ['plugins', 'routes', 'test']

  const dirContents = await readdir(dest)
  for (const file of dirContents) {
    const fileStat = await stat(join(dest, file))
    if (fileStat.isDirectory()) {
      assert.ok(dirs.includes(file), `Directory ${file} is expected`)
    }

    if (fileStat.isFile()) {
      assert.ok(files.includes(file), `File ${file} is expected`)
    }
  }
})
