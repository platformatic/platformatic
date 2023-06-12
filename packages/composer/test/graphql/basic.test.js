'use strict'

const { test } = require('tap')
const {
  createComposer,
  createGraphqlService
} = require('../helper')

test('should compose two graphql apis', async (t) => {
  const api1 = await createGraphqlService(t, ['User'])
  await api1.listen({ port: 0 })

  const api2 = await createGraphqlService(t, ['Post'])
  await api2.listen({ port: 0 })

  const composer = await createComposer(t,
    {
      composer: {
        services: [
          {
            id: 'api1',
            origin: 'http://127.0.0.1:' + api1.server.address().port,
            graphql: {
              url: '/graphql'
            }
          },
          {
            id: 'api2',
            origin: 'http://127.0.0.1:' + api2.server.address().port,
            graphql: {
              url: '/graphql'
            }
          }
        ]
      }
    }
  )

  {
    const { statusCode, body } = await composer.inject({
      method: 'POST',
      url: '/graphql',
      body: {
        query: `
          query {
            getUserById (id: "1") {
              id,
              name
            }
          }
        `
      }
    })
    t.equal(statusCode, 200)

    const res = JSON.parse(body)
    t.strictSame(res, { data: { getUserById: { id: '1', name: 'test1' } } })
  }

  {
    const { statusCode, body } = await composer.inject({
      method: 'POST',
      url: '/graphql',
      body: {
        query: `
          query {
            getPostById (id: "1") {
              id,
              name
            }
          }
        `
      }
    })
    t.equal(statusCode, 200)

    const res = JSON.parse(body)
    t.strictSame(res, { data: { getPostById: { id: '1', name: 'test1' } } })
  }
})
