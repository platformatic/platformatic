const { pathToFileURL } = require('node:url')
const resolve = require('resolve')

async function importOrLocal ({ projectDir, pkg }) {
  try {
    return import(pkg)
  } catch (err) {
    const fileToImport = resolve.sync(pkg, { basedir: projectDir })
    return await import(pathToFileURL(fileToImport))
  }
}

module.exports = importOrLocal
