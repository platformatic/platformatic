import assert from 'node:assert/strict'
import { test } from 'node:test'
import { request } from 'undici'
import {
  createComposerInRuntime,
  createGraphqlApplication,
  createOpenApiApplication,
  REFRESH_TIMEOUT,
  testEntityRoutes,
  waitForRestart
} from './helper.js'

test('composer should restart when graphql changes', async t => {
  const schema1 = 'type Query {\n  rnd: Int\n}'
  const schema2 = 'type Query {\n  greetings: String\n}'
  const graphql1 = await createGraphqlApplication(t, {
    schema: schema1,
    resolvers: { Query: { rnd: () => Math.floor(Math.rnd() * 100) } }
  })
  const graphql1Origin = await graphql1.listen()
  const port = graphql1.server.address().port

  const graphql1a = await createGraphqlApplication(t, {
    schema: schema2,
    resolvers: { Query: { greetings: () => 'welcome' } }
  })

  const openapi1 = await createOpenApiApplication(t, ['users'])
  const openapi1Origin = await openapi1.listen()

  const runtime = await createComposerInRuntime(t, 'composer-external-watch', {
    composer: {
      applications: [
        {
          id: 'graphql1',
          origin: graphql1Origin,
          graphql: true
        },
        {
          id: 'openapi1',
          origin: openapi1Origin,
          openapi: {
            url: '/documentation/json',
            prefix: '/api1'
          }
        }
      ],
      refreshTimeout: REFRESH_TIMEOUT
    }
  })

  let composerOrigin = await runtime.start()

  {
    const res = await request(composerOrigin, {
      path: '/documentation/json'
    })
    assert.equal(res.statusCode, 200, 'openapi are reachable on composer')
    await res.body.text()
  }
  await testEntityRoutes(composerOrigin, ['/api1/users'])

  await graphql1.close()
  await graphql1a.listen({ port })

  composerOrigin = await waitForRestart(runtime)

  {
    const res = await request(composerOrigin, {
      path: '/documentation/json'
    })
    assert.equal(res.statusCode, 200)
    await res.body.text()
  }

  await testEntityRoutes(composerOrigin, ['/api1/users'], 'same openapi')
})

test('composer should restart when openapi changes', async t => {
  const schema = 'type Query {\n  rnd: Int\n}'

  const graphql1 = await createGraphqlApplication(t, {
    schema,
    resolvers: { Query: { rnd: () => Math.floor(Math.rnd() * 100) } }
  })
  const graphql1Origin = await graphql1.listen()

  const openapi1 = await createOpenApiApplication(t, ['users'])
  const openapi1Origin = await openapi1.listen()

  const port = openapi1.server.address().port
  const openapi1a = await createOpenApiApplication(t, ['posts'])

  const runtime = await createComposerInRuntime(t, 'composer-external-watch', {
    composer: {
      applications: [
        {
          id: 'graphql1',
          origin: graphql1Origin,
          graphql: true
        },
        {
          id: 'openapi1',
          origin: openapi1Origin,
          openapi: {
            url: '/documentation/json',
            prefix: '/api1'
          }
        }
      ],
      refreshTimeout: REFRESH_TIMEOUT
    }
  })

  let composerOrigin = await runtime.start()

  {
    const res = await request(composerOrigin, {
      path: '/documentation/json'
    })
    assert.equal(res.statusCode, 200, 'openapi are reachable on composer')
    await res.body.text()
  }
  await testEntityRoutes(composerOrigin, ['/api1/users'])

  await openapi1.close()
  await openapi1a.listen({ port })

  composerOrigin = await waitForRestart(runtime)

  {
    const res = await request(composerOrigin, {
      path: '/documentation/json'
    })
    assert.equal(res.statusCode, 200)
    await res.body.text()
  }
  await testEntityRoutes(composerOrigin, ['/api1/posts'], 'openapi updated')
})
