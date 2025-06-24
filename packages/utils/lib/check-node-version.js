'use strict'

const semver = require('semver')

function checkNodeVersionForServices () {
  const currentVersion = process.version
  const minimumVersion = '22.16.0'

  if (semver.lt(currentVersion, minimumVersion)) {
    throw new Error(
      `Your current Node.js version is ${currentVersion}, while the minimum supported version is v${minimumVersion}. Please upgrade Node.js and try again.`
    )
  }
}

module.exports = { checkNodeVersionForServices }
