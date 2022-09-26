import { test } from 'tap'
import path from 'path'
import pino from 'pino'
import split from 'split2'
import sqlite from '@databases/sqlite'
import { execute } from '../../lib/migrator.mjs'
import ConfigManager from '../../lib/config.js'
import { cleanSQLite } from './helper.mjs'
import { urlDirname } from '../../lib/utils'

function join (url, ...str) {
  return path.join(urlDirname(url), ...str)
}

const dbLocation = join(import.meta.url, '..', '..', 'fixtures', 'sqlite', 'db')
const configFileLocation = join(import.meta.url, '..', '..', 'fixtures', 'sqlite', 'platformatic.db.json')

test('migrate and start', async ({ comment, equal, match, teardown }) => {
  const cm = new ConfigManager({
    source: configFileLocation
  })
  await cm.parse()
  const config = cm.current
  await cleanSQLite(dbLocation)

  const lines = []
  const logger = pino(split((line) => {
    lines.push(JSON.parse(line))
  }))

  await execute(logger, {}, config)

  equal(lines.length, 1)
  match(lines[0].msg, /001\.do\.sql/)
})

test('migrate twice', async ({ comment, equal, match, teardown }) => {
  const cm = new ConfigManager({
    source: configFileLocation
  })
  await cm.parse()
  const config = cm.current

  await cleanSQLite(dbLocation)

  let lines = []
  const logger = pino(split((line) => {
    lines.push(JSON.parse(line))
  }))

  await execute(logger, { }, config)

  equal(lines.length, 1)
  match(lines[0].msg, /001\.do\.sql/)

  lines = []

  await execute(logger, { config: configFileLocation }, config)

  equal(lines.length, 0)
})

test('apply defaults', async ({ comment, equal, match, teardown }) => {
  const configFileLocation = join(import.meta.url, '..', 'fixtures', 'sqlite', 'no-table.json')
  const dbLocation = join(import.meta.url, '..', 'fixtures', 'sqlite', 'db')
  const cm = new ConfigManager({
    source: configFileLocation
  })
  await cm.parse()
  const config = cm.current
  await cleanSQLite(dbLocation)

  const lines = []
  const logger = pino(split((line) => {
    lines.push(JSON.parse(line))
  }))

  await execute(logger, {}, config)

  equal(lines.length, 1)
  match(lines[0].msg, /001\.do\.sql/)

  const db = sqlite(dbLocation)

  const tables = await db.query(sqlite.sql`
    SELECT name FROM sqlite_master
    WHERE type='table'
  `)

  match(tables, [{
    name: 'versions'
  }, {
    name: 'graphs'
  }])

  await db.dispose()
})

test('Version table is ignored but migrations fail to run', async (t) => {
  const dbLocation = join(import.meta.url, '..', 'fixtures', 'sqlite', 'db')
  const configFileLocation = join(import.meta.url, '..', 'fixtures', 'sqlite', 'ignore.json')

  await cleanSQLite(dbLocation)

  const cm = new ConfigManager({
    source: configFileLocation
  })
  await cm.parse()
  const config = cm.current

  const lines = []
  const logger = pino(split((line) => {
    lines.push(JSON.parse(line))
  }))

  await execute(logger, {}, config)
})
