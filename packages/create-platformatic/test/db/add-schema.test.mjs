'use strict'

import { test, beforeEach, afterEach } from 'tap'
import { mkdtemp, rmdir, readFile } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import { addSchemaToConfig } from '../../src/db/add-schema.mjs'
import createDB from '../../src/db/create-db.mjs'

let log = []
let tmpDir
const fakeLogger = {
  info: msg => { log.push(msg) }
}

beforeEach(async () => {
  log = []
  tmpDir = await mkdtemp(join(tmpdir(), 'test-create-platformatic-'))
})

afterEach(async () => {
  await rmdir(tmpDir, { recursive: true, force: true })
})

test('creates db schema', async ({ end, equal, ok, notOk }) => {
  const params = {
    hostname: 'myhost',
    port: 6666,
    plugin: false
  }
  await createDB(params, fakeLogger, tmpDir)
  const configPath = join(tmpDir, 'platformatic.db.json')
  const configBefore = JSON.parse(await readFile(configPath, 'utf8'))
  notOk(configBefore.$schema)
  await addSchemaToConfig(fakeLogger, tmpDir)
  const configAfter = JSON.parse(await readFile(configPath, 'utf8'))
  ok(configAfter.$schema)
})
