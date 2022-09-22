'use strict'

const shared = require('./shared')
const mysql = require('./mysql-shared')

module.exports = {
  ...mysql,
  insertOne: shared.insertOne,
  insertMany: shared.insertMany,
  deleteAll: shared.deleteAll
}
