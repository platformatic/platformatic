'use strict'

const leven = require('leven')

function findNearestString (strings, target) {
  let nearestString = null
  let nearestDistance = Infinity

  for (const string of strings) {
    const distance = leven(string, target)
    if (distance < nearestDistance) {
      nearestString = string
      nearestDistance = distance
    }
  }
  return nearestString
}

module.exports = findNearestString
