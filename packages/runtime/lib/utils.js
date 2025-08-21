'use strict'

const { createHash } = require('node:crypto')
const { tmpdir } = require('node:os')
const { join } = require('node:path')

function getArrayDifference (a, b) {
  return a.filter(element => {
    return !b.includes(element)
  })
}

function getApplicationUrl (id) {
  return `http://${id}.plt.local`
}

function getRuntimeTmpDir (runtimeDir) {
  const platformaticTmpDir = join(tmpdir(), 'platformatic', 'applications')
  const runtimeDirHash = createHash('md5').update(runtimeDir).digest('hex')
  return join(platformaticTmpDir, runtimeDirHash)
}

module.exports = {
  getArrayDifference,
  getRuntimeTmpDir,
  getApplicationUrl
}
