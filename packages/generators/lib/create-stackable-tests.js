'use strict'

const { kebabCase } = require('change-case-all')

function getJsStackableIndexTestFile (stackableName) {
  const configType = kebabCase(stackableName + '-app')

  return `\
'use strict'

const test = require('node:test')
const assert = require('node:assert')
const stackable = require('../index')
const { schema } = require('../lib/schema')
const { Generator } = require('../lib/generator')

test('should export stackable interface', async () => {
  assert.strictEqual(typeof stackable, 'function')
  assert.strictEqual(stackable.configType, '${configType}')
  assert.deepStrictEqual(stackable.schema, schema)
  assert.deepStrictEqual(stackable.Generator, Generator)
  assert.ok(stackable.configManagerConfig)
  assert.ok(typeof stackable.transformConfig, 'function')
})
`
}

function getTsStackableIndexTestFile (stackableName) {
  const configType = kebabCase(stackableName + '-app')

  return `\
import test from 'node:test'
import assert from 'node:assert'
import stackable from '../index'
import { schema } from '../lib/schema'
import { Generator } from '../lib/generator'

test('should export stackable interface', async () => {
  assert.strictEqual(typeof stackable, 'function')
  assert.strictEqual(stackable.configType, '${configType}')
  assert.deepStrictEqual(stackable.schema, schema)
  assert.deepStrictEqual(stackable.Generator, Generator)
  assert.ok(stackable.configManagerConfig)
  assert.ok(typeof stackable.transformConfig, 'function')
})
`
}

function getJsStackableSchemaTestFile (stackableName) {
  const schemaId = kebabCase(stackableName)

  return `\
'use strict'

const test = require('node:test')
const assert = require('node:assert')
const { schema } = require('../index')

test('should export stackable schema', async () => {
  assert.strictEqual(schema.$id, '${schemaId}')
  assert.strictEqual(typeof schema.version, 'string')

  assert.deepStrictEqual(schema.properties.greeting, {
    type: 'object',
    properties: {
      text: {
        type: 'string'
      }
    },
    required: ['text'],
    additionalProperties: false
  })
})
`
}

function getTsStackableSchemaTestFile (stackableName) {
  const schemaId = kebabCase(stackableName)

  return `\
import test from 'node:test'
import assert from 'node:assert'
import { schema } from '../index'

test('should export stackable schema', async () => {
  assert.strictEqual(schema.$id, '${schemaId}')
  assert.strictEqual(typeof schema.version, 'string')

  assert.deepStrictEqual(schema.properties.greeting, {
    type: 'object',
    properties: {
      text: {
        type: 'string'
      }
    },
    required: ['text'],
    additionalProperties: false
  })
})
`
}

function getJsStackableGeneratorTestFile () {
  return `\
'use strict'

const test = require('node:test')
const assert = require('node:assert')
const { tmpdir } = require('node:os')
const { join } = require('node:path')
const { readFile, readdir, mkdtemp, rm } = require('node:fs/promises')
const { Generator } = require('../index')
const stackablePackageJson = require('../package.json')

test('should return a default Generator config', async () => {
  const generator = new Generator()
  const defaultConfig = generator.getDefaultConfig()

  assert.strictEqual(defaultConfig.hostname, '0.0.0.0')
  assert.strictEqual(defaultConfig.port, 3042)
  assert.strictEqual(defaultConfig.greeting, 'Hello world!')
  assert.deepStrictEqual(defaultConfig.env, {})
  assert.deepStrictEqual(defaultConfig.dependencies, {})
  assert.deepStrictEqual(defaultConfig.devDependencies, {})
})

test('should return Generator config fields definitions', async () => {
  const generator = new Generator()
  const configFieldsDefs = generator.getConfigFieldsDefinitions()

  const hostnameField = configFieldsDefs.find(
    field => field.var === 'PLT_SERVER_HOSTNAME'
  )
  assert.deepStrictEqual(hostnameField, {
    var: 'PLT_SERVER_HOSTNAME',
    label: 'What is the hostname?',
    default: '0.0.0.0',
    type: 'string',
    configValue: 'hostname'
  })

  const portField = configFieldsDefs.find(
    field => field.var === 'PORT'
  )
  assert.deepStrictEqual(portField, {
    var: 'PORT',
    label: 'Which port do you want to use?',
    default: 3042,
    type: 'number',
    configValue: 'port'
  })

  const greetingField = configFieldsDefs.find(
    field => field.var === 'PLT_GREETING_TEXT'
  )
  assert.deepStrictEqual(greetingField, {
    var: 'PLT_GREETING_TEXT',
    label: 'What should the stackable greeting say?',
    default: 'Hello world!',
    type: 'string'
  })
})

test('should generate a stackable app', async (t) => {
  const testDir = await mkdtemp(join(tmpdir(), 'stackable-'))
  t.after(() => rm(testDir, { recursive: true, force: true }))

  const generator = new Generator()

  generator.setConfig({
    serviceName: 'stackable-app',
    targetDirectory: testDir
  })

  await generator.prepare()
  await generator.writeFiles()

  const files = await readdir(testDir)
  assert.deepStrictEqual(files.sort(), [
    '.env',
    '.env.sample',
    '.gitignore',
    'global.d.ts',
    'package.json',
    'platformatic.json',
    'stackable.schema.json'
  ])

  const packageJson = require(join(testDir, 'package.json'))
  assert.strictEqual(packageJson.name, 'stackable-app')

  const envFile = await readFile(join(testDir, '.env'), 'utf8')
  const envVars = envFile.split('\\n').filter(Boolean)
  assert.deepStrictEqual(envVars.sort(), [
    'PLT_GREETING_TEXT=Hello world!',
    'PLT_SERVER_HOSTNAME=0.0.0.0',
    'PLT_SERVER_LOGGER_LEVEL=info',
    'PLT_TYPESCRIPT=false',
    'PORT=3042'
  ])

  const stackableConfig = require(join(testDir, 'platformatic.json'))
  const stackableName = stackablePackageJson.name
  const stackableVersion = stackablePackageJson.version

  assert.deepStrictEqual(stackableConfig, {
    $schema: './stackable.schema.json',
    module: \`\${stackableName}@\${stackableVersion}\`,
    server: {
      hostname: '{PLT_SERVER_HOSTNAME}',
      port: '{PORT}',
      logger: {
        level: '{PLT_SERVER_LOGGER_LEVEL}'
      }
    },
    service: {
      openapi: true
    },
    greeting: {
      text: '{PLT_GREETING_TEXT}'
    },
    watch: true
  })
})
`
}

function getTsStackableGeneratorTestFile () {
  return `\
import test from 'node:test'
import assert from 'node:assert'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { readFile, readdir, mkdtemp, rm } from 'node:fs/promises'
import { readFileSync } from 'node:fs'
import { Generator } from '../index'

const stackablePackageJsonPath = require.resolve('../../package.json')
const stackablePackageJson = JSON.parse(readFileSync(stackablePackageJsonPath, 'utf8'))

test('should return a default Generator config', async () => {
  const generator = new Generator()
  const defaultConfig = generator.getDefaultConfig()

  assert.strictEqual(defaultConfig.hostname, '0.0.0.0')
  assert.strictEqual(defaultConfig.port, 3042)
  assert.strictEqual(defaultConfig.greeting, 'Hello world!')
  assert.deepStrictEqual(defaultConfig.env, {})
  assert.deepStrictEqual(defaultConfig.dependencies, {})
  assert.deepStrictEqual(defaultConfig.devDependencies, {})
})

test('should return Generator config fields definitions', async () => {
  const generator = new Generator()
  const configFieldsDefs = generator.getConfigFieldsDefinitions()

  const hostnameField = configFieldsDefs.find(
    field => field.var === 'PLT_SERVER_HOSTNAME'
  )
  assert.deepStrictEqual(hostnameField, {
    var: 'PLT_SERVER_HOSTNAME',
    label: 'What is the hostname?',
    default: '0.0.0.0',
    type: 'string',
    configValue: 'hostname'
  })

  const portField = configFieldsDefs.find(
    field => field.var === 'PORT'
  )
  assert.deepStrictEqual(portField, {
    var: 'PORT',
    label: 'Which port do you want to use?',
    default: 3042,
    type: 'number',
    configValue: 'port'
  })

  const greetingField = configFieldsDefs.find(
    field => field.var === 'PLT_GREETING_TEXT'
  )
  assert.deepStrictEqual(greetingField, {
    var: 'PLT_GREETING_TEXT',
    label: 'What should the stackable greeting say?',
    default: 'Hello world!',
    type: 'string'
  })
})

test('should generate a stackable app', async (t) => {
  const testDir = await mkdtemp(join(tmpdir(), 'stackable-'))
  t.after(() => rm(testDir, { recursive: true, force: true }))

  const generator = new Generator()

  generator.setConfig({
    serviceName: 'stackable-app',
    targetDirectory: testDir
  })

  await generator.prepare()
  await generator.writeFiles()

  const files = await readdir(testDir)
  assert.deepStrictEqual(files.sort(), [
    '.env',
    '.env.sample',
    '.gitignore',
    'global.d.ts',
    'package.json',
    'platformatic.json',
    'stackable.schema.json'
  ])

  const packageJson = require(join(testDir, 'package.json'))
  assert.strictEqual(packageJson.name, 'stackable-app')

  const envFile = await readFile(join(testDir, '.env'), 'utf8')
  const envVars = envFile.split('\\n').filter(Boolean)
  assert.deepStrictEqual(envVars.sort(), [
    'PLT_GREETING_TEXT=Hello world!',
    'PLT_SERVER_HOSTNAME=0.0.0.0',
    'PLT_SERVER_LOGGER_LEVEL=info',
    'PLT_TYPESCRIPT=false',
    'PORT=3042'
  ])

  const stackableConfig = require(join(testDir, 'platformatic.json'))
  const stackableName = stackablePackageJson.name
  const stackableVersion = stackablePackageJson.version

  assert.deepStrictEqual(stackableConfig, {
    $schema: './stackable.schema.json',
    module: \`\${stackableName}@\${stackableVersion}\`,
    server: {
      hostname: '{PLT_SERVER_HOSTNAME}',
      port: '{PORT}',
      logger: {
        level: '{PLT_SERVER_LOGGER_LEVEL}'
      }
    },
    service: {
      openapi: true
    },
    greeting: {
      text: '{PLT_GREETING_TEXT}'
    },
    watch: true
  })
})
`
}

function generateStackableTests (typescript, stackableName) {
  if (typescript) {
    return [
      {
        path: 'test',
        file: 'index.test.ts',
        contents: getTsStackableIndexTestFile(stackableName),
      },
      {
        path: 'test',
        file: 'schema.test.ts',
        contents: getTsStackableSchemaTestFile(stackableName),
      },
      {
        path: 'test',
        file: 'generator.test.ts',
        contents: getTsStackableGeneratorTestFile(),
      },
    ]
  }
  return [
    {
      path: 'test',
      file: 'index.test.js',
      contents: getJsStackableIndexTestFile(stackableName),
    },
    {
      path: 'test',
      file: 'schema.test.js',
      contents: getJsStackableSchemaTestFile(stackableName),
    },
    {
      path: 'test',
      file: 'generator.test.js',
      contents: getJsStackableGeneratorTestFile(),
    },
  ]
}

module.exports = {
  generateStackableTests,
}
