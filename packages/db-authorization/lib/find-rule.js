'use strict'

function findRule (rules, roles) {
  let found = null
  for (const rule of rules) {
    for (const role of roles) {
      if (rule.role === role) {
        found = rule
        break
      }
    }
    if (found) {
      break
    }
  }
  return found
}

module.exports = findRule
