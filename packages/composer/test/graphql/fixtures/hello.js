'use strict'

module.exports = {
  schema: `
    extend type Query {
      hello: String
    }
  `,
  resolvers: {
    Query: {
      hello: () => 'world'
    }
  }
}
