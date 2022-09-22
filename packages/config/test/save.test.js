'use strict'

const { test } = require('tap')
const ConfigManager = require('..')
const { saveConfigToFile } = require('./helper')
const { readFile, unlink } = require('fs/promises')
const YAML = require('yaml')
const TOML = require('@iarna/toml')
test('should not save invalid config', async ({ equal, fail, pass, same, teardown }) => {
  const invalidConfig = {
    name: ['Platformatic'],
    props: {
      foo: 123
    }
  }
  const schema = {
    type: 'object',
    properties: {
      name: { type: 'string' },
      props: {
        type: 'object',
        properties: {
          foo: { type: 'string' }
        }
      }
    }
  }

  const file = await saveConfigToFile(invalidConfig, 'invalid.json')
  teardown(async () => await unlink(file))
  const cm = new ConfigManager({
    source: file,
    schema,
    schemaOptions: {
      allErrors: true
    }
  })
  const res = await cm.parse()
  equal(res, false)
  same(cm.validationErrors, [
    { path: '/name', message: 'must be string {"type":"string"}' },
    { path: '/props/foo', message: 'must be string {"type":"string"}' }
  ])
})
test('should not replace placeholders in file', async ({ equal, same, teardown }) => {
  const config = {
    name: 'Platformatic',
    props: {
      foo: '{PLT_FOO}'
    }
  }
  const schema = {
    type: 'object',
    properties: {
      name: { type: 'string' },
      props: {
        type: 'object',
        properties: {
          foo: { type: 'string' }
        }
      }
    }
  }

  const file = await saveConfigToFile(config, 'no-placeholder-replacement.json')
  teardown(async () => await unlink(file))
  const cm = new ConfigManager({
    source: file,
    schema,
    env: { PLT_FOO: 'foobar' }
  })
  const res = await cm.parse()
  equal(res, true)
  same(cm.validationErrors, [])
  const configData = JSON.parse(await readFile(file))
  same(configData, {
    name: 'Platformatic',
    props: {
      foo: '{PLT_FOO}'
    }
  })
  same(cm.current, {
    name: 'Platformatic',
    props: {
      foo: 'foobar'
    }
  })
})
test('should save valid config and replace current one', async ({ same, teardown }) => {
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
  await cm.parse()
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
  same(configData, cm.current)
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

test('should support YAML format', async ({ same, teardown }) => {
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

  const file = await saveConfigToFile(config, 'to-replace.yaml', YAML)
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
      bar: 42
    }
  }
  await cm.update(newConfig)
  same(cm.current, newConfig)
  const configData = YAML.parse(await readFile(file, 'utf-8'))
  same(configData, cm.current)
})

test('should support TOML format', async ({ same, teardown }) => {
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

  const file = await saveConfigToFile(config, 'to-replace.toml', TOML)
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
      bar: 42
    }
  }
  await cm.update(newConfig)
  same(cm.current, newConfig)
  const configData = TOML.parse(await readFile(file, 'utf-8'))
  same(configData, cm.current)
})

test('should keep history of configs', { skip: true }, async ({ equal, plan }) => {
  // TODO: implement this if we want to keep history of configs in running instance
})

test('should not save if not parsed', async ({ equal, fail, pass, same, teardown }) => {
  const invalidConfig = {
    name: ['Platformatic'],
    props: {
      foo: '123'
    }
  }
  const schema = {
    type: 'object',
    properties: {
      name: { type: 'string' },
      props: {
        type: 'object',
        properties: {
          foo: { type: 'string' }
        }
      }
    }
  }

  const file = await saveConfigToFile(invalidConfig, 'not-parsed.json')
  teardown(async () => await unlink(file))
  const cm = new ConfigManager({
    source: file,
    schema,
    schemaOptions: {
      allErrors: true
    }
  })
  equal(await cm.save(), false)
})

test('should save if initialized with object', async ({ same, teardown }) => {
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

  const cm = new ConfigManager({
    source: config,
    schema,
    env: { PLT_FOO: 'foobar' }
  })
  teardown(async () => await unlink(cm.fullPath))
  await cm.parse()
  const newConfig = {
    name: 'Platformatic',
    props: {
      foo: 'foobar',
      bar: 42
    }
  }
  await cm.update(newConfig)
  same(cm.current, newConfig)
  const configData = JSON.parse(await readFile(cm.fullPath))
  same(configData, cm.current)
})
