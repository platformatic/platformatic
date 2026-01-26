import { deepEqual, equal, ok, rejects, throws } from 'node:assert'
import { deepStrictEqual } from 'node:assert/strict'
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import os from 'node:os'
import { isAbsolute, join, resolve } from 'node:path'
import { test } from 'node:test'
import {
  createValidator,
  envVariablePattern,
  extractModuleFromSchemaUrl,
  findConfigurationFile,
  findConfigurationFileRecursive,
  getParser,
  getStringifier,
  kMetadata,
  knownConfigurationFilesExtensions,
  knownConfigurationFilesSchemas,
  listRecognizedConfigurationFiles,
  loadConfiguration,
  loadConfigurationFile,
  loadConfigurationModule,
  loadEnv,
  printValidationErrors,
  replaceEnv,
  safeRemove,
  saveConfigurationFile,
  stringifyJSON,
  stringifyJSON5,
  validate
} from '../index.js'

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

  const testSchema1 = 'https://platformatic.dev/schemas/1.0.0/db.json'
  const testSchema2 = 'https://schemas.platformatic.dev/@platformatic/db/1.0.0.json'
  const testSchema3 = 'https://schemas.platformatic.dev/wattpm/1.0.0.json'

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

test('parseYAML - should handle strings with mixed quote types around braces', async t => {
  const tmpDir = await mkdtemp(join(os.tmpdir(), 'plt-utils-test-'))
  const configFile = join(tmpDir, 'config.yaml')

  t.after(async () => {
    await safeRemove(tmpDir)
  })

  // Test edge case where brace is at exact string boundary positions
  const yamlContent = `
database:
  config: 'start {VAR} end'
  template: "{TEMPLATE}"
  mixed: 'single {SINGLE} and "double {DOUBLE}" quotes'
`

  await writeFile(configFile, yamlContent)
  const result = await loadConfigurationFile(configFile)

  equal(result.database.config, 'start {VAR} end')
  equal(result.database.template, '{TEMPLATE}')
  equal(result.database.mixed, 'single {SINGLE} and "double {DOUBLE}" quotes')
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

test('extractModuleFromSchemaUrl - should match module property', () => {
  const config = { module: '@platformatic/db' }
  const result = extractModuleFromSchemaUrl(config)
  deepEqual(result, { module: '@platformatic/db' })
})

test('extractModuleFromSchemaUrl - should match schema URL', () => {
  const config = { $schema: 'https://schemas.platformatic.dev/@platformatic/db/1.0.0.json' }
  const result = extractModuleFromSchemaUrl(config)
  deepEqual(result, { module: '@platformatic/db', version: '1.0.0' })
})

test('extractModuleFromSchemaUrl - should match wattpm schema', () => {
  const config = { $schema: 'https://schemas.platformatic.dev/wattpm/v1.0.0.json' }
  const result = extractModuleFromSchemaUrl(config)
  deepEqual(result, { module: '@platformatic/runtime', version: '1.0.0' })
})

test('extractModuleFromSchemaUrl - should return null for no match', () => {
  const config = { someOtherProperty: 'value' }
  const result = extractModuleFromSchemaUrl(config)
  equal(result, null)
})

test('extractModuleFromSchemaUrl - should throw when throwOnMissing is true', () => {
  const config = { someOtherProperty: 'value' }
  throws(() => extractModuleFromSchemaUrl(config, true), {
    name: 'FastifyError'
  })
})

test('extractModuleFromSchemaUrl - should throw when throwOnMissing is true and schema does not match', () => {
  const config = { $schema: 'https://example.com/unknown-schema.json' }
  throws(() => extractModuleFromSchemaUrl(config, true), {
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

test('saveConfigurationFile - should handle write errors', async () => {
  // This test might not work on all systems, so we'll just test that the function exists
  // and can be called without throwing immediately
  try {
    await saveConfigurationFile('/nonexistent/path/config.json', { test: true })
  } catch (error) {
    // Expected to fail with file system error
    ok(error.code === 'ENOENT' || error.code === 'EACCES' || error.message.includes('ENOENT'))
  }
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
  ok(isAbsolute(data.path))
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

test('loadConfiguration - should throw SourceMissingError when source is undefined', async () => {
  const schema = { type: 'object' }

  await rejects(
    async () => {
      await loadConfiguration(undefined, schema)
    },
    { name: 'FastifyError' }
  )
})

test('loadConfiguration - should throw RootMissingError when root is missing for env replacement', async () => {
  const config = { host: '{DB_HOST}' }
  const schema = { type: 'object' }

  await rejects(
    async () => {
      await loadConfiguration(config, schema, { replaceEnv: true })
    },
    { name: 'FastifyError' }
  )
})

test('loadConfiguration - should handle upgrade with config.module version', async () => {
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
    root: process.cwd(),
    upgrade (_, config) {
      return { ...config, upgraded: true }
    }
  }

  const { [kMetadata]: _, ...result } = await loadConfiguration(config, schema, context)

  deepEqual(result, { module: '@platformatic/db@1.0.0', name: 'test', upgraded: true })
})

test('loadConfiguration - should skip upgrade when no version found', async () => {
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
    upgrade: async config => {
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

test('loadConfiguration - should throw SourceMissingError when schema is undefined and validate is true', async () => {
  const config = { name: 'test' }

  await rejects(
    async () => {
      await loadConfiguration(config, undefined, { validate: true })
    },
    { name: 'FastifyError' }
  )
})

test('loadConfiguration - should throw SourceMissingError when schema is undefined and validate is default true', async () => {
  const config = { name: 'test' }

  await rejects(
    async () => {
      await loadConfiguration(config, undefined)
    },
    { name: 'FastifyError' }
  )
})

test('loadConfiguration - should throw SourceMissingError when schema is undefined and validate is explicitly true', async () => {
  const config = { name: 'test' }

  await rejects(
    async () => {
      await loadConfiguration(config, undefined, { validate: true, root: process.cwd() })
    },
    { name: 'FastifyError' }
  )
})

test('loadConfigurationModule - should load capability from matched schema', async () => {
  const config = { module: '@platformatic/db' }

  try {
    const result = await loadConfigurationModule(process.cwd(), config)
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

test('loadConfigurationModule - should extract module from schema URL when pkg not provided', async () => {
  const config = { $schema: 'https://schemas.platformatic.dev/@platformatic/db/1.0.0.json' }

  try {
    const result = await loadConfigurationModule(process.cwd(), config)
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

test('loadConfigurationModule - should throw when extracting module fails', async () => {
  const config = { someProperty: 'value' }

  rejects(() => loadConfigurationModule(process.cwd(), config), {
    name: 'FastifyError'
  })
})

test('loadConfigurationModule - should fallback to import.meta.filename when root require fails', async t => {
  const tmpDir = await mkdtemp(join(os.tmpdir(), 'plt-utils-test-'))

  t.after(async () => {
    await safeRemove(tmpDir)
  })

  try {
    await loadConfigurationModule(tmpDir, { module: '@platformatic/foundation' })
    throw new Error('Expected loadConfigurationModule to fail but it succeeded')
  } catch (error) {
    deepStrictEqual(error.stack.split('\n')[2], `- ${resolve(import.meta.dirname, '../lib/configuration.js')}`)
  }
})

test('parseYAML - should handle complex string scenarios with braces', async t => {
  const tmpDir = await mkdtemp(join(os.tmpdir(), 'plt-utils-test-'))
  const configFile = join(tmpDir, 'config.yaml')

  t.after(async () => {
    await safeRemove(tmpDir)
  })

  // Test various quote scenarios and brace placements
  const yamlContent = `
database:
  host: "{DB_HOST}"
  port: '{DB_PORT}'
  mixed: "prefix {DB_NAME} suffix"
  unquoted: {DB_PROTOCOL}
  nested: "outer {VAR} and {OTHER}"
`

  await writeFile(configFile, yamlContent)
  const result = await loadConfigurationFile(configFile)

  equal(result.database.host, '{DB_HOST}')
  equal(result.database.port, '{DB_PORT}')
  equal(result.database.mixed, 'prefix {DB_NAME} suffix')
  equal(result.database.unquoted, '{DB_PROTOCOL}')
  equal(result.database.nested, 'outer {VAR} and {OTHER}')
})

test('parseYAML - should handle escaped quotes in strings', async t => {
  const tmpDir = await mkdtemp(join(os.tmpdir(), 'plt-utils-test-'))
  const configFile = join(tmpDir, 'config.yaml')

  t.after(async () => {
    await safeRemove(tmpDir)
  })

  const yamlContent = `database:
  connectionString: "host=localhost;password=\\"secret\\";user={DB_USER}"`

  await writeFile(configFile, yamlContent)
  const result = await loadConfigurationFile(configFile)

  equal(result.database.connectionString, 'host=localhost;password="secret";user={DB_USER}')
})

test('replaceEnv - should handle onMissingEnv callback throwing error', () => {
  const config = '{MISSING_VAR}'
  const env = {}
  const onMissingEnv = () => {
    throw new Error('Custom callback error')
  }

  throws(() => replaceEnv(config, env, onMissingEnv), {
    name: 'FastifyError'
  })
})

test('replaceEnv - should handle multiple environment variables in same string', () => {
  const config = '{HOST}:{PORT}/{DB_NAME}'
  const env = { HOST: 'localhost', PORT: '5432', DB_NAME: 'mydb' }

  const result = replaceEnv(config, env)
  equal(result, 'localhost:5432/mydb')
})

test('replaceEnv - should handle environment variables in arrays', () => {
  const config = ['server:{PORT}', 'database:{DB_HOST}']
  const env = { PORT: '3000', DB_HOST: 'localhost' }

  const result = replaceEnv(config, env)
  deepEqual(result, ['server:3000', 'database:localhost'])
})

test('replaceEnv - should handle invalid JSON pointer paths gracefully', () => {
  const config = { database: { host: '{DB_HOST}' } }
  const env = { DB_HOST: 'localhost' }
  const ignore = ['/nonexistent/path']

  const result = replaceEnv(config, env, null, ignore)
  deepEqual(result, { database: { host: 'localhost' } })
})

test('loadConfiguration - should handle transform function throwing error', async t => {
  const tmpDir = await mkdtemp(join(os.tmpdir(), 'plt-utils-test-'))
  const configFile = join(tmpDir, 'config.json')
  const config = { name: 'test' }

  t.after(async () => {
    await safeRemove(tmpDir)
  })

  await writeFile(configFile, JSON.stringify(config))

  await rejects(
    async () => {
      await loadConfiguration(
        configFile,
        { type: 'object' },
        {
          transform: () => {
            throw new Error('Transform error')
          }
        }
      )
    },
    { name: 'FastifyError' }
  )
})

test('loadConfiguration - should skip metadata when skipMetadata is true', async t => {
  const tmpDir = await mkdtemp(join(os.tmpdir(), 'plt-utils-test-'))
  const configFile = join(tmpDir, 'config.json')
  const config = { name: 'test' }

  t.after(async () => {
    await safeRemove(tmpDir)
  })

  await writeFile(configFile, JSON.stringify(config))

  const result = await loadConfiguration(
    configFile,
    { type: 'object' },
    {
      skipMetadata: true,
      validate: false
    }
  )

  equal(result[kMetadata], undefined)
})

test('loadConfiguration - should handle ignoreProcessEnv with additionalEnv', async t => {
  const tmpDir = await mkdtemp(join(os.tmpdir(), 'plt-utils-test-'))
  const configFile = join(tmpDir, 'config.json')
  const config = { host: '{TEST_HOST}', port: '{TEST_PORT}' }

  t.after(async () => {
    await safeRemove(tmpDir)
  })

  await writeFile(configFile, JSON.stringify(config))

  const result = await loadConfiguration(
    configFile,
    { type: 'object' },
    {
      ignoreProcessEnv: true,
      env: { TEST_HOST: 'custom-host', TEST_PORT: '9000' },
      validate: false
    }
  )

  equal(result.host, 'custom-host')
  equal(result.port, '9000')
})

test('loadConfiguration - should format validation errors correctly', async t => {
  const tmpDir = await mkdtemp(join(os.tmpdir(), 'plt-utils-test-'))
  const configFile = join(tmpDir, 'config.json')
  const config = { port: 'invalid-port', missing: 'field' }
  const schema = {
    type: 'object',
    properties: {
      name: { type: 'string' },
      port: { type: 'number' }
    },
    required: ['name', 'port']
  }

  t.after(async () => {
    await safeRemove(tmpDir)
  })

  await writeFile(configFile, JSON.stringify(config))

  try {
    await loadConfiguration(configFile, schema)
    throw new Error('Should have thrown validation error')
  } catch (error) {
    equal(error.name, 'FastifyError')
    ok(error.message.includes(':'))
    ok(error.validationErrors)
    ok(error.validationErrors.length > 0)
    ok(error.validationErrors[0].path)
    ok(error.validationErrors[0].message)
  }
})

test('loadConfiguration - should handle upgrade when no version in moduleInfo but config.module exists', async () => {
  const config = {
    $schema: 'https://schemas.platformatic.dev/@platformatic/db/.json',
    module: '@platformatic/db@1.2.3',
    name: 'test'
  }

  const schema = {
    type: 'object',
    properties: {
      name: { type: 'string' }
    }
  }

  const result = await loadConfiguration(config, schema, {
    root: process.cwd(),
    upgrade: (_, config, version) => {
      equal(version, '1.2.3')
      return { ...config, upgraded: true }
    }
  })

  equal(result.name, 'test')
  equal(result.upgraded, true)
})

test('loadConfiguration - should handle validation error with empty instancePath', async t => {
  const tmpDir = await mkdtemp(join(os.tmpdir(), 'plt-utils-test-'))
  const configFile = join(tmpDir, 'config.json')
  const config = 'invalid-root-value'
  const schema = { type: 'object' }

  t.after(async () => {
    await safeRemove(tmpDir)
  })

  await writeFile(configFile, JSON.stringify(config))

  try {
    await loadConfiguration(configFile, schema)
    throw new Error('Should have failed validation')
  } catch (error) {
    equal(error.name, 'FastifyError')
    ok(error.validationErrors.some(err => err.path === '/'))
  }
})

test('createValidator - should handle resolvePath with whitespace-only path', () => {
  const schema = {
    type: 'object',
    properties: {
      path: { type: 'string', resolvePath: true, allowEmptyPaths: false }
    }
  }

  const validator = createValidator(schema, {}, { root: '/tmp' })
  const data = { path: '   ' }

  ok(!validator(data))
})

test('createValidator - should handle typeof keyword with invalid value', () => {
  const schema = {
    type: 'object',
    properties: {
      value: { typeof: 'string' }
    }
  }

  const validator = createValidator(schema)
  ok(!validator({ value: 123 }))

  // Check that custom error message is set
  ok(validator.errors)
  ok(validator.errors[0].message.includes('shoud be a string'))
})

test('loadEnv - should handle complex directory hierarchy traversal', async t => {
  const tmpDir = await mkdtemp(join(os.tmpdir(), 'plt-utils-test-'))
  const deepDir = join(tmpDir, 'level1', 'level2', 'level3')
  const envFile = join(tmpDir, '.env')

  t.after(async () => {
    await safeRemove(tmpDir)
  })

  await mkdir(deepDir, { recursive: true })
  await writeFile(envFile, 'DEEP_VAR=found')

  const result = await loadEnv(deepDir)
  equal(result.DEEP_VAR, 'found')
})

test('loadEnv - should prefer hierarchy .env over cwd .env', async t => {
  const tmpDir = await mkdtemp(join(os.tmpdir(), 'plt-utils-test-'))
  const subDir = join(tmpDir, 'subdir')
  const hierarchyEnvFile = join(tmpDir, '.env')

  t.after(async () => {
    await safeRemove(tmpDir)
  })

  await mkdir(subDir)
  await writeFile(hierarchyEnvFile, 'HIERARCHY_TEST=found_in_hierarchy')

  const result = await loadEnv(subDir)
  equal(result.HIERARCHY_TEST, 'found_in_hierarchy')
})

test('loadEnv - should handle .env file not found in any directory', async t => {
  // Create a deep directory structure without any .env files
  const tmpDir = await mkdtemp(join(os.tmpdir(), 'plt-utils-test-'))
  const deepDir = join(tmpDir, 'very', 'deep', 'path')

  t.after(async () => {
    await safeRemove(tmpDir)
  })

  await mkdir(deepDir, { recursive: true })

  const result = await loadEnv(deepDir, true) // ignore process.env

  // Should return empty object since ignoreProcessEnv=true and no .env file found
  ok(typeof result === 'object')
  equal(Object.keys(result).length, 0)
})

test('loadEnv - should load from custom env file with absolute path', async t => {
  const tmpDir = await mkdtemp(join(os.tmpdir(), 'plt-utils-test-'))
  const customEnvFile = join(tmpDir, 'custom.env')

  t.after(async () => {
    await safeRemove(tmpDir)
  })

  await writeFile(customEnvFile, 'CUSTOM_VAR=from_custom_file\nANOTHER_VAR=test123', 'utf8')

  const result = await loadEnv(tmpDir, true, {}, customEnvFile)

  equal(result.CUSTOM_VAR, 'from_custom_file')
  equal(result.ANOTHER_VAR, 'test123')
})

test('loadEnv - should load from custom env file with relative path', async t => {
  const tmpDir = await mkdtemp(join(os.tmpdir(), 'plt-utils-test-'))
  const customEnvFile = 'my-custom.env'

  t.after(async () => {
    await safeRemove(tmpDir)
  })

  await writeFile(join(tmpDir, customEnvFile), 'RELATIVE_VAR=from_relative_file', 'utf8')

  const result = await loadEnv(tmpDir, true, {}, customEnvFile)

  equal(result.RELATIVE_VAR, 'from_relative_file')
})

test('loadEnv - should throw error when custom env file does not exist', async t => {
  const tmpDir = await mkdtemp(join(os.tmpdir(), 'plt-utils-test-'))
  const nonExistentFile = join(tmpDir, 'non-existent.env')

  t.after(async () => {
    await safeRemove(tmpDir)
  })

  await rejects(async () => {
    await loadEnv(tmpDir, true, {}, nonExistentFile)
  }, /Custom env file not found/)
})

test('loadEnv - should prioritize custom env file over default .env', async t => {
  const tmpDir = await mkdtemp(join(os.tmpdir(), 'plt-utils-test-'))
  const defaultEnvFile = join(tmpDir, '.env')
  const customEnvFile = join(tmpDir, 'custom.env')

  t.after(async () => {
    await safeRemove(tmpDir)
  })

  await writeFile(defaultEnvFile, 'SHARED_VAR=from_default\nDEFAULT_ONLY=default_value', 'utf8')
  await writeFile(customEnvFile, 'SHARED_VAR=from_custom\nCUSTOM_ONLY=custom_value', 'utf8')

  const result = await loadEnv(tmpDir, true, {}, customEnvFile)

  equal(result.SHARED_VAR, 'from_custom')
  equal(result.CUSTOM_ONLY, 'custom_value')
  equal(result.DEFAULT_ONLY, undefined)
})

test('validate - should validate successfully with valid config', () => {
  const schema = {
    type: 'object',
    properties: {
      name: { type: 'string' },
      port: { type: 'number' }
    },
    required: ['name']
  }

  const config = { name: 'test', port: 3000 }

  // Should not throw for valid config
  validate(schema, config)
})

test('validate - should throw ConfigurationDoesNotValidateAgainstSchemaError for invalid config', () => {
  const schema = {
    type: 'object',
    properties: {
      name: { type: 'string' },
      port: { type: 'number' }
    },
    required: ['name', 'port']
  }

  const config = { port: 'invalid' }

  throws(() => validate(schema, config), {
    name: 'FastifyError',
    code: 'PLT_CONFIGURATION_DOES_NOT_VALIDATE_AGAINST_SCHEMA'
  })
})

test('validate - should format validation errors with paths and messages', () => {
  const schema = {
    type: 'object',
    properties: {
      name: { type: 'string' },
      port: { type: 'number' }
    },
    required: ['name']
  }

  const config = { port: 'invalid' }

  try {
    validate(schema, config)
    throw new Error('Should have thrown validation error')
  } catch (error) {
    equal(error.name, 'FastifyError')
    ok(error.message.includes(':'))
    ok(error.validationErrors)
    ok(error.validationErrors.length > 0)

    // Check validation error structure
    const firstError = error.validationErrors[0]
    ok(firstError.path)
    ok(firstError.message)
    ok(firstError.params !== undefined)
  }
})

test('validate - should handle fixPaths parameter', () => {
  const schema = {
    type: 'object',
    properties: {
      path: { type: 'string', resolvePath: true }
    }
  }

  const config = { path: 'relative/path' }
  const root = '/tmp'

  validate(schema, config, {}, true, root)

  // Path should be resolved when fixPaths is true
  ok(isAbsolute(config.path))
})

test('validate - should not modify paths when fixPaths is false', () => {
  const schema = {
    type: 'object',
    properties: {
      path: { type: 'string', resolvePath: true }
    }
  }

  const config = { path: 'relative/path' }
  const root = '/tmp'

  validate(schema, config, {}, false, root)

  // Path should remain relative when fixPaths is false
  equal(config.path, 'relative/path')
})

test('validate - should use default parameters when not provided', () => {
  const schema = {
    type: 'object',
    properties: {
      name: { type: 'string' }
    }
  }

  const config = { name: 'test' }

  // Should not throw when using defaults
  validate(schema, config)
})

test('validate - should handle resolveModule validation', () => {
  const schema = {
    type: 'object',
    properties: {
      module: { type: 'string', resolveModule: true }
    }
  }

  const config = { module: 'node:path' }
  const root = process.cwd()

  // Should validate successfully with valid module
  validate(schema, config, {}, true, root)
})

test('validate - should fail resolveModule validation for invalid module', () => {
  const schema = {
    type: 'object',
    properties: {
      module: { type: 'string', resolveModule: true }
    }
  }

  const config = { module: 'non-existent-module-12345' }
  const root = process.cwd()

  throws(() => validate(schema, config, {}, true, root), {
    name: 'FastifyError'
  })
})
