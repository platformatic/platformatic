'use strict'

const { test } = require('node:test')
const { equal, deepEqual, notDeepEqual } = require('node:assert')
const { analyze } = require('..')
const { join } = require('path')
const { readFile } = require('fs').promises

test('up to 19 (db)', async () => {
  const file = join(__dirname, 'fixtures', 'v0.18.0', 'db.json')
  const meta = await analyze({ file })
  equal(meta.version, '0.18.0')
  equal(meta.kind, 'db')
  deepEqual(meta.config, JSON.parse(await readFile(file)))
  equal(meta.path, file)
  equal(meta.format, 'json')

  const meta18 = meta.up()
  equal(meta18.version, '0.19.0')
  equal(meta18.kind, 'db')
  equal(meta18.config.$schema, 'https://platformatic.dev/schemas/v0.19.0/db')
  equal(meta18.format, 'json')

  notDeepEqual(meta.config, meta18.config)

  deepEqual(meta18.config.db, meta.config.db)

  {
    const meta18FromScratch = await analyze({ config: meta18.config })
    equal(meta18FromScratch.version, '0.19.0')
    equal(meta18FromScratch.kind, 'db')
    equal(meta18FromScratch.path, undefined)
    equal(meta18FromScratch.format, 'json')
  }
})

test('up to 19 (service)', async () => {
  const file = join(__dirname, 'fixtures', 'v0.18.0', 'service.json')
  const meta = await analyze({ file })
  equal(meta.version, '0.18.0')
  equal(meta.kind, 'service')
  deepEqual(meta.config, JSON.parse(await readFile(file)))
  equal(meta.path, file)
  equal(meta.format, 'json')

  const meta18 = meta.up()
  equal(meta18.version, '0.19.0')
  equal(meta18.kind, 'service')
  equal(meta18.config.$schema, 'https://platformatic.dev/schemas/v0.19.0/service')
  equal(meta18.format, 'json')

  notDeepEqual(meta.config, meta18.config)

  {
    const meta18FromScratch = await analyze({ config: meta18.config })
    equal(meta18FromScratch.version, '0.19.0')
    equal(meta18FromScratch.kind, 'service')
    equal(meta18FromScratch.path, undefined)
    equal(meta18FromScratch.format, 'json')
  }
})
