'use strict'

/* istanbul ignore file */

const obj = {}

Object.defineProperty(obj, 'pg', {
  get: () => require('./pg')
})

Object.defineProperty(obj, 'mysql', {
  get: () => require('./mysql')
})

Object.defineProperty(obj, 'mariadb', {
  get: () => require('./mariadb')
})

Object.defineProperty(obj, 'sqlite', {
  get: () => require('./sqlite')
})

module.exports = obj
