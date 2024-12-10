'use strict'

const { createRequire: nodeCreateRequire } = require('node:module')
const { basename, dirname, resolve: resolvePaths } = require('node:path')
const { fileURLToPath } = require('node:url')

// This is needed until https://github.com/nodejs/node/issues/55417 is sorted out
function createRequire (originalPath) {
  // Create a new path which includes node_modules to suppress the warning
  let noWarningPath = originalPath

  if (noWarningPath instanceof URL || noWarningPath.startsWith('file://')) {
    noWarningPath = fileURLToPath(noWarningPath)
  }

  if (!noWarningPath.includes('node_modules')) {
    const folder = dirname(noWarningPath)
    const name = basename(noWarningPath)

    noWarningPath = resolvePaths(folder, 'node_modules/platformatic', name)
  }

  const originalRequire = nodeCreateRequire(originalPath)
  const noWarningRequire = nodeCreateRequire(noWarningPath)

  const { cache, extensions, main, resolve: noWarningResolve } = noWarningRequire

  // Call the patched require function, it if fails faill back to the original one
  const require = function require (...args) {
    try {
      return noWarningRequire(...args)
    } catch (e) {
      return originalRequire(...args)
    }
  }

  // Call the patched require.resolve function, it if fails faill back to the original one
  const resolve = function require (...args) {
    try {
      return noWarningResolve(...args)
    } catch (e) {
      return originalRequire.resolve(...args)
    }
  }
  resolve.paths = noWarningResolve.paths

  // Assign other properties
  require.cache = cache
  require.extensions = extensions
  require.main = main
  require.resolve = resolve

  return require
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
