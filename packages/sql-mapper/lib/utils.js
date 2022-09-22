'use strict'

const { singularize } = require('inflected')
const camelcase = require('camelcase')

function toSingular (str) {
  str = camelcase(singularize(str))
  str = str[0].toUpperCase() + str.slice(1)
  return str
}

module.exports = {
  toSingular
}
