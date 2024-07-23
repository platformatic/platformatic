'use strict'

const { test } = require('node:test')
const assert = require('node:assert')
const os = require('node:os')

const tmpDir = os.tmpdir()
const cwd = process.cwd()

const { getTSCExecutablePath, getGlobalTSCExecutablePath } = require('../lib/tsc-executable.js')

test('getTSCExecutablePath', async () => {
  const tscPath = await getTSCExecutablePath(__dirname)
  assert.strictEqual(typeof tscPath, 'string')
})

test('there is no such thing as global typescript (tmp dir)', async (t) => {
  process.chdir(tmpDir)
  t.after(() => {
    process.chdir(cwd)
  })

  const path = await getGlobalTSCExecutablePath()
  assert.strictEqual(path, undefined)
})

test('there is no such thing as global typescript (current folder)', async (t) => {
  process.chdir(__dirname)
  t.after(() => {
    process.chdir(cwd)
  })

  const path = await getGlobalTSCExecutablePath()
  assert.strictEqual(typeof path, 'string')
})

test('getTSCExecutablePath tmp folder', async (t) => {
  process.chdir(tmpDir)
  t.after(() => {
    process.chdir(cwd)
  })
  const tscPath = await getTSCExecutablePath(tmpDir)
  assert.strictEqual(tscPath, undefined)
})
