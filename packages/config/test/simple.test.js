'use strict'

const { test } = require('node:test')
const assert = require('node:assert/strict')
const { tmpdir } = require('node:os')
const { join, dirname } = require('node:path')
const { mkdtemp, writeFile, readFile } = require('node:fs/promises')
const { findConfigurationFile, loadConfigurationFile, saveConfigurationFile } = require('../lib/simple')
const { getParser } = require('../lib/formats')
const { saveConfigToFile } = require('./helper')

test('findConfigurationFile finds a configuration file', async (t) => {
  const config = { hello: 'world', $schema: 'https://platformatic.dev/schemas/v1.0.0/service' }
  const targetFile = await saveConfigToFile(config)
  const configDir = dirname(targetFile)

  const found = await findConfigurationFile(configDir, null, null, ['platformatic.json'])
  assert.equal(found, targetFile)
})

test('findConfigurationFile returns null if no file found', async (t) => {
  const tempDir = await mkdtemp(join(tmpdir(), 'plt-config-test-'))

  const found = await findConfigurationFile(tempDir, null, 'service')
  assert.equal(found, null)
})

test('findConfigurationFile with specified file path', async (t) => {
  const config = { hello: 'world', $schema: 'https://platformatic.dev/schemas/v1.0.0/service' }
  const targetFile = await saveConfigToFile(config, 'custom-config.json')
  const configDir = dirname(targetFile)

  const found = await findConfigurationFile(configDir, 'custom-config.json', 'service')
  assert.equal(found, targetFile)
})

test('findConfigurationFile with schema validation', async (t) => {
  const config = { hello: 'world', $schema: 'https://platformatic.dev/schemas/v1.0.0/service' }
  const targetFile = await saveConfigToFile(config)
  const configDir = dirname(targetFile)

  // Should find with matching schema
  const found = await findConfigurationFile(configDir, null, 'service')
  assert.equal(found, targetFile)

  // Should not find with non-matching schema
  const notFound = await findConfigurationFile(configDir, null, 'https://platformatic.dev/schemas/v1.0.0/db')
  assert.equal(notFound, null)
})

test('findConfigurationFile with multiple schemas', async (t) => {
  const config = { hello: 'world', $schema: 'https://platformatic.dev/schemas/v1.0.0/service' }
  const targetFile = await saveConfigToFile(config)
  const configDir = dirname(targetFile)

  const found = await findConfigurationFile(configDir, null, ['db', 'service'])
  assert.equal(found, targetFile)
})

test('loadConfigurationFile loads and parses config file', async (t) => {
  const config = { hello: 'world', nested: { value: 42 } }
  const targetFile = await saveConfigToFile(config)

  const loaded = await loadConfigurationFile(targetFile)
  assert.deepEqual(loaded, config)
})

test('loadConfigurationFile handles different file formats', async (t) => {
  // Test with JSON5
  const configJSON5 = { hello: 'world', nested: { value: 42 } }
  const targetFileJSON5 = await saveConfigToFile(configJSON5, 'config.json5')

  const loadedJSON5 = await loadConfigurationFile(targetFileJSON5)
  assert.deepEqual(loadedJSON5, configJSON5)

  // Test with YAML
  const configYAML = { hello: 'world', nested: { value: 42 } }
  const tempDirYAML = await mkdtemp(join(tmpdir(), 'plt-config-test-'))
  const targetFileYAML = join(tempDirYAML, 'config.yaml')
  const yamlContent = 'hello: world\nnested:\n  value: 42'
  await writeFile(targetFileYAML, yamlContent)

  const loadedYAML = await loadConfigurationFile(targetFileYAML)
  assert.deepEqual(loadedYAML, configYAML)
})

test('saveConfigurationFile saves config to file', async (t) => {
  const config = { hello: 'world', nested: { value: 42 } }
  const tempDir = await mkdtemp(join(tmpdir(), 'plt-config-test-'))
  const targetFile = join(tempDir, 'config.json')

  await saveConfigurationFile(targetFile, config)

  const parser = getParser(targetFile)
  const content = await readFile(targetFile, 'utf-8')
  const loaded = parser(content)

  assert.deepEqual(loaded, config)
})

test('saveConfigurationFile with different file formats', async (t) => {
  const config = { hello: 'world', nested: { value: 42 } }

  // Test with YAML
  const tempDirYAML = await mkdtemp(join(tmpdir(), 'plt-config-test-'))
  const targetFileYAML = join(tempDirYAML, 'config.yaml')

  await saveConfigurationFile(targetFileYAML, config)

  const yamlParser = getParser(targetFileYAML)
  const yamlContent = await readFile(targetFileYAML, 'utf-8')
  const loadedYAML = yamlParser(yamlContent)

  assert.deepEqual(loadedYAML, config)
})
