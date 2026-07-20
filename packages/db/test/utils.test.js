import assert from 'node:assert/strict'
import os from 'node:os'
import { test } from 'node:test'
import { isSchemaLockReadOnly, urlDirname } from '../lib/utils.js'

const isWindows = os.platform() === 'win32'

test('urlDirname', t => {
  let filePath
  if (isWindows) {
    filePath = 'file://C:\\Users\\matteo\\path\\to\\file.json'
    assert.equal(urlDirname(filePath), 'C:\\Users\\matteo\\path\\to')
  } else {
    filePath = 'file:///path/to/file.json'
    assert.equal(urlDirname(filePath), '/path/to')
  }
})

test('isSchemaLockReadOnly accepts boolean and string configuration', () => {
  assert.equal(isSchemaLockReadOnly({ db: { schemalock: { readOnly: true } } }), true)
  assert.equal(isSchemaLockReadOnly({ db: { schemalock: { readOnly: 'true' } } }), true)
  assert.equal(isSchemaLockReadOnly({ db: { schemalock: { readOnly: false } } }), false)
  assert.equal(isSchemaLockReadOnly({ db: { schemalock: { readOnly: 'false' } } }), false)
})
