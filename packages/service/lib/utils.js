'use strict'

const { join, relative, dirname, basename, resolve } = require('node:path')
const { readFile, stat, access } = require('node:fs/promises')

let _isDocker

async function isDocker () {
  async function hasDockerEnv () {
    try {
      await stat('/.dockerenv')
      return true
    } catch {
      return false
    }
  }

  async function hasDockerCGroup () {
    try {
      return (await readFile('/proc/self/cgroup', 'utf8')).includes('docker')
    } catch {
      return false
    }
  }

  if (_isDocker === undefined) {
    _isDocker = await hasDockerEnv() || await hasDockerCGroup()
  }

  return _isDocker
}

async function isFileAccessible (filename, directory) {
  try {
    const filePath = directory ? resolve(directory, filename) : filename
    await access(filePath)
    return true
  } catch (err) {
    return false
  }
}

function getJSPluginPath (workingDir, tsPluginPath, compileDir) {
  if (tsPluginPath.endsWith('js')) {
    return tsPluginPath
  }

  if (tsPluginPath.indexOf(compileDir) === 0) {
    // In this case, we passed through this function before and we have adjusted
    // the path of the plugin to point to the dist/ folder. Then we restarted.
    // Therefore, we can just return the path as is.
    return tsPluginPath
  }

  const isTs = tsPluginPath.endsWith('ts')
  let newBaseName

  /* c8 ignore next 5 */
  if (isTs) {
    newBaseName = basename(tsPluginPath, '.ts') + '.js'
  } else {
    newBaseName = basename(tsPluginPath)
  }

  const tsPluginRelativePath = relative(workingDir, tsPluginPath)
  const jsPluginRelativePath = join(dirname(tsPluginRelativePath), newBaseName)

  return join(compileDir, jsPluginRelativePath)
}

module.exports = { getJSPluginPath, isDocker, isFileAccessible }
