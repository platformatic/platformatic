const { fileURLToPath } = require('node:url')

async function loadModule (require, path) {
  if (path.startsWith('file://')) {
    path = fileURLToPath(path)
  }

  let mod
  try {
    mod = require(path)
  } catch (err) {
    if (err.code === 'ERR_REQUIRE_ESM') {
      const toLoad = require.resolve(path)
      mod = await import('file://' + toLoad)
    } else {
      throw err
    }
  }

  return mod?.default ?? mod
}

module.exports = { loadModule }
