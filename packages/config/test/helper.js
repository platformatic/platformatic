'use strict'

const { tmpdir } = require('node:os')
const { join } = require('node:path')
const { mkdtemp, writeFile } = require('node:fs/promises')

async function saveConfigToFile (config, filename = 'platformatic.json', serializer = JSON) {
  const tempDir = await mkdtemp(join(tmpdir(), 'plt-config-test-'))
  const targetFile = join(tempDir, filename)
  await writeFile(targetFile, serializer.stringify(config))
  return targetFile
}

module.exports = {
  saveConfigToFile
}
