'use strict'

const { resolve } = require('path')
const { access } = require('fs/promises')

async function isFileAccessible (filename, directory) {
  try {
    const filePath = resolve(directory, filename)
    await access(filePath)
    return true
  } catch (err) {
    return false
  }
}

module.exports.isFileAccessible = isFileAccessible

function splitModuleFromVersion (module) {
  if (!module) {
    return {}
  }
  const versionMatcher = module.match(/(.+)@(\d+.\d+.\d+)/)
  let version
  if (versionMatcher) {
    module = versionMatcher[1]
    version = versionMatcher[2]
  }
  return { module, version }
}

module.exports.splitModuleFromVersion = splitModuleFromVersion
