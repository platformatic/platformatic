'use strict'

const { readFileSync } = require('node:fs')
const { join } = require('node:path')

const schema = JSON.parse(readFileSync(join(__dirname, 'stackable.schema.json')))

function foo () {
}

// This is different from the schema version in stackable.schema.json
// and it's fundamental to the test
schema.version = '1.0.0'
foo.schema = schema

foo.configType = 'foo'
foo.configManagerConfig = {
  schema: foo.schema,
  envWhitelist: ['PORT', 'HOSTNAME'],
  allowToWatch: ['.env'],
  schemaOptions: {
    useDefaults: true,
    coerceTypes: true,
    allErrors: true,
    strict: false
  },
  upgrade (config, originalVersion) {
    return {
      ...config,
      originalVersion
    }
  }
}

module.exports = foo
