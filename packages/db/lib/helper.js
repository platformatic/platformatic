'use strict'

function isKeyEnabledInConfig (key, config) {
  if (typeof config[key] === 'boolean') {
    return config[key]
  }
  if (config[key] === undefined) {
    return false
  }
  return true
}

module.exports.isKeyEnabledInConfig = isKeyEnabledInConfig
