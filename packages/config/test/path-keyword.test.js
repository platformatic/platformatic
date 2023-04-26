'use strict'

const { test } = require('tap')
const ConfigManager = require('..')
const path = require('path')

test('do not emit event for not allowed files', async ({ equal }) => {
  const configFile = path.join(__dirname, 'fixtures', 'onepath.json')
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
  equal(parseResult, true)

  equal(path.isAbsolute(cm.current.path), true)
})

test('do not emit event for empty paths', async ({ equal }) => {
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
  equal(parseResult, false)
})
