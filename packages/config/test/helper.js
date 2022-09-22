'use strict'
const os = require('os')
const { join } = require('path')
const { writeFile } = require('fs/promises')
function getTempFile (filename = 'platformatic.json') {
  return join(os.tmpdir(), filename)
}

async function saveConfigToFile (config, filename, serializer = JSON) {
  const targetFile = getTempFile(filename)
  await writeFile(targetFile, serializer.stringify(config))
  return targetFile
}

module.exports = {
  getTempFile,
  saveConfigToFile
}
