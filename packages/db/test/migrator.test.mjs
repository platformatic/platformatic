'use strict'

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { Migrator } from '../lib/migrator.mjs'

test('throws if connection string is invalid', async (t) => {
  const migrator = new Migrator({}, {
    connectionString: 'unknownDb://mydb:1234/db'
  })
  try {
    await migrator.setupPostgrator()
  } catch (err) {
    assert.equal(err.code, 'PLT_SQL_MAPPER_SPECIFY_PROTOCOLS')
    assert.equal(err.message, 'You must specify either postgres, mysql or sqlite as protocols')
  }
})
