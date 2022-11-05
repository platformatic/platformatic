'use strict'

const { test } = require('tap')
const { createServerConfig } = require('..')

test('createServerConfig', async (t) => {
  const data = createServerConfig({ server: { foo: 'bar' }, something: 'else' })
  t.same(data, {
    foo: 'bar',
    something: 'else'
  })
})
