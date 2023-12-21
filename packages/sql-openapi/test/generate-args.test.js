'use strict'

const { test } = require('tap')
const sqlOpenAPI = require('..')
const sqlMapper = require('@platformatic/sql-mapper')
const fastify = require('fastify')
const { clear, connInfo, isPg } = require('./helper')
const { resolve } = require('path')
const { generateArgs } = require('../lib/shared')
test('support "or" corectly', async (t) => {

  const entity = {
    fields: {
      id: {
        sqlType: 'int4',
        isNullable: false,
        primaryKey: true,
        camelcase: 'id'
      },
      title: {
        sqlType: 'varchar',
        isNullable: true,
        camelcase: 'title'
      }
    }
  }

  const generated = generateArgs(entity, {})
  console.log(generated.whereArgs)
})