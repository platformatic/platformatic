'use strict'

const { test } = require('node:test')
const assert = require('node:assert/strict')
const { tmpdir } = require('node:os')
const { join } = require('node:path')
const { mkdtemp, readFile } = require('node:fs/promises')
const { saveConfigurationFile } = require('../lib/save-config')
const { getParser } = require('../lib/formats')

test('saveConfigurationFile saves config to file', async t => {
  const config = { hello: 'world', nested: { value: 42 } }
  const tempDir = await mkdtemp(join(tmpdir(), 'plt-config-test-'))
  const targetFile = join(tempDir, 'config.json')

  await saveConfigurationFile(targetFile, config)

  const parser = getParser(targetFile)
  const content = await readFile(targetFile, 'utf-8')
  const loaded = parser(content)

  assert.deepEqual(loaded, config)
})

test('saveConfigurationFile with different file formats', async t => {
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
