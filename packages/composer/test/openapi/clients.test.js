'use strict'

const { join } = require('path')
const { test } = require('tap')
const {
  createComposer,
  createOpenApiService
} = require('../helper')

test('should create an api client', async (t) => {
  const api = await createOpenApiService(t, ['users'])
  await api.listen({ port: 0 })

  const api1ClientDir = join(__dirname, 'fixtures', 'clients', 'api1', 'api1.cjs')

  const composer = await createComposer(t,
    {
      composer: {
        services: [
          {
            id: 'api1',
            origin: 'http://127.0.0.1:' + api.server.address().port,
            openapi: {
              url: '/documentation/json'
            }
          }
        ]
      },
      clients: [{
        url: 'http://127.0.0.1:' + api.server.address().port,
        path: api1ClientDir
      }]
    }
  )

  t.ok(composer.api1, 'should create an api client')

  const clientMethods = Object.keys(composer.api1)
  t.same(clientMethods, [
    'getUsers',
    'postUsers',
    'putUsers',
    'getUsers{id}',
    'postUsers{id}',
    'putUsers{id}',
    'deleteUsers{id}'
  ])

  const users = await composer.api1.getUsers()
  t.same(users, Array.from(api.users.values()))
})
