'use strict'

import assert from 'node:assert'
import { resolve } from 'node:path'
import { test } from 'node:test'
import { createRuntime, setFixturesDir } from '../../basic/test/helper.js'

process.setMaxListeners(100)

setFixturesDir(resolve(import.meta.dirname, './fixtures'))

test('should allow to setup connection string', async t => {
  const { runtime } = await createRuntime(t, 'node-set-connection-string')
  const meta = await runtime.getServiceMeta('api')
  // console.log('@@@@@@@@@@@@@@@', meta)
  // console.log('@@@@@@@@@@@@@@@', runtime.openapiSchema)
  assert.strictEqual(meta.db.connectionStrings[0], 'xxx')
})
