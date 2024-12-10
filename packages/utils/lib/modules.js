'use strict'

const { createRequire: nodeCreateRequire } = require('node:module')
const { basename, dirname, resolve } = require('node:path')
const { fileURLToPath } = require('node:url')

async function createRequire (path) {
  if (path instanceof URL) {
    path = fileURLToPath(path)
  }

  // This is needed until https://github.com/nodejs/node/issues/55417 is sorted out
  if (!path.includes('node_modules')) {
    const folder = dirname(path)
    const name = basename(path)

    path = resolve(folder, 'node_modules/platformatic', name)
  }

  return nodeCreateRequire(path)
}

async function loadModule (require, path) {
  if (path.startsWith('file://')) {
    path = fileURLToPath(path)
  }

  let loaded
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

  return loaded?.default ?? loaded
}

module.exports = { createRequire, loadModule }
