'use strict'

module.exports = async function (app) {
  app.graphql.extendSchema(`
    extend type Query {
      hello: String
    }
  `)
  app.graphql.defineResolvers({
    Query: {
      hello: async function (root, args, context) {
        return 'world'
      }
    }
  })
}
