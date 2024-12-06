const { fileURLToPath } = require('node:url')

async function loadModule (require, path) {
  if (path.startsWith('file://')) {
    path = fileURLToPath(path)
  }

  try {
    return require(path)
  } catch (err) {
    if (err.code === 'ERR_REQUIRE_ESM') {
      const toLoad = require.resolve(path)
      return (await import('file://' + toLoad)).default
    } else {
      throw err
    }
  }
}

module.exports = { loadModule }
