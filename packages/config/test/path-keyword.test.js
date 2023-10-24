'use strict'

const assert = require('node:assert/strict')
const { test } = require('node:test')
const { join, isAbsolute } = require('node:path')
const ConfigManager = require('..')

test('do not emit event for not allowed files', async (t) => {
  const configFile = join(__dirname, 'fixtures', 'onepath.json')
  const cm = new ConfigManager({
    source: configFile,
    schema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          resolvePath: true
        }
      }
    }
  })

  const parseResult = await cm.parse()
  assert.equal(parseResult, true)

  assert.equal(isAbsolute(cm.current.path), true)
})

test('do not emit event for empty paths', async (t) => {
  const cm = new ConfigManager({
    source: { path: '' },
    schema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          resolvePath: true
        }
      }
    }
  })

  const parseResult = await cm.parse()
  assert.equal(parseResult, false)
})

test('resolveModule', async (t) => {
  const configFile = join(__dirname, 'fixtures', 'onepath.json')
  const cm = new ConfigManager({
    source: configFile,
    schema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          resolveModule: true
        }
      }
    }
  })

  const parseResult = await cm.parse()
  assert.equal(parseResult, true)

  assert.equal(isAbsolute(cm.current.path), true)
})

test('resolveModule /2', async (t) => {
  const configFile = join(__dirname, 'fixtures', 'module.json')
  const cm = new ConfigManager({
    source: configFile,
    schema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          resolveModule: true
        }
      }
    }
  })

  const parseResult = await cm.parse()
  assert.equal(parseResult, true)
  assert.equal(isAbsolute(cm.current.path), true)
})

test('resolveModule / 3', async (t) => {
  const cm = new ConfigManager({
    source: { path: '' },
    schema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          resolveModule: true
        }
      }
    }
  })

  const parseResult = await cm.parse()
  assert.equal(parseResult, false)
})

test('resolveModule / 3', async (t) => {
  const cm = new ConfigManager({
    source: { path: 'foobar' },
    schema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          resolveModule: true
        }
      }
    }
  })

  const parseResult = await cm.parse()
  assert.equal(parseResult, false)
})
