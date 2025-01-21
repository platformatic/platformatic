'use strict'

function getPrivateSymbol (obj, name) {
  return Object.getOwnPropertySymbols(obj).find(s => s.description === name)
}

module.exports = { getPrivateSymbol }
