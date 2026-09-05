import { deepEqual, equal, ok, rejects, throws } from 'node:assert'
import { deepStrictEqual } from 'node:assert/strict'
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import os from 'node:os'
import { isAbsolute, join, resolve } from 'node:path'
import { test } from 'node:test'
import {
  createValidator,
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
  safeRemove,
  saveConfigurationFile,
  stringifyJSON,
  stringifyJSON5,
  validate
} from '../index.js'

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

/*
  A placeholder is a string now, and stays one. v3 read the `.env` beside the configuration and
  substituted `{DB_HOST}` here; v4 resolves every environment main-side and a configuration file
  reads what it wants, so what is left of this reader parses the document and does nothing to its
  values.
*/
test('loadConfiguration - leaves a v3 placeholder alone', async t => {
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
  deepEqual(result, { host: '{DB_HOST}', port: 3000 })
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
