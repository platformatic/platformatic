'use strict'

const assert = require('node:assert/strict')
const { test } = require('node:test')
const { join } = require('node:path')
const { readFile } = require('node:fs/promises')

const { cliPath } = require('./helper.js')

test('version', async (t) => {
  const { execa } = await import('execa')
  const { stdout } = await execa('node', [cliPath, '--version'])

  const version = JSON.parse(await readFile(join(__dirname, '..', '..', 'package.json'))).version
  assert.ok(stdout.includes('v' + version))
})
