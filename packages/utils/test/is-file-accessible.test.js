'use strict'

const { test } = require('tap')
const { isFileAccessible } = require('..')
const { basename } = require('node:path')

test('isFileAccessible', async ({ same, plan }) => {
  plan(4)
  {
    // single filename
    const file = basename(__filename)
    same(await isFileAccessible(file, __dirname), true)
    same(await isFileAccessible('impossible.file', __dirname), false)
  }

  {
    // full path
    const file = __filename
    same(await isFileAccessible(file), true)
    same(await isFileAccessible('/impossible/path/impossible.file'), false)
  }
})
