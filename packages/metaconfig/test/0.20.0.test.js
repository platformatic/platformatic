'use strict'

const { test } = require('tap')
const { analyze } = require('..')
const { join } = require('path')
const { readFile } = require('fs').promises

test('up to 21 (db)', async (t) => {
  const file = join(__dirname, 'fixtures', 'v0.20.0', 'db.json')
  const meta = await analyze({ file })
  t.equal(meta.version, '0.20.0')
  t.equal(meta.kind, 'db')
  t.same(meta.config, JSON.parse(await readFile(file)))
  t.equal(meta.path, file)
  t.equal(meta.format, 'json')

  const meta18 = meta.up()
  t.equal(meta18.version, '0.21.0')
  t.equal(meta18.kind, 'db')
  t.equal(meta18.config.$schema, 'https://platformatic.dev/schemas/v0.21.0/db')
  t.equal(meta18.format, 'json')

  t.notSame(meta.config, meta18.config)

  t.same(meta18.config.db, meta.config.db)

  {
    const meta18FromScratch = await analyze({ config: meta18.config })
    t.equal(meta18FromScratch.version, '0.21.0')
    t.equal(meta18FromScratch.kind, 'db')
    t.equal(meta18FromScratch.path, undefined)
    t.equal(meta18FromScratch.format, 'json')
  }
})

test('up to 21 (service)', async (t) => {
  const file = join(__dirname, 'fixtures', 'v0.20.0', 'service.json')
  const meta = await analyze({ file })
  t.equal(meta.version, '0.20.0')
  t.equal(meta.kind, 'service')
  t.same(meta.config, JSON.parse(await readFile(file)))
  t.equal(meta.path, file)
  t.equal(meta.format, 'json')

  const meta18 = meta.up()
  t.equal(meta18.version, '0.21.0')
  t.equal(meta18.kind, 'service')
  t.equal(meta18.config.$schema, 'https://platformatic.dev/schemas/v0.21.0/service')
  t.equal(meta18.format, 'json')

  t.notSame(meta.config, meta18.config)

  {
    const meta18FromScratch = await analyze({ config: meta18.config })
    t.equal(meta18FromScratch.version, '0.21.0')
    t.equal(meta18FromScratch.kind, 'service')
    t.equal(meta18FromScratch.path, undefined)
    t.equal(meta18FromScratch.format, 'json')
  }
})
