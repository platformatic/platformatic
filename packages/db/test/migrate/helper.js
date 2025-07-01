'use strict'

const { resolve } = require('node:path')

const cliPath = resolve(__dirname, '../cli/executables/cli.js')

function getFixturesConfigFileLocation (filename, subdirectories = []) {
  return resolve(__dirname, '../cli/fixtures', ...subdirectories, filename).replace('file:', '')
}

module.exports = { cliPath, getFixturesConfigFileLocation }
