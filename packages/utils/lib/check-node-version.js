'use strict'

const semver = require('semver')

function checkNodeVersionForServices () {
  const currentVersion = process.version
  const major = parseInt(process.version.split('.')[0].slice(1))
  const minimumVersion = major < 21 ? '20.16.0' : '22.3.0'

  if (semver.lt(currentVersion, minimumVersion)) {
    throw new Error(
      `Your current Node.js version is ${currentVersion}, while the minimum supported version is v${minimumVersion}. Please upgrade Node.js and try again.`
    )
  }
}

module.exports = { checkNodeVersionForServices }
