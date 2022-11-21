'use strict'

const { singularize } = require('inflected')
const camelcase = require('camelcase')

function toSingular (str) {
  str = camelcase(singularize(str))
  str = str[0].toUpperCase() + str.slice(1)
  return str
}

function tableName (sql, table, schema) {
  return schema ? sql.ident(schema, table) : sql.ident(table)
}

module.exports = {
  toSingular,
  tableName
}
