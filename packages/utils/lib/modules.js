'use strict'

const { fileURLToPath } = require('node:url')
const kFailedImport = Symbol('plt.utils.failedImport')

async function loadModule (require, path) {
  if (path.startsWith('file://')) {
    path = fileURLToPath(path)
  }

  let loaded
  try {
    try {
      loaded = require(path)
    } catch (err) {
      if (err.code === 'ERR_REQUIRE_ESM') {
        const toLoad = require.resolve(path)
        loaded = await import('file://' + toLoad)
      } else {
        throw err
      }
    }
  } catch (err) {
    if (err.code === 'ERR_MODULE_NOT_FOUND' || err.code === 'MODULE_NOT_FOUND') {
      err[kFailedImport] = path
    }

    throw err
  }

  return loaded?.default ?? loaded
}

module.exports = { kFailedImport, loadModule }
