'use strict'

function buildConfig (options) {
  const base = {
    server: {},
    core: {}
  }

  return Object.assign(base, options)
}

module.exports.buildConfig = buildConfig
