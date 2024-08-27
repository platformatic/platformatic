import { schemas } from '@platformatic/utils'
import { readFileSync } from 'node:fs'

export const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf-8'))

const application = {
  type: 'object',
  properties: {
    basePath: {
      type: 'string'
    }
  },
  additionalProperties: false
}

const watch = {
  anyOf: [
    schemas.watch,
    {
      type: 'boolean'
    },
    {
      type: 'string'
    }
  ]
}

const deploy = {
  type: 'object',
  properties: {
    include: {
      type: 'array',
      items: {
        type: 'string'
      },
      default: ['dist']
    },
    buildCommand: {
      type: 'string',
      default: 'npm run build'
    },
    installCommand: {
      type: 'string',
      default: 'npm ci --omit-dev'
    },
    startCommand: {
      type: 'string',
      default: 'npm run start'
    }
  },
  default: {}
}

export const schemaComponents = { application, deploy, watch }

export const schema = {
  $id: `https://schemas.platformatic.dev/@platformatic/basic/${packageJson.version}.json`,
  $schema: 'http://json-schema.org/draft-07/schema#',
  title: 'Platformatic Stackable',
  type: 'object',
  properties: {
    $schema: {
      type: 'string'
    }
  },
  additionalProperties: true
}

/* c8 ignore next 3 */
if (process.argv[1] === import.meta.filename) {
  console.log(JSON.stringify(schema, null, 2))
}
