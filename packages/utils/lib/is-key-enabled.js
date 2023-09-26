'use strict'

function isKeyEnabled (key, config) {
  if (config === undefined) return false
  if (typeof config[key] === 'boolean') {
    return config[key]
  }
  if (config[key] === undefined) {
    return false
  }
  return true
}

module.exports = isKeyEnabled
