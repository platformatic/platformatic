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

  `verticalScaler` is the deprecated spelling of `workers`, kept on the v3 schema with a transform
  that migrates it. v4 has one spelling: a configuration that still says `verticalScaler` is told
  so by the schema rather than being quietly rewritten, which is the only way the two cannot
  disagree about which of them a project meant.

  `services` and `web` are the same story: v3's spellings of `applications`, folded by the shared
  transform. Alone they fail the pipeline's topology check by name; beside an `applications` key
  they would validate and be folded silently, so the schema refuses them instead.
*/
const removedInV4 = ['envfile', 'strictEnv', '$schema', 'verticalScaler', 'services', 'web']

const { ...v4Properties } = platformaticRuntimeSchema.properties

for (const key of removedInV4) {
  delete v4Properties[key]
}

/*
  v3's entry anyOf required an id beside the path or url, because v3 derived ids only for
  autoloaded applications. v4 derives them at every position -- explicit entries included, from the
  package name and then the directory -- so requiring one would refuse an entry the loader handles.
  What a v4 entry genuinely needs is a place: a path or a url.

  Copied rather than edited, because `applications.items` is shared with the v3 schema, where the
  requirement still holds.
*/
const v4EntryItems = {
  ...v4Properties.applications.items,
  anyOf: [{ required: ['path'] }, { required: ['url'] }]
}

v4Properties.applications = { ...v4Properties.applications, items: v4EntryItems }

/*
  The singular shorthand: one application with runtime options, Level 1b. It is an application
  entry whose identity and place the loader both supply -- the id derives from the package name
  and the path defaults to the configuration file's own directory -- so it keeps the entry's
  properties and drops the anyOf entirely.
*/
const { anyOf: _entryRequirements, ...applicationShorthand } = v4EntryItems

v4Properties.application = applicationShorthand

export const v4Schema = {
  ...platformaticRuntimeSchema,
  $id: `https://schemas.platformatic.dev/@platformatic/runtime/${version}-v4.json`,
  properties: v4Properties,
  /*
    The v3 anyOf listed the removed spellings, and it is decorative on the v4 path anyway -- by the
    time either validation pass runs, normalization has already defaulted `applications`. The gate
    that actually asks the question is the pipeline's topology check, before that default; this
    matches it so the schema and the loader tell the same story.
  */
  anyOf: [{ required: ['autoload'] }, { required: ['applications'] }, { required: ['application'] }]
}

if (import.meta.main) {
  console.log(JSON.stringify(platformaticRuntimeSchema, null, 2))
}
