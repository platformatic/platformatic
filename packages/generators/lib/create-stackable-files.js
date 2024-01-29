'use strict'

const JS_STACKABLE_INDEX_FILE = `\
'use strict'

const { platformaticService } = require('@platformatic/service')
const { schema } = require('./lib/schema')
const { Generator } = require('./lib/generator')

async function stackable (fastify, opts) {
  await fastify.register(platformaticService, opts)
  await fastify.register(require('./plugins/example'), opts)
}

stackable.configType = 'stackable'
stackable.schema = schema
stackable.Generator = Generator
stackable.configManagerConfig = {
  schema,
  envWhitelist: ['PORT', 'HOSTNAME'],
  allowToWatch: ['.env'],
  schemaOptions: {
    useDefaults: true,
    coerceTypes: true,
    allErrors: true,
    strict: false
  }
}

// break Fastify encapsulation
stackable[Symbol.for('skip-override')] = true

module.exports = stackable
`

const TS_STACKABLE_INDEX_FILE = `\
import { platformaticService, Stackable } from '@platformatic/service'
import { schema } from './lib/schema'
import { Generator } from './lib/generator'
import { StackableConfig } from './config'

const stackable: Stackable<StackableConfig> = async function (fastify, opts) {
  await fastify.register(platformaticService, opts)
  await fastify.register(require('./plugins/example'), opts)
}

stackable.configType = 'stackable'
stackable.schema = schema
stackable.Generator = Generator
stackable.configManagerConfig = {
  schema,
  envWhitelist: ['PORT', 'HOSTNAME'],
  allowToWatch: ['.env'],
  schemaOptions: {
    useDefaults: true,
    coerceTypes: true,
    allErrors: true,
    strict: false
  }
}

// break Fastify encapsulation
// @ts-ignore 
stackable[Symbol.for('skip-override')] = true

export default stackable
`

const INDEX_TYPES_FILE = `\
import { FastifyInstance } from 'fastify'
import { PlatformaticApp } from '@platformatic/service'
import { StackableConfig } from './config'

declare module 'fastify' {
  interface FastifyInstance {
    platformatic: PlatformaticApp<StackableConfig>
  }
}
`

const JS_STACKABLE_GENERATOR_FILE = `\
'use strict'

const { Generator: ServiceGenerator } = require('@platformatic/service')
const { schema } = require('./schema')

class Generator extends ServiceGenerator {
  getDefaultConfig () {
    const defaultBaseConfig = super.getDefaultConfig()
    const defaultConfig = {
      greeting: 'Hello world!'
    }
    return Object.assign({}, defaultBaseConfig, defaultConfig)
  }

  async _getConfigFileContents () {
    const baseConfig = await super._getConfigFileContents()
    const config = {
      $schema: './stackable.schema.json',
      greeting: {
        text: this.config.greeting ?? 'Hello world!'
      }
    }
    return Object.assign({}, baseConfig, config)
  }

  async _afterPrepare () {
    this.addFile({
      path: '',
      file: 'stackable.schema.json',
      contents: JSON.stringify(schema, null, 2)
    })
  }
}

module.exports = Generator
module.exports.Generator = Generator
`

const TS_STACKABLE_GENERATOR_FILE = `\
import { Generator as ServiceGenerator } from '@platformatic/service'
import { BaseGenerator } from '@platformatic/generators'
import { schema } from './schema'

class Generator extends ServiceGenerator {
  getDefaultConfig (): BaseGenerator.JSONValue {
    const defaultBaseConfig = super.getDefaultConfig()
    const defaultConfig = {
      greeting: 'Hello world!'
    }
    return Object.assign({}, defaultBaseConfig, defaultConfig)
  }

  async _getConfigFileContents (): Promise<BaseGenerator.JSONValue> {
    const baseConfig = await super._getConfigFileContents()
    const config = {
      $schema: './stackable.schema.json',
      greeting: {
        text: this.config.greeting ?? 'Hello world!'
      }
    }
    return Object.assign({}, baseConfig, config)
  }

  async _afterPrepare () {
    this.addFile({
      path: '',
      file: 'stackable.schema.json',
      contents: JSON.stringify(schema, null, 2)
    })
  }
}

export default Generator
export { Generator }

`

const JS_STACKABLE_SCHEMA_FILE = `\
'use strict'

const { schema } = require('@platformatic/service')

const stackableSchema = {
  ...schema.schema,
  $id: 'stackable',
  title: 'Stackable Config',
  properties: {
    ...schema.schema.properties,
    greeting: {
      type: 'object',
      properties: {
        text: {
          type: 'string'
        }
      },
      required: ['text'],
      additionalProperties: false
    }
  },
}

module.exports.schema = stackableSchema

if (require.main === module) {
  console.log(JSON.stringify(stackableSchema, null, 2))
}
`

const TS_STACKABLE_SCHEMA_FILE = `\
import { schema } from '@platformatic/service'

const stackableSchema = {
  ...schema.schema,
  $id: 'stackable',
  title: 'Stackable Config',
  properties: {
    ...schema.schema.properties,
    greeting: {
      type: 'object',
      properties: {
        text: {
          type: 'string'
        }
      },
      required: ['text'],
      additionalProperties: false
    }
  },
}

export { stackableSchema as schema }

if (require.main === module) {
  console.log(JSON.stringify(stackableSchema, null, 2))
}
`

const STACKABLE_CONFIG_TYPES_FILE = `\
export interface StackableConfig {
  greeting?: {
    text: string;
  };
}
`

function generateStackableFiles (typescript) {
  if (typescript) {
    return [
      {
        path: '',
        file: 'index.ts',
        contents: TS_STACKABLE_INDEX_FILE
      },
      {
        path: '',
        file: 'index.d.ts',
        contents: INDEX_TYPES_FILE
      },
      {
        path: '',
        file: 'config.d.ts',
        contents: STACKABLE_CONFIG_TYPES_FILE
      },
      {
        path: 'lib',
        file: 'generator.ts',
        contents: TS_STACKABLE_GENERATOR_FILE
      },
      {
        path: 'lib',
        file: 'schema.ts',
        contents: TS_STACKABLE_SCHEMA_FILE
      }
    ]
  }
  return [
    {
      path: '',
      file: 'index.js',
      contents: JS_STACKABLE_INDEX_FILE
    },
    {
      path: '',
      file: 'index.d.ts',
      contents: INDEX_TYPES_FILE
    },
    {
      path: '',
      file: 'config.d.ts',
      contents: STACKABLE_CONFIG_TYPES_FILE
    },
    {
      path: 'lib',
      file: 'generator.js',
      contents: JS_STACKABLE_GENERATOR_FILE
    },
    {
      path: 'lib',
      file: 'schema.js',
      contents: JS_STACKABLE_SCHEMA_FILE
    }
  ]
}

module.exports = {
  generateStackableFiles
}
