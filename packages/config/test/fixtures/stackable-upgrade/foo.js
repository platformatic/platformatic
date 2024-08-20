'use strict'

const { readFileSync } = require('node:fs')
const { join } = require('node:path')

const schema = JSON.parse(readFileSync(join(__dirname, 'stackable.schema.json'), 'utf-8'))

function foo () {
}

foo.schema = schema

foo.configType = 'foo'
foo.configManagerConfig = {
  schema: foo.schema,
  version: '1.0.0',
  allowToWatch: ['.env'],
  schemaOptions: {
    useDefaults: true,
    coerceTypes: true,
    allErrors: true,
    strict: false,
  },
  upgrade (config, originalVersion) {
    this.logger.child({}).info('bar')
    return {
      ...config,
      originalVersion,
    }
  },
}

module.exports = foo
