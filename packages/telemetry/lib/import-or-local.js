'use strict'

const { pathToFileURL } = require('node:url')
const { createRequire } = require('node:module')
const { join } = require('node:path')

async function importOrLocal ({ projectDir, pkg }) {
  try {
    return import(pkg)
  } catch (err) {
    const pkgJsonPath = join(projectDir, 'package.json')
    const _require = createRequire(pkgJsonPath)
    const fileToImport = _require.resolve(pkg)
    return import(pathToFileURL(fileToImport))
  }
}

module.exports = importOrLocal
