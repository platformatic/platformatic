'use strict'

const { test } = require('tap')
const ConfigManager = require('..')
const { saveConfigToFile } = require('./helper')
const { readFile, unlink } = require('fs/promises')

test('should update valid config without updating the file', async ({ same, teardown, pass, plan }) => {
  plan(5)
  const config = {
    name: 'Platformatic',
    props: {
      foo: 'bar'
    }
  }
  const schema = {
    type: 'object',
    properties: {
      name: { type: 'string' },
      props: {
        type: 'object',
        properties: {
          foo: { type: 'string' },
          bar: { type: 'integer' }
        }
      }
    }
  }

  const file = await saveConfigToFile(config, 'to-replace.json')
  teardown(async () => await unlink(file))
  const cm = new ConfigManager({
    source: file,
    schema,
    env: { PLT_FOO: 'foobar' }
  })
  cm._transformConfig = (config) => {
    pass('transform config')
  }
  cm.on('update', () => {
    pass('new config available')
  })
  await cm.parse()
  const original = cm.current
  const newConfig = {
    name: 'Platformatic',
    props: {
      foo: 'foobar',
      bar: 42
    }
  }
  await cm.update(newConfig)
  same(cm.current, newConfig)
  const configData = JSON.parse(await readFile(file))
  same(configData, original)
})

test('should not update with invalid config', async ({ same, teardown }) => {
  const config = {
    name: 'Platformatic',
    props: {
      foo: 'bar'
    }
  }
  const schema = {
    type: 'object',
    properties: {
      name: { type: 'string' },
      props: {
        type: 'object',
        properties: {
          foo: { type: 'string' },
          bar: { type: 'integer' }
        }
      }
    }
  }

  const file = await saveConfigToFile(config, 'do-not-update.json')
  teardown(async () => await unlink(file))
  const cm = new ConfigManager({
    source: file,
    schema,
    env: { PLT_FOO: 'foobar' }
  })
  await cm.parse()
  const newConfig = {
    name: 'Platformatic',
    props: {
      foo: 'foobar',
      bar: '42'
    }
  }
  const updateRes = await cm.update(newConfig)
  same(updateRes, false)
  same(cm.current, config)
  const configData = JSON.parse(await readFile(file))
  same(configData, config)
})
