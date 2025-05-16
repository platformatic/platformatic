'use strict'

const { writeFile } = require('node:fs/promises')
const { getStringifier } = require('./formats')

function saveConfigurationFile (configurationFile, config) {
  const stringifyConfig = getStringifier(configurationFile)

  return writeFile(configurationFile, stringifyConfig(config), 'utf-8')
}

module.exports = {
  saveConfigurationFile
}
