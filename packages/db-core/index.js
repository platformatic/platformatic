'use strict'

const fp = require('fastify-plugin')
const sqlMapper = require('@platformatic/sql-mapper')

module.exports = fp(async function (app, opts) {
  app.register(sqlMapper, {
    ...opts
  })

  if (opts.graphql !== false) {
    const sqlGraphQL = require('@platformatic/sql-graphql')
    const graphqlConfig = typeof opts.graphql === 'object' ? opts.graphql : {}
    app.register(sqlGraphQL, {
      ...graphqlConfig
    })
  }

  // enabled by default
  if (opts.openapi !== false) {
    const sqlOpenAPI = require('@platformatic/sql-openapi')
    const openapiConfig = typeof opts.openapi === 'object' ? opts.openapi : {}
    app.register(sqlOpenAPI, {
      ...openapiConfig
    })
  }
})

module.exports.connect = sqlMapper.connect
