'use strict'

const { test } = require('tap')
const Fastify = require('fastify')
const ConfigManager = require('..')
const { saveConfigToFile } = require('./helper')
const { unlink } = require('fs/promises')

test('should generate fastify plugin', async ({ teardown, same, equal }) => {
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
  teardown(async () => { await unlink(file) })
  teardown(app.close)

  {
    // Read config file
    const res = await app.inject({
      method: 'GET',
      url: '/config-file'
    })
    equal(res.statusCode, 200)
    same(res.json(), {
      foo: 'bar'
    })
  }
})
