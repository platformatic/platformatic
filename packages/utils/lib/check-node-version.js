'use strict'

const semver = require('semver')

function checkNodeVersionForServices () {
  const currentVersion = process.version
  const minVersions = ['20.16.0', '22.3.0']

  const isCompatible = minVersions.some(version => semver.gte(currentVersion, version))

  if (!isCompatible) {
    const warningMessage = `Warning: Node.js services are supported only for versions >= ${minVersions.join(' or ')}. ` + `Your current version is ${currentVersion}. Please upgrade Node.js to use services in runtimes.`
    throw new Error(warningMessage)
  }
}

module.exports = { checkNodeVersionForServices }
