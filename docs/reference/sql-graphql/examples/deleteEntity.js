'use strict'

const Fastify = require('fastify')
const graphqlPlugin = require('@platformatic/sql-graphql')
const sqlMapper = require('@platformatic/sql-mapper')
async function main() {
  const app = Fastify({
    logger: {
      level: 'info'
    }
  })
  app.register(sqlMapper, {
    connectionString: 'postgres://postgres:postgres@127.0.0.1/postgres'
  }) 
  app.decorate('platformatic', mapper)
  app.register(graphqlPlugin, {
    graphiql: true
  })
  const res = await app.inject({
    method: 'POST',
    url: '/graphql',
    body: {
      query: `
        mutation {
          deletePages(where: { id: { eq: "3" } }) {
            id
            title
          }
        }
      `
    }
  })
  const result = await res.json()
  console.log(result.data) // { deletePages: [ { id: '3', title: 'Platformatic is cool!' } ] }
  await app.close()
}

main()