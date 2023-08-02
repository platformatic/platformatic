'use strict'
const os = require('os')
const { join } = require('path')
const { mkdtemp, writeFile } = require('fs/promises')

async function saveConfigToFile (config, filename = 'platformatic.json', serializer = JSON) {
  const tempDir = await mkdtemp(join(os.tmpdir(), 'plt-config-test-'))
  const targetFile = join(tempDir, filename)
  await writeFile(targetFile, serializer.stringify(config))
  return targetFile
}

module.exports = {
  saveConfigToFile
}
