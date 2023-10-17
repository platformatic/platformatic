'use strict'

const assert = require('node:assert/strict')
const { test } = require('node:test')
const { readFile, unlink } = require('node:fs/promises')
const ConfigManager = require('..')
const { saveConfigToFile } = require('./helper')

test('should update valid config without updating the file', async (t) => {
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
  t.after(async () => await unlink(file))
  const cm = new ConfigManager({
    source: file,
    schema,
    env: { PLT_FOO: 'foobar' }
  })
  let isConfigTransformed = false
  cm._transformConfig = (config) => {
    isConfigTransformed = true
  }
  let isConfigUpdated = false
  cm.on('update', () => {
    isConfigUpdated = true
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
  assert.deepEqual(cm.current, newConfig)
  const configData = JSON.parse(await readFile(file))
  assert.deepEqual(configData, original)

  assert.equal(isConfigTransformed, true)
  assert.equal(isConfigUpdated, true)
})

test('should not update with invalid config', async (t) => {
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
  t.after(async () => await unlink(file))
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
  assert.deepEqual(updateRes, false)
  assert.deepEqual(cm.current, config)
  const configData = JSON.parse(await readFile(file))
  assert.deepEqual(configData, config)
})
