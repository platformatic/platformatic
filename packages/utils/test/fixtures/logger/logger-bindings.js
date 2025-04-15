'use strict'

module.exports = {
  bindings: function (bindings) {
    return bindings
  },
  level: function (level) {
    return { level: level.toUpperCase() }
  }
}
