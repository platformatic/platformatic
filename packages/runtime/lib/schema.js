#! /usr/bin/env node
'use strict'

const { schemaComponents } = require('@platformatic/utils')

const pkg = require('../package.json')

const platformaticRuntimeSchema = {
  $id: `https://schemas.platformatic.dev/@platformatic/runtime/${pkg.version}.json`,
  $schema: 'http://json-schema.org/draft-07/schema#',
  type: 'object',
  properties: schemaComponents.runtimeProperties,
  anyOf: [{ required: ['autoload'] }, { required: ['services'] }, { required: ['web'] }],
  additionalProperties: false
}

module.exports.schema = platformaticRuntimeSchema

if (require.main === module) {
  console.log(JSON.stringify(platformaticRuntimeSchema, null, 2))
}
