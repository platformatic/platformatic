'use strict'

const { test } = require('tap')
const {
  createComposer,
  createGraphqlService
} = require('../helper')

test('should expose graphiql static page', async (t) => {
  const api = await createGraphqlService(t, ['User'])
  await api.listen({ port: 0 })

  const composer = await createComposer(t,
    {
      composer: {
        services: [
          {
            id: 'api1',
            origin: 'http://127.0.0.1:' + api.server.address().port,
            graphql: {
              url: '/graphql'
            }
          }
        ]
      }
    }
  )

  {
    const { statusCode } = await composer.inject({
      method: 'GET',
      url: '/graphiql'
    })
    t.equal(statusCode, 200)
  }

  {
    const { statusCode } = await composer.inject({
      method: 'GET',
      url: '/graphiql/main.js'
    })
    t.equal(statusCode, 200)
  }

  {
    const { statusCode } = await composer.inject({
      method: 'GET',
      url: '/graphiql/sw.js'
    })
    t.equal(statusCode, 200)
  }

  {
    const { statusCode } = await composer.inject({
      method: 'GET',
      url: '/graphiql/config.js'
    })
    t.equal(statusCode, 200)
  }
})
