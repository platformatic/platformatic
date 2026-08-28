#! /usr/bin/env node

import { schemaComponents } from '@platformatic/foundation/lib/schema.js'
import { version } from './version.js'

const runtimeLogger = {
  ...schemaComponents.runtimeProperties.logger,
  properties: {
    ...schemaComponents.runtimeProperties.logger.properties,
    captureStdio: {
      type: 'boolean',
      default: true
    },
    pino: {
      type: 'object',
      default: {},
      properties: {
        level: {
          type: 'string',
          default: 'level'
        },
        time: {
          type: 'string',
          default: 'time'
        },
        message: {
          type: 'string',
          default: 'msg'
        }
      },
      additionalProperties: false
    }
  }
}

/*
  The root logger is not the application one: it carries `captureStdio` and the `pino` key mapping,
  which only the runtime reads. Naming them apart is what lets a person write the type of either.
*/
runtimeLogger.title = 'RuntimeLoggerOptions'

schemaComponents.runtimeProperties.logger = runtimeLogger

schemaComponents.runtimeProperties.verticalScaler.properties.applications = {
  type: 'object',
  additionalProperties: {
    type: 'object',
    properties: {
      minWorkers: { type: 'number', minimum: 1 },
      maxWorkers: { type: 'number', minimum: 1 },
      scaleUpELU: { type: 'number', minimum: 0, maximum: 1 },
      scaleDownELU: { type: 'number', minimum: 0, maximum: 1 }
    },
    additionalProperties: false
  }
}

const platformaticRuntimeSchema = {
  $id: `https://schemas.platformatic.dev/@platformatic/runtime/${version}.json`,
  $schema: 'http://json-schema.org/draft-07/schema#',
  title: 'Platformatic Runtime Config',
  type: 'object',
  properties: {
    ...schemaComponents.runtimeProperties,
    module: {
      type: 'string'
    }
  },
  anyOf: [
    { required: ['autoload'] },
    { required: ['applications'] },
    { required: ['services'] },
    { required: ['web'] }
  ],
  additionalProperties: false
}

export const schema = platformaticRuntimeSchema

/*
  The keys v4 does not implement. Validating a v4 configuration against the v3 schema accepted them
  and then ignored them, which is the worst of both: `envfile: './deploy.env'` at the root looked
  like it was doing something. They survive on the v3 schema, which still serves v3 projects, and
  inside migrate's legacy reader.

  Root `envfile` is removed, not renamed — an entry may still declare one, and that property lives
  on the application schema rather than here.

  `$schema` is different in kind: machine writers of the plain-object form still stamp it, and the
  loader reads it for version detection and strips it before validation. The schema refusing it is
  what makes the strip load-bearing rather than decorative — a stamp that reached AJV would mean the
  loader had skipped the step that checks the file is not a v3 one.
*/
const removedInV4 = ['envfile', 'strictEnv', '$schema']

const { ...v4Properties } = platformaticRuntimeSchema.properties

for (const key of removedInV4) {
  delete v4Properties[key]
}

export const v4Schema = {
  ...platformaticRuntimeSchema,
  $id: `https://schemas.platformatic.dev/@platformatic/runtime/${version}-v4.json`,
  properties: v4Properties
}

if (import.meta.main) {
  console.log(JSON.stringify(platformaticRuntimeSchema, null, 2))
}
