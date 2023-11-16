'use strict'

const { test } = require('node:test')
const { tspl } = require('@matteo.collina/tspl')
const { isFileAccessible } = require('..')
const { basename } = require('node:path')

test('isFileAccessible', async (t) => {
  const { deepEqual } = tspl(t, { plan: 4 })
  {
    // single filename
    const file = basename(__filename)
    deepEqual(await isFileAccessible(file, __dirname), true)
    deepEqual(await isFileAccessible('impossible.file', __dirname), false)
  }

  {
    // full path
    const file = __filename
    deepEqual(await isFileAccessible(file), true)
    deepEqual(await isFileAccessible('/impossible/path/impossible.file'), false)
  }
})
