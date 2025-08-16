#! /usr/bin/env node
'use strict'

const { schemaComponents } = require('@platformatic/foundation')

const pkg = require('../package.json')

const runtimeLogger = {
  ...schemaComponents.runtimeProperties.logger,
  properties: {
    ...schemaComponents.runtimeProperties.logger.properties,
    captureStdio: {
      type: 'boolean',
      default: true
    }
  }
}

schemaComponents.runtimeProperties.logger = runtimeLogger

const platformaticRuntimeSchema = {
  $id: `https://schemas.platformatic.dev/@platformatic/runtime/${pkg.version}.json`,
  $schema: 'http://json-schema.org/draft-07/schema#',
  title: 'Platformatic Runtime Config',
  type: 'object',
  properties: schemaComponents.runtimeProperties,
  anyOf: [{ required: ['autoload'] }, { required: ['services'] }, { required: ['web'] }],
  additionalProperties: false
}

module.exports.schema = platformaticRuntimeSchema

if (require.main === module) {
  console.log(JSON.stringify(platformaticRuntimeSchema, null, 2))
}
