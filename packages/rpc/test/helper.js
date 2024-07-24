'use strict'

const { join } = require('node:path')

async function generateSchema (schemaPath, tsConfigPath, options) {
  const { execa } = await import('execa')
  const executablePath = join(__dirname, '..', 'cli.js')

  const child = await execa('node', [
    executablePath,
    '--path', schemaPath,
    '--ts-config', tsConfigPath
  ], {
    cwd: options.cwd
  })

  return child
}

module.exports = { generateSchema }
