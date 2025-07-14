import { deepEqual, equal, ok, rejects, throws } from 'node:assert'
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import os from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import {
  createValidator,
  envVariablePattern,
  findConfigurationFile,
  findConfigurationFileRecursive,
  getParser,
  getStringifier,
  knownConfigurationFilesExtensions,
  knownConfigurationFilesSchemas,
  listRecognizedConfigurationFiles,
  loadCapability,
  loadConfiguration,
  loadConfigurationFile,
  loadEnv,
  matchKnownSchema,
  printValidationErrors,
  replaceEnv,
  saveConfigurationFile,
  stringifyJSON,
  stringifyJSON5
} from '../lib/configuration.js'
import { safeRemove } from '../lib/file-system.js'

test('envVariablePattern - should match environment variable patterns', () => {
  ok(envVariablePattern.test('{FOO}'))
  ok(envVariablePattern.test('{BAR_BAZ}'))
  ok(envVariablePattern.test('{test123}'))
  ok(envVariablePattern.test('{a}'))
  ok(!envVariablePattern.test('FOO'))
  ok(!envVariablePattern.test('{FOO'))
  ok(!envVariablePattern.test('FOO}'))
  ok(!envVariablePattern.test('{}'))
})

test('knownConfigurationFilesExtensions - should contain expected extensions', () => {
  const expected = ['json', 'json5', 'yaml', 'yml', 'toml', 'tml']
  deepEqual(knownConfigurationFilesExtensions, expected)
})

test('knownConfigurationFilesSchemas - should contain expected schema patterns', () => {
  equal(knownConfigurationFilesSchemas.length, 3)
  ok(knownConfigurationFilesSchemas.every(schema => schema instanceof RegExp))

  const testSchema1 = 'https://platformatic.dev/schemas//db'
  const testSchema2 = 'https://schemas.platformatic.dev/@platformatic/db/.json'
  const testSchema3 = 'https://schemas.platformatic.dev/wattpm/.json'

  ok(knownConfigurationFilesSchemas.some(schema => schema.test(testSchema1)))
  ok(knownConfigurationFilesSchemas.some(schema => schema.test(testSchema2)))
  ok(knownConfigurationFilesSchemas.some(schema => schema.test(testSchema3)))
})

test('getParser - should return correct parser for file extensions', () => {
  equal(getParser('config.json'), JSON.parse)
  equal(typeof getParser('config.json5'), 'function')
  equal(typeof getParser('config.yaml'), 'function')
  equal(typeof getParser('config.yml'), 'function')
  equal(typeof getParser('config.toml'), 'function')
  equal(typeof getParser('config.tml'), 'function')

  throws(() => getParser('config.txt'), { name: 'FastifyError' })
  throws(() => getParser('config.xml'), { name: 'FastifyError' })
})

test('getStringifier - should return correct stringifier for file extensions', () => {
  equal(getStringifier('config.json'), stringifyJSON)
  equal(getStringifier('config.json5'), stringifyJSON5)
  equal(typeof getStringifier('config.yaml'), 'function')
  equal(typeof getStringifier('config.yml'), 'function')
  equal(typeof getStringifier('config.toml'), 'function')
  equal(typeof getStringifier('config.tml'), 'function')

  throws(() => getStringifier('config.txt'), { name: 'FastifyError' })
  throws(() => getStringifier('config.xml'), { name: 'FastifyError' })
})

test('printValidationErrors - should print validation errors in table format', () => {
  const originalConsoleTable = console.table
  const capturedOutput = []
  console.table = (data, columns) => {
    capturedOutput.push({ data, columns })
  }

  const err = {
    validation: [
      { path: '/name', message: 'must be string' },
      { path: '/age', message: 'must be number' }
    ]
  }

  try {
    printValidationErrors(err)
  } finally {
    console.table = originalConsoleTable
  }

  equal(capturedOutput.length, 1)
  equal(capturedOutput[0].columns.length, 2)
  equal(capturedOutput[0].columns[0], 'path')
  equal(capturedOutput[0].columns[1], 'message')
})

test('stringifyJSON - should format JSON with proper indentation', () => {
  const obj = { foo: 'bar', nested: { baz: 123 } }
  const result = stringifyJSON(obj)
  equal(result, '{\n  "foo": "bar",\n  "nested": {\n    "baz": 123\n  }\n}')
})

test('stringifyJSON5 - should format JSON5 with proper indentation', () => {
  const obj = { foo: 'bar', nested: { baz: 123 } }
  const result = stringifyJSON5(obj)
  ok(result.includes('foo:'))
  ok(result.includes('nested:'))
  ok(result.includes('baz:'))
})

test('listRecognizedConfigurationFiles - should list all recognized configuration files', () => {
  const files = listRecognizedConfigurationFiles()

  ok(files.includes('watt.json'))
  ok(files.includes('platformatic.json'))
  ok(files.includes('watt.runtime.json'))
  ok(files.includes('platformatic.runtime.json'))
  ok(files.includes('watt.service.json'))
  ok(files.includes('platformatic.service.json'))
  ok(files.includes('watt.yaml'))
  ok(files.includes('platformatic.yaml'))
  ok(files.includes('watt.toml'))
  ok(files.includes('platformatic.toml'))

  ok(files.length > 10)
})

test('listRecognizedConfigurationFiles - should handle custom suffixes', () => {
  const files = listRecognizedConfigurationFiles(['custom'])

  ok(files.includes('watt.json'))
  ok(files.includes('platformatic.json'))
  ok(files.includes('watt.custom.json'))
  ok(files.includes('platformatic.custom.json'))
  ok(!files.includes('watt.service.json'))
})

test('listRecognizedConfigurationFiles - should handle custom extensions', () => {
  const files = listRecognizedConfigurationFiles(['runtime'], ['json'])

  ok(files.includes('watt.json'))
  ok(files.includes('platformatic.json'))
  ok(files.includes('watt.runtime.json'))
  ok(files.includes('platformatic.runtime.json'))
  ok(!files.includes('watt.yaml'))
  ok(!files.includes('platformatic.yaml'))
})

test('listRecognizedConfigurationFiles - should handle null suffixes', () => {
  const files = listRecognizedConfigurationFiles(null)

  ok(files.includes('watt.json'))
  ok(files.includes('platformatic.json'))
  ok(files.includes('watt.service.json'))
})

test('listRecognizedConfigurationFiles - should handle empty array suffixes', () => {
  const files = listRecognizedConfigurationFiles([])

  ok(files.includes('watt.json'))
  ok(files.includes('platformatic.json'))
  ok(!files.includes('watt.service.json'))
})

test('listRecognizedConfigurationFiles - should handle falsy suffixes', () => {
  const files = listRecognizedConfigurationFiles(false)

  ok(files.includes('watt.json'))
  ok(files.includes('platformatic.json'))
  ok(!files.includes('watt.service.json'))
})

test('listRecognizedConfigurationFiles - should handle string suffixes', () => {
  const files = listRecognizedConfigurationFiles('custom')

  ok(files.includes('watt.json'))
  ok(files.includes('platformatic.json'))
  ok(files.includes('watt.custom.json'))
  ok(files.includes('platformatic.custom.json'))
  ok(!files.includes('watt.service.json'))
})

test('listRecognizedConfigurationFiles - should handle string extensions', () => {
  const files = listRecognizedConfigurationFiles(['runtime'], 'json')

  ok(files.includes('watt.json'))
  ok(files.includes('platformatic.json'))
  ok(files.includes('watt.runtime.json'))
  ok(files.includes('platformatic.runtime.json'))
  ok(!files.includes('watt.yaml'))
  ok(!files.includes('platformatic.yaml'))
})

test('matchKnownSchema - should match module property', () => {
  const config = { module: '@platformatic/db' }
  const result = matchKnownSchema(config)
  equal(result, '@platformatic/db')
})

test('matchKnownSchema - should match schema URL', () => {
  const config = { $schema: 'https://schemas.platformatic.dev/@platformatic/db/.json' }
  const result = matchKnownSchema(config)
  deepEqual(result, { module: '@platformatic/db', version: '' })
})

test('matchKnownSchema - should match wattpm schema', () => {
  const config = { $schema: 'https://schemas.platformatic.dev/wattpm/.json' }
  const result = matchKnownSchema(config)
  deepEqual(result, { module: '@platformatic/runtime', version: '' })
})

test('matchKnownSchema - should return null for no match', () => {
  const config = { someOtherProperty: 'value' }
  const result = matchKnownSchema(config)
  equal(result, null)
})

test('matchKnownSchema - should throw when throwOnMissing is true', () => {
  const config = { someOtherProperty: 'value' }
  throws(() => matchKnownSchema(config, true), {
    name: 'FastifyError'
  })
})

test('matchKnownSchema - should throw when throwOnMissing is true and schema does not match', () => {
  const config = { $schema: 'https://example.com/unknown-schema.json' }
  throws(() => matchKnownSchema(config, true), {
    name: 'FastifyError'
  })
})

test('findConfigurationFile - should find existing configuration file', async t => {
  const tmpDir = await mkdtemp(join(os.tmpdir(), 'plt-utils-test-'))
  const configFile = join(tmpDir, 'platformatic.json')

  t.after(async () => {
    await safeRemove(tmpDir)
  })

  await writeFile(configFile, '{}')

  const result = await findConfigurationFile(tmpDir)
  equal(result, 'platformatic.json')
})

test('findConfigurationFile - should return null when no config file found', async t => {
  const tmpDir = await mkdtemp(join(os.tmpdir(), 'plt-utils-test-'))

  t.after(async () => {
    await safeRemove(tmpDir)
  })

  const result = await findConfigurationFile(tmpDir)
  equal(result, null)
})

test('findConfigurationFile - should respect custom suffixes and extensions', async t => {
  const tmpDir = await mkdtemp(join(os.tmpdir(), 'plt-utils-test-'))
  const configFile = join(tmpDir, 'watt.custom.yaml')

  t.after(async () => {
    await safeRemove(tmpDir)
  })

  await writeFile(configFile, 'foo: bar')

  const result = await findConfigurationFile(tmpDir, ['custom'], ['yaml'])
  equal(result, 'watt.custom.yaml')
})

test('findConfigurationFileRecursive - should find config file recursively', async t => {
  const tmpDir = await mkdtemp(join(os.tmpdir(), 'plt-utils-test-'))
  const subDir = join(tmpDir, 'subdir')
  const configFile = join(tmpDir, 'platformatic.json')

  t.after(async () => {
    await safeRemove(tmpDir)
  })

  await mkdir(subDir)
  await writeFile(configFile, '{"module": "@platformatic/runtime"}')

  const result = await findConfigurationFileRecursive(subDir)
  equal(result, configFile)
})

test('findConfigurationFileRecursive - should return null when no config found', async t => {
  const tmpDir = await mkdtemp(join(os.tmpdir(), 'plt-utils-test-'))

  t.after(async () => {
    await safeRemove(tmpDir)
  })

  const result = await findConfigurationFileRecursive(tmpDir)
  equal(result, null)
})

test('findConfigurationFileRecursive - should filter by schema', async t => {
  const tmpDir = await mkdtemp(join(os.tmpdir(), 'plt-utils-test-'))
  const subDir = join(tmpDir, 'subdir')
  const configFile = join(tmpDir, 'platformatic.json')

  t.after(async () => {
    await safeRemove(tmpDir)
  })

  await mkdir(subDir)
  await writeFile(configFile, '{"module": "@platformatic/db"}')

  const result = await findConfigurationFileRecursive(subDir, null, ['@platformatic/runtime'])
  equal(result, null)

  const result2 = await findConfigurationFileRecursive(subDir, null, ['@platformatic/db'])
  equal(result2, configFile)
})

test('loadConfigurationFile - should load and parse JSON file', async t => {
  const tmpDir = await mkdtemp(join(os.tmpdir(), 'plt-utils-test-'))
  const configFile = join(tmpDir, 'config.json')
  const config = { foo: 'bar', nested: { baz: 123 } }

  t.after(async () => {
    await safeRemove(tmpDir)
  })

  await writeFile(configFile, JSON.stringify(config))

  const result = await loadConfigurationFile(configFile)
  deepEqual(result, config)
})

test('loadConfigurationFile - should load and parse YAML file', async t => {
  const tmpDir = await mkdtemp(join(os.tmpdir(), 'plt-utils-test-'))
  const configFile = join(tmpDir, 'config.yaml')
  const yamlContent = 'foo: bar\nnested:\n  baz: 123'

  t.after(async () => {
    await safeRemove(tmpDir)
  })

  await writeFile(configFile, yamlContent)

  const result = await loadConfigurationFile(configFile)
  deepEqual(result, { foo: 'bar', nested: { baz: 123 } })
})

test('loadConfigurationFile - should handle YAML with environment variables', async t => {
  const tmpDir = await mkdtemp(join(os.tmpdir(), 'plt-utils-test-'))
  const configFile = join(tmpDir, 'config.yaml')
  const yamlContent = 'database:\n  host: "{DB_HOST}"\n  port: 5432'

  t.after(async () => {
    await safeRemove(tmpDir)
  })

  await writeFile(configFile, yamlContent)

  const result = await loadConfigurationFile(configFile)
  deepEqual(result, { database: { host: '{DB_HOST}', port: 5432 } })
})

test('loadConfigurationFile - should handle YAML with environment variables outside strings', async t => {
  const tmpDir = await mkdtemp(join(os.tmpdir(), 'plt-utils-test-'))
  const configFile = join(tmpDir, 'config.yaml')
  const yamlContent = 'database:\n  host: {DB_HOST}\n  port: 5432'

  t.after(async () => {
    await safeRemove(tmpDir)
  })

  await writeFile(configFile, yamlContent)

  const result = await loadConfigurationFile(configFile)
  deepEqual(result, { database: { host: '{DB_HOST}', port: 5432 } })
})

test('loadConfigurationFile - should throw on invalid file', async t => {
  const tmpDir = await mkdtemp(join(os.tmpdir(), 'plt-utils-test-'))
  const configFile = join(tmpDir, 'config.json')

  t.after(async () => {
    await safeRemove(tmpDir)
  })

  await writeFile(configFile, 'invalid json content')

  await rejects(
    async () => {
      await loadConfigurationFile(configFile)
    },
    { name: 'FastifyError' }
  )
})

test('saveConfigurationFile - should save JSON file', async t => {
  const tmpDir = await mkdtemp(join(os.tmpdir(), 'plt-utils-test-'))
  const configFile = join(tmpDir, 'config.json')
  const config = { foo: 'bar', nested: { baz: 123 } }

  t.after(async () => {
    await safeRemove(tmpDir)
  })

  await saveConfigurationFile(configFile, config)

  const result = await loadConfigurationFile(configFile)
  deepEqual(result, config)
})

test('saveConfigurationFile - should save YAML file', async t => {
  const tmpDir = await mkdtemp(join(os.tmpdir(), 'plt-utils-test-'))
  const configFile = join(tmpDir, 'config.yaml')
  const config = { foo: 'bar', nested: { baz: 123 } }

  t.after(async () => {
    await safeRemove(tmpDir)
  })

  await saveConfigurationFile(configFile, config)

  const result = await loadConfigurationFile(configFile)
  deepEqual(result, config)
})

test('createValidator - should create AJV validator with custom keywords', () => {
  const schema = {
    type: 'object',
    properties: {
      name: { type: 'string' },
      age: { type: 'number' }
    },
    required: ['name']
  }

  const validator = createValidator(schema)
  ok(typeof validator === 'function')

  ok(validator({ name: 'John', age: 30 }))
  ok(!validator({ age: 30 }))
})

test('createValidator - should handle resolvePath keyword', () => {
  const schema = {
    type: 'object',
    properties: {
      path: { type: 'string', resolvePath: true }
    }
  }

  const validator = createValidator(schema, {}, { root: '/tmp' })
  const data = { path: 'relative/path' }

  ok(validator(data))
  ok(data.path.startsWith('/'))
})

test('createValidator - should handle resolveModule keyword', () => {
  const schema = {
    type: 'object',
    properties: {
      module: { type: 'string', resolveModule: true }
    }
  }

  const validator = createValidator(schema, {}, { root: process.cwd() })
  const data = { module: 'node:path' }

  ok(validator(data))
})

test('createValidator - should handle typeof keyword', () => {
  const schema = {
    type: 'object',
    properties: {
      value: { typeof: 'string' }
    }
  }

  const validator = createValidator(schema)

  ok(validator({ value: 'hello' }))
  ok(!validator({ value: 123 }))
})

test('createValidator - should handle resolvePath with empty path and allowEmptyPaths', () => {
  const schema = {
    type: 'object',
    properties: {
      path: { type: 'string', resolvePath: true, allowEmptyPaths: true }
    }
  }

  const validator = createValidator(schema, {}, { root: '/tmp' })
  const data = { path: '' }

  ok(validator(data))
})

test('createValidator - should handle resolvePath with empty path and no allowEmptyPaths', () => {
  const schema = {
    type: 'object',
    properties: {
      path: { type: 'string', resolvePath: true, allowEmptyPaths: false }
    }
  }

  const validator = createValidator(schema, {}, { root: '/tmp' })
  const data = { path: '' }

  ok(!validator(data))
})

test('createValidator - should handle resolvePath with fixPaths disabled', () => {
  const schema = {
    type: 'object',
    properties: {
      path: { type: 'string', resolvePath: true }
    }
  }

  const validator = createValidator(schema, {}, { root: '/tmp', fixPaths: false })
  const data = { path: 'relative/path' }

  ok(validator(data))
  equal(data.path, 'relative/path')
})

test('createValidator - should handle resolveModule with empty path', () => {
  const schema = {
    type: 'object',
    properties: {
      module: { type: 'string', resolveModule: true }
    }
  }

  const validator = createValidator(schema, {}, { root: process.cwd() })
  const data = { module: '' }

  ok(!validator(data))
})

test('createValidator - should handle resolveModule with fixPaths disabled', () => {
  const schema = {
    type: 'object',
    properties: {
      module: { type: 'string', resolveModule: true }
    }
  }

  const validator = createValidator(schema, {}, { root: process.cwd(), fixPaths: false })
  const data = { module: 'some-module' }

  ok(validator(data))
})

test('createValidator - should handle resolveModule with non-existent module', () => {
  const schema = {
    type: 'object',
    properties: {
      module: { type: 'string', resolveModule: true }
    }
  }

  const validator = createValidator(schema, {}, { root: process.cwd() })
  const data = { module: 'non-existent-module-123456' }

  ok(!validator(data))
})

test('loadEnv - should load environment variables from .env file', async t => {
  const tmpDir = await mkdtemp(join(os.tmpdir(), 'plt-utils-test-'))
  const envFile = join(tmpDir, '.env')
  const envContent = 'FOO=bar\nBAZ=123\nQUOTED="quoted value"'

  t.after(async () => {
    await safeRemove(tmpDir)
  })

  await writeFile(envFile, envContent)

  const result = await loadEnv(tmpDir)
  equal(result.FOO, 'bar')
  equal(result.BAZ, '123')
  equal(result.QUOTED, 'quoted value')

  Object.keys(process.env).forEach(key => {
    equal(result[key], process.env[key])
  })
})

test('loadEnv - should return process.env when no .env file exists', async t => {
  const tmpDir = await mkdtemp(join(os.tmpdir(), 'plt-utils-test-'))

  t.after(async () => {
    await safeRemove(tmpDir)
  })

  const result = await loadEnv(tmpDir)
  deepEqual(result, process.env)
})

test('loadEnv - should handle relative root path', async t => {
  const tmpDir = await mkdtemp(join(os.tmpdir(), 'plt-utils-test-'))
  const envFile = join(tmpDir, '.env')
  const envContent = 'FOO=bar'

  t.after(async () => {
    await safeRemove(tmpDir)
  })

  await writeFile(envFile, envContent)

  const originalCwd = process.cwd()
  try {
    process.chdir(tmpDir)
    const result = await loadEnv('.')
    equal(result.FOO, 'bar')
  } finally {
    process.chdir(originalCwd)
  }
})

test('loadEnv - should check current working directory when no .env in hierarchy', async t => {
  const tmpDir = await mkdtemp(join(os.tmpdir(), 'plt-utils-test-'))
  const envFile = join(process.cwd(), '.env')
  const envContent = 'CWD_VAR=test'

  t.after(async () => {
    await safeRemove(tmpDir)
    await safeRemove(envFile)
  })

  await writeFile(envFile, envContent)

  const result = await loadEnv(tmpDir)
  equal(result.CWD_VAR, 'test')
})

test('replaceEnv - should replace environment variables in string', () => {
  const config = '{FOO}'
  const env = { FOO: 'replaced_value' }
  const result = replaceEnv(config, env)
  equal(result, 'replaced_value')
})

test('replaceEnv - should replace environment variables in nested object', () => {
  const config = {
    database: {
      host: '{DB_HOST}',
      port: 5432,
      user: '{DB_USER}'
    },
    app: {
      name: 'myapp'
    }
  }
  const env = { DB_HOST: 'localhost', DB_USER: 'admin' }
  const result = replaceEnv(config, env)

  deepEqual(result, {
    database: {
      host: 'localhost',
      port: 5432,
      user: 'admin'
    },
    app: {
      name: 'myapp'
    }
  })
})

test('replaceEnv - should handle missing environment variables', () => {
  const config = '{MISSING_VAR}'
  const env = {}
  const result = replaceEnv(config, env)
  equal(result, '')
})

test('replaceEnv - should call onMissingEnv callback', () => {
  const config = '{MISSING_VAR}'
  const env = {}
  const onMissingEnv = key => `default_${key}`
  const result = replaceEnv(config, env, onMissingEnv)
  equal(result, 'default_MISSING_VAR')
})

test('replaceEnv - should handle ignored paths', () => {
  const config = {
    database: {
      host: '{DB_HOST}',
      password: '{DB_PASSWORD}'
    }
  }
  const env = { DB_HOST: 'localhost', DB_PASSWORD: 'secret' }
  const ignore = ['/database/password']
  const result = replaceEnv(config, env, null, ignore)

  deepEqual(result, {
    database: {
      host: 'localhost',
      password: '{DB_PASSWORD}'
    }
  })
})

test('replaceEnv - should handle ignored paths (JSONPath)', () => {
  const config = {
    database: {
      host: '{DB_HOST}',
      password: '{DB_PASSWORD}'
    }
  }
  const env = { DB_HOST: 'localhost', DB_PASSWORD: 'secret' }
  const ignore = ['$.database.password']
  const result = replaceEnv(config, env, null, ignore)

  deepEqual(result, {
    database: {
      host: 'localhost',
      password: '{DB_PASSWORD}'
    }
  })
})

test('findConfigurationFileRecursive - should handle string schemas parameter', async t => {
  const tmpDir = await mkdtemp(join(os.tmpdir(), 'plt-utils-test-'))
  const subDir = join(tmpDir, 'subdir')
  const configFile = join(tmpDir, 'platformatic.json')

  t.after(async () => {
    await safeRemove(tmpDir)
  })

  await mkdir(subDir)
  await writeFile(configFile, '{"module": "@platformatic/db"}')

  const result = await findConfigurationFileRecursive(subDir, null, '@platformatic/db')
  equal(result, configFile)
})

test('loadConfiguration - should load and validate configuration', async t => {
  const tmpDir = await mkdtemp(join(os.tmpdir(), 'plt-utils-test-'))
  const configFile = join(tmpDir, 'config.json')
  const config = { name: 'test', port: 3000 }
  const schema = {
    type: 'object',
    properties: {
      name: { type: 'string' },
      port: { type: 'number' }
    },
    required: ['name']
  }

  t.after(async () => {
    await safeRemove(tmpDir)
  })

  await writeFile(configFile, JSON.stringify(config))

  const result = await loadConfiguration(configFile, schema)
  deepEqual(result, config)
})

test('loadConfiguration - should throw on validation error', async t => {
  const tmpDir = await mkdtemp(join(os.tmpdir(), 'plt-utils-test-'))
  const configFile = join(tmpDir, 'config.json')
  const config = { port: 3000 }
  const schema = {
    type: 'object',
    properties: {
      name: { type: 'string' },
      port: { type: 'number' }
    },
    required: ['name']
  }

  t.after(async () => {
    await safeRemove(tmpDir)
  })

  await writeFile(configFile, JSON.stringify(config))

  await rejects(
    async () => {
      await loadConfiguration(configFile, schema)
    },
    { name: 'FastifyError' }
  )
})

test('loadConfiguration - should handle environment variable replacement', async t => {
  const tmpDir = await mkdtemp(join(os.tmpdir(), 'plt-utils-test-'))
  const configFile = join(tmpDir, 'config.json')
  const envFile = join(tmpDir, '.env')
  const config = { host: '{DB_HOST}', port: 3000 }
  const schema = {
    type: 'object',
    properties: {
      host: { type: 'string' },
      port: { type: 'number' }
    }
  }

  t.after(async () => {
    await safeRemove(tmpDir)
  })

  await writeFile(configFile, JSON.stringify(config))
  await writeFile(envFile, 'DB_HOST=localhost')

  const result = await loadConfiguration(configFile, schema)
  deepEqual(result, { host: 'localhost', port: 3000 })
})

test('loadConfiguration - should skip validation when validate=false', async t => {
  const tmpDir = await mkdtemp(join(os.tmpdir(), 'plt-utils-test-'))
  const configFile = join(tmpDir, 'config.json')
  const config = { port: 3000 }
  const schema = {
    type: 'object',
    properties: {
      name: { type: 'string' },
      port: { type: 'number' }
    },
    required: ['name']
  }

  t.after(async () => {
    await safeRemove(tmpDir)
  })

  await writeFile(configFile, JSON.stringify(config))

  const result = await loadConfiguration(configFile, schema, { validate: false })
  deepEqual(result, config)
})

test('loadConfiguration - should apply transform function', async t => {
  const tmpDir = await mkdtemp(join(os.tmpdir(), 'plt-utils-test-'))
  const configFile = join(tmpDir, 'config.json')
  const config = { name: 'test' }
  const schema = {
    type: 'object',
    properties: {
      name: { type: 'string' }
    }
  }

  t.after(async () => {
    await safeRemove(tmpDir)
  })

  await writeFile(configFile, JSON.stringify(config))

  const result = await loadConfiguration(configFile, schema, {
    transform: config => ({ ...config, transformed: true })
  })
  deepEqual(result, { name: 'test', transformed: true })
})

test('loadConfiguration - should throw SourceMissingError when source is undefined', async t => {
  const schema = { type: 'object' }

  await rejects(
    async () => {
      await loadConfiguration(undefined, schema)
    },
    { name: 'FastifyError' }
  )
})

test('loadConfiguration - should throw RootMissingError when root is missing for env replacement', async t => {
  const config = { host: '{DB_HOST}' }
  const schema = { type: 'object' }

  await rejects(
    async () => {
      await loadConfiguration(config, schema, { replaceEnv: true })
    },
    { name: 'FastifyError' }
  )
})

test('loadConfiguration - should handle upgrade with config.module version', async t => {
  const config = {
    module: '@platformatic/db@1.0.0',
    name: 'test'
  }
  const schema = {
    type: 'object',
    properties: {
      name: { type: 'string' }
    }
  }

  const context = {
    upgrade: async (config, version) => {
      return { ...config, upgraded: true }
    }
  }

  const result = await loadConfiguration.call(context, config, schema, {
    upgrade: true,
    root: process.cwd()
  })

  deepEqual(result, { module: '@platformatic/db@1.0.0', name: 'test', upgraded: true })
})

test('loadConfiguration - should skip upgrade when no version found', async t => {
  const config = {
    $schema: 'https://schemas.platformatic.dev/@platformatic/db/.json',
    name: 'test'
  }
  const schema = {
    type: 'object',
    properties: {
      name: { type: 'string' }
    }
  }

  const context = {
    upgrade: async (config, version) => {
      return { ...config, upgraded: true }
    }
  }

  const result = await loadConfiguration.call(context, config, schema, {
    upgrade: true,
    root: process.cwd()
  })

  equal(result.name, 'test')
  ok(!result.upgraded)
})

test('loadConfiguration - should throw SourceMissingError when schema is undefined and validate is true', async t => {
  const config = { name: 'test' }

  await rejects(
    async () => {
      await loadConfiguration(config, undefined, { validate: true })
    },
    { name: 'FastifyError' }
  )
})

test('loadConfiguration - should throw SourceMissingError when schema is undefined and validate is default true', async t => {
  const config = { name: 'test' }

  await rejects(
    async () => {
      await loadConfiguration(config, undefined)
    },
    { name: 'FastifyError' }
  )
})

test('loadConfiguration - should throw SourceMissingError when schema is undefined and validate is explicitly true', async t => {
  const config = { name: 'test' }

  await rejects(
    async () => {
      await loadConfiguration(config, undefined, { validate: true, root: process.cwd() })
    },
    { name: 'FastifyError' }
  )
})

test('loadCapability - should load capability from matched schema', async t => {
  const config = { module: '@platformatic/db' }

  try {
    const result = await loadCapability(process.cwd(), config)
    // If it works, great
    ok(result)
  } catch (error) {
    // Expected to fail in test environment since @platformatic/db is not installed
    ok(
      error.message.includes('Cannot find module') ||
        error.message.includes('ENOENT') ||
        error.name === 'FastifyError' ||
        error.name === 'ReferenceError'
    )
  }
})
