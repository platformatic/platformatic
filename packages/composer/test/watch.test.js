'use strict'

const assert = require('node:assert/strict')
const { test } = require('node:test')
const { setTimeout: sleep } = require('node:timers/promises')
const { checkRestarted, createGraphqlService, createComposerInRuntime, createOpenApiService, testEntityRoutes } = require('./helper')
const { request } = require('undici')

const REFRESH_TIMEOUT = 1000

test('composer should restart if an external service with openapi and graphql updates', async (t) => {
  await t.test('change graphql', async (t) => {
    const schema1 = 'type Query {\n  rnd: Int\n}'
    const schema2 = 'type Query {\n  greetings: String\n}'
    const graphql1 = await createGraphqlService(t, {
      schema: schema1,
      resolvers: { Query: { rnd: () => Math.floor(Math.rnd() * 100) } },
    })
    const graphql1Origin = await graphql1.listen()
    const port = graphql1.server.address().port

    const graphql1a = await createGraphqlService(t, {
      schema: schema2,
      resolvers: { Query: { greetings: () => 'welcome' } },
    })

    const openapi1 = await createOpenApiService(t, ['users'])
    const openapi1Origin = await openapi1.listen()

    const runtime = await createComposerInRuntime(
      t,
      'composer-external-watch',
      {
        composer: {
          services: [
            {
              id: 'graphql1',
              origin: graphql1Origin,
              graphql: true,
            },
            {
              id: 'openapi1',
              origin: openapi1Origin,
              openapi: {
                url: '/documentation/json',
                prefix: '/api1',
              },
            },
          ],
          refreshTimeout: REFRESH_TIMEOUT,
        },
      }
    )

    let composerOrigin = await runtime.start()

    {
      const { statusCode } = await request(composerOrigin, {
        path: '/documentation/json',
      })
      assert.equal(statusCode, 200, 'openapi are reachable on composer')
    }
    await testEntityRoutes(composerOrigin, ['/api1/users'])

    await graphql1.close()
    await graphql1a.listen({ port })
    await sleep(REFRESH_TIMEOUT * 2)
    composerOrigin = (await runtime.getEntrypointDetails()).url

    {
      const { statusCode } = await request(composerOrigin, {
        path: '/documentation/json',
      })
      assert.equal(statusCode, 200)
    }
    await testEntityRoutes(composerOrigin, ['/api1/users'], 'same openapi')

    assert.ok(await checkRestarted(runtime, 'composer'))
  })

  await t.test('change openapi', async (t) => {
    const schema = 'type Query {\n  rnd: Int\n}'

    const graphql1 = await createGraphqlService(t, {
      schema,
      resolvers: { Query: { rnd: () => Math.floor(Math.rnd() * 100) } },
    })
    const graphql1Origin = await graphql1.listen()

    const openapi1 = await createOpenApiService(t, ['users'])
    const openapi1Origin = await openapi1.listen()

    const port = openapi1.server.address().port
    const openapi1a = await createOpenApiService(t, ['posts'])

    const runtime = await createComposerInRuntime(
      t,
      'composer-external-watch',
      {
        composer: {
          services: [
            {
              id: 'graphql1',
              origin: graphql1Origin,
              graphql: true,
            },
            {
              id: 'openapi1',
              origin: openapi1Origin,
              openapi: {
                url: '/documentation/json',
                prefix: '/api1',
              },
            },
          ],
          refreshTimeout: REFRESH_TIMEOUT,
        },
      }
    )

    let composerOrigin = await runtime.start()

    {
      const { statusCode } = await request(composerOrigin, {
        path: '/documentation/json',
      })
      assert.equal(statusCode, 200, 'openapi are reachable on composer')
    }
    await testEntityRoutes(composerOrigin, ['/api1/users'])

    await openapi1.close()
    await openapi1a.listen({ port })
    await sleep(REFRESH_TIMEOUT * 2)
    composerOrigin = (await runtime.getEntrypointDetails()).url

    {
      const { statusCode } = await request(composerOrigin, {
        path: '/documentation/json',
      })
      assert.equal(statusCode, 200)
    }
    await testEntityRoutes(composerOrigin, ['/api1/posts'], 'openapi updated')

    assert.ok(await checkRestarted(runtime, 'composer'))
  })
})
