'use strict'

const { test } = require('node:test')
const { join } = require('node:path')
const { rejects } = require('node:assert')
const { analyze } = require('..')

test('throws if config has a module property', async () => {
  const file = join(__dirname, 'fixtures', 'stackable', 'platformatic.custom.json')
  await rejects(analyze({ file }), {
    message: 'module property exists in the config file'
  })
})
