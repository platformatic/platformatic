#! /usr/bin/env node

import { schemaComponents } from '@platformatic/foundation'
import { version } from './version.js'

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

schemaComponents.runtimeProperties.verticalScaler.properties.applications = {
 type: 'object',
 additionalProperties: {
   type: 'object',
   properties: {
     minWorkers: { type: 'number', minimum: 1 },
     maxWorkers: { type: 'number', minimum: 1 }
   },
   additionalProperties: false
 }
}

const platformaticRuntimeSchema = {
  $id: `https://schemas.platformatic.dev/@platformatic/runtime/${version}.json`,
  $schema: 'http://json-schema.org/draft-07/schema#',
  title: 'Platformatic Runtime Config',
  type: 'object',
  properties: schemaComponents.runtimeProperties,
  anyOf: [
    { required: ['autoload'] },
    { required: ['applications'] },
    { required: ['services'] },
    { required: ['web'] }
  ],
  additionalProperties: false
}

export const schema = platformaticRuntimeSchema

if (import.meta.main) {
  console.log(JSON.stringify(platformaticRuntimeSchema, null, 2))
}
