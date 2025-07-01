'use strict'

const assert = require('node:assert/strict')
const { join } = require('node:path')
const { test } = require('node:test')
const { getConnectionInfo } = require('../helper.js')
const { startPath } = require('./helper.js')

test('missing config', async t => {
  const { execa } = await import('execa')
  await assert.rejects(execa('node', [startPath]))
})

test('print validation errors', async t => {
  const { execa } = await import('execa')
  const { connectionInfo, dropTestDB } = await getConnectionInfo('postgresql')
  t.after(async () => {
    await dropTestDB()
  })

  try {
    await execa('node', [startPath, join(__dirname, '..', 'fixtures', 'missing-required-values.json')], {
      env: {
        DATABASE_URL: connectionInfo.connectionString
      }
    })
    assert.fail('should have thrown')
  } catch (err) {
    assert.equal(err.exitCode, 1)
    assert.equal(err.stderr.includes('must have required property \'dir\' {"missingProperty":"dir"}'), true)
  }
})
