'use strict'

const { pascalCase, camelCase, capitalCase, kebabCase } = require('change-case-all')

function getJsStackableIndexFile (stackableName) {
  return `\
'use strict'

const { platformaticService } = require('@platformatic/service')
const { schema } = require('./lib/schema')
const { Generator } = require('./lib/generator')

async function stackable (fastify, opts) {
  await fastify.register(platformaticService, opts)
  await fastify.register(require('./plugins/example'), opts)
}

stackable.configType = '${kebabCase(stackableName + '-app')}'
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
  },
  transformConfig: async () => {}
}

// break Fastify encapsulation
stackable[Symbol.for('skip-override')] = true

module.exports = stackable
module.exports.schema = schema
module.exports.Generator = Generator
`
}

function getTsStackableIndexFile (stackableName) {
  const stackableConfigType = pascalCase(stackableName + 'Config')

  return `\
import { platformaticService, Stackable } from '@platformatic/service'
import { schema } from './lib/schema'
import { Generator } from './lib/generator'
import { ${stackableConfigType} } from './config'

const stackable: Stackable<${stackableConfigType}> = async function (fastify, opts) {
  await fastify.register(platformaticService, opts)
  await fastify.register(require('./plugins/example'), opts)
}

stackable.configType = '${kebabCase(stackableName + '-app')}'
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
  },
  transformConfig: async () => {}
}

// break Fastify encapsulation
// @ts-ignore 
stackable[Symbol.for('skip-override')] = true

export default stackable
export { Generator, schema }
`
}

function getStackableIndexTypesFile (stackableName) {
  const stackableConfigType = pascalCase(stackableName + 'Config')

  return `\
import { FastifyInstance } from 'fastify'
import { PlatformaticApp } from '@platformatic/service'
import { ${stackableConfigType} } from './config'

declare module 'fastify' {
  interface FastifyInstance {
    platformatic: PlatformaticApp<${stackableConfigType}>
  }
}

export { PlatformaticApp, ${stackableConfigType} }
`
}

function getJsGlobalTypesTemplateFile (stackableName) {
  const stackableConfigType = pascalCase(stackableName + 'Config')

  return `\
'use strict'

function generateGlobalTypesFile (npmPackageName) {
  return \`\
import { FastifyInstance } from 'fastify'
import { ${stackableConfigType}, PlatformaticApp } from '\${npmPackageName}'
  
declare module 'fastify' {
  interface FastifyInstance {
    platformatic: PlatformaticApp<${stackableConfigType}>
  }
}
\`
}

module.exports = {
  generateGlobalTypesFile
}
`
}

function getTsGlobalTypesTemplateFile (stackableName) {
  const stackableConfigType = pascalCase(stackableName + 'Config')

  return `\
export function generateGlobalTypesFile (npmPackageName) {
  return \`\
import { FastifyInstance } from 'fastify'
import { ${stackableConfigType}, PlatformaticApp } from '\${npmPackageName}'
  
declare module 'fastify' {
  interface FastifyInstance {
    platformatic: PlatformaticApp<${stackableConfigType}>
  }
}
\`
}
`
}

function getJsStackableGeneratorFile (stackableName) {
  const stackableGeneratorType = pascalCase(stackableName + 'Generator')

  return `\
'use strict'

const { join } = require('node:path')
const { readFile } = require('node:fs/promises')
const { Generator: ServiceGenerator } = require('@platformatic/service')
const { schema } = require('./schema')
const { generateGlobalTypesFile } = require('./templates/types')

class ${stackableGeneratorType} extends ServiceGenerator {
  getDefaultConfig () {
    const defaultBaseConfig = super.getDefaultConfig()
    const defaultConfig = {
      greeting: 'Hello world!'
    }
    return Object.assign({}, defaultBaseConfig, defaultConfig)
  }

  getConfigFieldsDefinitions () {
    const serviceConfigFieldsDefs = super.getConfigFieldsDefinitions()
    return [
      ...serviceConfigFieldsDefs,
      {
        var: 'PLT_GREETING_TEXT',
        label: 'What should the stackable greeting say?',
        default: 'Hello world!',
        type: 'string',
        configValue: ''
      }
    ]
  }

  async _getConfigFileContents () {
    const baseConfig = await super._getConfigFileContents()
    const packageName = await this.getStackablePackageName()
    const config = {
      $schema: './stackable.schema.json',
      module: packageName,
      greeting: {
        text: '{PLT_GREETING_TEXT}'
      }
    }
    return Object.assign({}, baseConfig, config)
  }

  async _beforePrepare () {
    super._beforePrepare()

    this.config.env = {
      PLT_GREETING_TEXT: this.config.greeting ?? 'Hello world!',
      ...this.config.env
    }

    const packageJson = await this.getStackablePackageJson()
    const packageName = packageJson.name
    const packageVersion = packageJson.version

    if (!packageName) {
      throw new Error('Missing package name in package.json')
    }

    if (!packageVersion) {
      throw new Error('Missing package version in package.json')
    }

    this.config.dependencies = {
      [packageName]: \`^\${packageVersion}\`
    }
  }

  async _afterPrepare () {
    const npmPackageName = await this.getStackablePackageName()
    this.addFile({
      path: '',
      file: 'global.d.ts',
      contents: generateGlobalTypesFile(npmPackageName)
    })

    this.addFile({
      path: '',
      file: 'stackable.schema.json',
      contents: JSON.stringify(schema, null, 2)
    })
  }

  async getStackablePackageJson () {
    if (!this._packageJson) {
      const packageJsonPath = join(__dirname, '..', 'package.json')
      const packageJson = await readFile(packageJsonPath, 'utf8')
      this._packageJson = JSON.parse(packageJson)
    }
    return this._packageJson
  }

  async getStackablePackageName () {
    const packageJson = await this.getStackablePackageJson()
    const packageName = packageJson.name
    if (!packageName) {
      throw new Error('Missing package name in package.json')
    }
    return packageName
  }
}

module.exports = ${stackableGeneratorType}
module.exports.Generator = ${stackableGeneratorType}
`
}

function getTsStackableGeneratorFile (stackableName) {
  const stackableGeneratorType = pascalCase(stackableName + 'Generator')

  return `\
import { join } from 'node:path'
import { readFile } from 'node:fs/promises'
import { Generator as ServiceGenerator } from '@platformatic/service'
import { BaseGenerator } from '@platformatic/generators'
import { schema } from './schema'
import { generateGlobalTypesFile } from './templates/types'

class ${stackableGeneratorType} extends ServiceGenerator {
  getDefaultConfig (): BaseGenerator.JSONValue {
    const defaultBaseConfig = super.getDefaultConfig()
    const defaultConfig = {
      greeting: 'Hello world!'
    }
    return Object.assign({}, defaultBaseConfig, defaultConfig)
  }

  getConfigFieldsDefinitions () {
    const serviceConfigFieldsDefs = super.getConfigFieldsDefinitions()
    return [
      ...serviceConfigFieldsDefs,
      {
        var: 'PLT_GREETING_TEXT',
        label: 'What should the stackable greeting say?',
        default: 'Hello world!',
        type: 'string',
        configValue: ''
      }
    ]
  }

  async _getConfigFileContents (): Promise<BaseGenerator.JSONValue> {
    const baseConfig = await super._getConfigFileContents()
    const packageName = await this.getStackablePackageName()
    const config = {
      $schema: './stackable.schema.json',
      module: packageName,
      greeting: {
        text: '{PLT_GREETING_TEXT}'
      }
    }
    return Object.assign({}, baseConfig, config)
  }

  async _beforePrepare () {
    super._beforePrepare()

    this.config.env = {
      PLT_GREETING_TEXT: this.config.greeting ?? 'Hello world!',
      ...this.config.env
    }

    const packageJson = await this.getStackablePackageJson()
    const packageName = packageJson.name
    const packageVersion = packageJson.version

    if (!packageName) {
      throw new Error('Missing package name in package.json')
    }

    if (!packageVersion) {
      throw new Error('Missing package version in package.json')
    }

    this.config.dependencies = {
      [packageName]: \`^\${packageVersion}\`
    }
  }

  async _afterPrepare () {
    const npmPackageName = await this.getStackablePackageName()
    this.addFile({
      path: '',
      file: 'global.d.ts',
      contents: generateGlobalTypesFile(npmPackageName)
    })

    this.addFile({
      path: '',
      file: 'stackable.schema.json',
      contents: JSON.stringify(schema, null, 2)
    })
  }

  async getStackablePackageJson () {
    if (!this._packageJson) {
      const packageJsonPath = join(__dirname, '..', 'package.json')
      const packageJson = await readFile(packageJsonPath, 'utf8')
      this._packageJson = JSON.parse(packageJson)
    }
    return this._packageJson
  }

  async getStackablePackageName () {
    const packageJson = await this.getStackablePackageJson()
    const packageName = packageJson.name
    if (!packageName) {
      throw new Error('Missing package name in package.json')
    }
    return packageName
  }
}

export default ${stackableGeneratorType}
export { ${stackableGeneratorType} as Generator }
`
}

function getJsStackableSchemaFile (stackableName) {
  const schemaId = kebabCase(stackableName)
  const schemaTitle = capitalCase(stackableName + 'Config')
  const schemaVarName = camelCase(stackableName + 'Schema')

  return `\
'use strict'

const { schema } = require('@platformatic/service')

const ${schemaVarName} = {
  ...schema.schema,
  $id: '${schemaId}',
  title: '${schemaTitle}',
  properties: {
    ...schema.schema.properties,
    module: { type: 'string' },
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
  }
}

module.exports.schema = ${schemaVarName}

if (require.main === module) {
  console.log(JSON.stringify(${schemaVarName}, null, 2))
}
`
}

function getTsStackableSchemaFile (stackableName) {
  const schemaId = kebabCase(stackableName)
  const schemaTitle = capitalCase(stackableName + 'Config')
  const schemaVarName = camelCase(stackableName + 'Schema')

  return `\
import { schema } from '@platformatic/service'

const ${schemaVarName} = {
  ...schema.schema,
  $id: '${schemaId}',
  title: '${schemaTitle}',
  properties: {
    ...schema.schema.properties,
    module: { type: 'string' },
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
  }
}

export { ${schemaVarName} as schema }

if (require.main === module) {
  console.log(JSON.stringify(${schemaVarName}, null, 2))
}
`
}

function getStackableConfigTypesFile (stackableName) {
  const stackableConfigType = pascalCase(stackableName + 'Config')

  return `\
// Use npm run build:config to generate this file from the Stackable schema
export interface ${stackableConfigType} {
  greeting?: {
    text: string;
  };
}
`
}

function generateStackableFiles (typescript, stackableName) {
  if (typescript) {
    return [
      {
        path: '',
        file: 'index.ts',
        contents: getTsStackableIndexFile(stackableName)
      },
      {
        path: '',
        file: 'index.d.ts',
        contents: getStackableIndexTypesFile(stackableName)
      },
      {
        path: '',
        file: 'config.d.ts',
        contents: getStackableConfigTypesFile(stackableName)
      },
      {
        path: 'lib',
        file: 'generator.ts',
        contents: getTsStackableGeneratorFile(stackableName)
      },
      {
        path: 'lib/templates',
        file: 'types.ts',
        contents: getTsGlobalTypesTemplateFile(stackableName)
      },
      {
        path: 'lib',
        file: 'schema.ts',
        contents: getTsStackableSchemaFile(stackableName)
      }
    ]
  }
  return [
    {
      path: '',
      file: 'index.js',
      contents: getJsStackableIndexFile(stackableName)
    },
    {
      path: '',
      file: 'index.d.ts',
      contents: getStackableIndexTypesFile(stackableName)
    },
    {
      path: '',
      file: 'config.d.ts',
      contents: getStackableConfigTypesFile(stackableName)
    },
    {
      path: 'lib',
      file: 'generator.js',
      contents: getJsStackableGeneratorFile(stackableName)
    },
    {
      path: 'lib/templates',
      file: 'types.js',
      contents: getJsGlobalTypesTemplateFile(stackableName)
    },
    {
      path: 'lib',
      file: 'schema.js',
      contents: getJsStackableSchemaFile(stackableName)
    }
  ]
}

module.exports = {
  generateStackableFiles
}
