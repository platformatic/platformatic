'use strict'

const { test } = require('node:test')
const { deepEqual } = require('node:assert')
const { createServerConfig } = require('..')

test('createServerConfig', async (t) => {
  const data = createServerConfig({ server: { foo: 'bar' }, something: 'else' })
  deepEqual(data, {
    foo: 'bar',
    something: 'else'
  })
})
