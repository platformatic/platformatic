'use strict'

const assert = require('node:assert/strict')
const { test } = require('node:test')
const { unlink } = require('node:fs/promises')
const Fastify = require('fastify')
const ConfigManager = require('..')
const { saveConfigToFile } = require('./helper')

test('should generate fastify plugin', async (t) => {
  const config = {
    foo: 'bar'
  }
  const schema = {
    type: 'object',
    properties: {
      foo: { type: 'string' },
      bar: { type: 'string' }
    }
  }
  const file = await saveConfigToFile(config, 'plugin.json')

  const cm = new ConfigManager({
    source: file,
    schema
  })
  await cm.parse()
  const app = Fastify({
    logger: false
  })
  app.register(cm.toFastifyPlugin())

  await app.listen({ port: 0 })
  t.after(async () => { await unlink(file) })
  t.after(async () => { await app.close() })

  {
    // Read config file
    const res = await app.inject({
      method: 'GET',
      url: '/config-file'
    })
    assert.equal(res.statusCode, 200)
    assert.deepEqual(res.json(), {
      foo: 'bar'
    })
  }
})
