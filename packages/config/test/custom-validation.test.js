'use strict'

const assert = require('node:assert/strict')
const { test } = require('node:test')
const ConfigManager = require('..')

test('should validate successfully with ajv typeof custom keyword', async (t) => {
  const cm = new ConfigManager({
    source: { test: () => {} },
    schema: {
      type: 'object',
      properties: {
        test: {
          typeof: 'function'
        }
      }
    }
  })

  const parseResult = await cm.parse()
  assert.equal(parseResult, true)
})

test('should get error with ajv typeof custom keyword', async (t) => {
  const cm = new ConfigManager({
    source: { test: 'not-a-regexp' },
    schema: {
      type: 'object',
      properties: {
        test: {
          typeof: 'RegExp'
        }
      }
    }
  })

  const parseResult = await cm.parse()
  assert.equal(parseResult, false)
})
