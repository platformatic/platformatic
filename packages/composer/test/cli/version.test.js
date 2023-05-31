'use strict'

const { join } = require('path')
const { readFile } = require('fs/promises')

const { test } = require('tap')
const { cliPath } = require('./helper.js')

test('version', async (t) => {
  const { execa } = await import('execa')
  const { stdout } = await execa('node', [cliPath, '--version'])

  const version = JSON.parse(await readFile(join(__dirname, '..', '..', 'package.json'))).version
  t.ok(stdout.includes('v' + version))
})
