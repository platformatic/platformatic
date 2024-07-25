'use strict'
function getArrayDifference (a, b) {
  return a.filter(element => {
    return !b.includes(element)
  })
}

module.exports = {
  getArrayDifference,
}
