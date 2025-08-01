'use strict'

export default {
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
