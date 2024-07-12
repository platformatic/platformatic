'use strict'

const { sync: resolveSync } = require('resolve')
const { join } = require('path')
const { isFileAccessible } = require('@platformatic/utils')

async function getGlobalTSCExecutablePath () {
  let typescriptPathCWD
  let tscGlobalPath

  try {
    typescriptPathCWD = resolveSync('typescript', { basedir: process.cwd() })
    tscGlobalPath = join(typescriptPathCWD, '..', '..', 'bin', 'tsc')
    const tscGlobalExists = await isFileAccessible(tscGlobalPath)
    if (tscGlobalExists) {
      return tscGlobalPath
    }
  } catch {
  }
}

async function getTSCExecutablePath (cwd) {
  try {
    const typescriptPath = resolveSync('typescript', { basedir: cwd })
    const tscLocalPath = join(typescriptPath, '..', '..', 'bin', 'tsc')
    const tscLocalExists = await isFileAccessible(tscLocalPath)

    if (tscLocalExists) {
      return tscLocalPath
    }
  } catch {
  }

  return getGlobalTSCExecutablePath()
}

module.exports.getTSCExecutablePath = getTSCExecutablePath
module.exports.getGlobalTSCExecutablePath = getGlobalTSCExecutablePath
