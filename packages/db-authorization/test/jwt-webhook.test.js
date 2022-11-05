'use strict'

const fastify = require('fastify')
const auth = require('..')
const { test } = require('tap')
const core = require('@platformatic/db-core')
const { createPublicKey, generateKeyPairSync } = require('crypto')
const { connInfo, clear, isSQLite } = require('./helper')
const { request, Agent, setGlobalDispatcher } = require('undici')
const { createSigner } = require('fast-jwt')

const agent = new Agent({
  keepAliveTimeout: 10,
  keepAliveMaxTimeout: 10
})
setGlobalDispatcher(agent)

async function buildAuthorizer (opts = {}) {
  const app = fastify({
    forceCloseConnections: true
  })
  app.register(require('@fastify/cookie'))
  app.register(require('@fastify/session'), {
    cookieName: 'sessionId',
    secret: 'a secret with minimum length of 32 characters',
    cookie: { secure: false }
  })

  app.post('/login', async (request, reply) => {
    request.session.user = request.body
    return {
      status: 'ok'
    }
  })

  app.post('/authorize', async (request, reply) => {
    if (typeof opts.onAuthorize === 'function') {
      await opts.onAuthorize(request)
    }

    const user = request.session.user
    if (!user) {
      return reply.code(401).send({ error: 'Unauthorized' })
    }
    return user
  })

  await app.listen({ port: 0 })

  return app
}

async function buildAuthorizerAPIToken (opts = {}) {
  const app = fastify({
    forceCloseConnections: true
  })

  app.post('/authorize', async (request, reply) => {
    return await opts.onAuthorize(request)
  })

  await app.listen({ port: 0 })

  return app
}

async function createBasicPages (db, sql) {
  if (isSQLite) {
    await db.query(sql`CREATE TABLE pages (
      id INTEGER PRIMARY KEY,
      title VARCHAR(42),
      user_id INTEGER
    );`)
  } else {
    await db.query(sql`CREATE TABLE pages (
      id SERIAL PRIMARY KEY,
      title VARCHAR(42),
      user_id INTEGER
    );`)
  }
}

// creates a RSA key pair for the test
const { publicKey, privateKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'pkcs1', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs1', format: 'pem' }
})
const jwtPublicKey = createPublicKey(publicKey).export({ format: 'jwk' })

async function buildJwksEndpoint (jwks, fail = false) {
  const app = fastify()
  app.get('/.well-known/jwks.json', async (request, reply) => {
    if (fail) {
      throw Error('JWKS ENDPOINT ERROR')
    }
    return jwks
  })
  await app.listen({ port: 0 })
  return app
}

test('JWT + cookies with WebHook', async ({ pass, teardown, same, equal }) => {
  const authorizer = await buildAuthorizer()
  teardown(() => authorizer.close())

  const { n, e, kty } = jwtPublicKey
  const kid = 'TEST-KID'
  const alg = 'RS256'
  const jwksEndpoint = await buildJwksEndpoint(
    {
      keys: [
        {
          alg,
          kty,
          n,
          e,
          use: 'sig',
          kid
        }
      ]
    }
  )
  teardown(() => jwksEndpoint.close())

  const issuer = `http://localhost:${jwksEndpoint.server.address().port}`
  const header = {
    kid,
    alg,
    typ: 'JWT'
  }
  const app = fastify({
    forceCloseConnections: true
  })
  app.register(core, {
    ...connInfo,
    async onDatabaseLoad (db, sql) {
      pass('onDatabaseLoad called')

      await clear(db, sql)
      await createBasicPages(db, sql)
    }
  })
  app.register(auth, {
    webhook: {
      url: `http://localhost:${authorizer.server.address().port}/authorize`
    },
    jwt: {
      jwks: true
    },
    roleKey: 'X-PLATFORMATIC-ROLE',
    anonymousRole: 'anonymous',
    rules: [{
      role: 'user',
      entity: 'page',
      find: true,
      delete: false,
      defaults: {
        userId: 'X-PLATFORMATIC-USER-ID'
      },
      save: {
        checks: {
          userId: 'X-PLATFORMATIC-USER-ID'
        }
      }
    }, {
      role: 'anonymous',
      entity: 'page',
      find: false,
      delete: false,
      save: false
    }]
  })
  teardown(app.close.bind(app))
  teardown(() => authorizer.close())

  await app.ready()

  async function getCookie (userId, role) {
    const res = await request(`http://localhost:${authorizer.server.address().port}/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        'X-PLATFORMATIC-USER-ID': userId,
        'X-PLATFORMATIC-ROLE': role
      })
    })

    res.body.resume()

    const cookie = res.headers['set-cookie'].split(';')[0]
    return cookie
  }

  {
    const cookie = await getCookie(42, 'user')
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      headers: {
        cookie
      },
      body: {
        query: `
          mutation {
            savePage(input: { title: "Hello" }) {
              id
              title
              userId
            }
          }
        `
      }
    })
    equal(res.statusCode, 200, 'savePage status code')
    same(res.json(), {
      data: {
        savePage: {
          id: 1,
          title: 'Hello',
          userId: 42
        }
      }
    }, 'savePage response')
  }

  {
    const signSync = createSigner({
      algorithm: 'RS256',
      key: privateKey,
      header,
      iss: issuer,
      kid
    })
    const payload = {
      'X-PLATFORMATIC-USER-ID': 42,
      'X-PLATFORMATIC-ROLE': ['user']
    }
    const token = signSync(payload)

    const res = await app.inject({
      method: 'GET',
      url: '/pages/1',
      headers: {
        Authorization: `Bearer ${token}`
      }
    })
    equal(res.statusCode, 200, 'pages status code')
    same(res.json(), {
      id: 1,
      title: 'Hello',
      userId: 42
    })
  }
})

test('Authorization both with JWT and WebHook', async ({ pass, teardown, same, equal }) => {
  const authorizer = await buildAuthorizerAPIToken({
    async onAuthorize (request) {
      equal(request.headers.authorization, 'Bearer foobar')
      const payload = {
        'X-PLATFORMATIC-USER-ID': 42,
        'X-PLATFORMATIC-ROLE': 'user'
      }

      return payload
    }
  })
  teardown(() => authorizer.close())

  const { n, e, kty } = jwtPublicKey
  const kid = 'TEST-KID'
  const alg = 'RS256'
  const jwksEndpoint = await buildJwksEndpoint(
    {
      keys: [
        {
          alg,
          kty,
          n,
          e,
          use: 'sig',
          kid
        }
      ]
    }
  )
  teardown(() => jwksEndpoint.close())

  const issuer = `http://localhost:${jwksEndpoint.server.address().port}`
  const header = {
    kid,
    alg,
    typ: 'JWT'
  }
  const app = fastify({
    forceCloseConnections: true
  })
  app.register(core, {
    ...connInfo,
    async onDatabaseLoad (db, sql) {
      pass('onDatabaseLoad called')

      await clear(db, sql)
      await createBasicPages(db, sql)
    }
  })
  app.register(auth, {
    webhook: {
      url: `http://localhost:${authorizer.server.address().port}/authorize`
    },
    jwt: {
      jwks: true
    },
    roleKey: 'X-PLATFORMATIC-ROLE',
    anonymousRole: 'anonymous',
    rules: [{
      role: 'user',
      entity: 'page',
      find: true,
      delete: false,
      defaults: {
        userId: 'X-PLATFORMATIC-USER-ID'
      },
      save: {
        checks: {
          userId: 'X-PLATFORMATIC-USER-ID'
        }
      }
    }, {
      role: 'anonymous',
      entity: 'page',
      find: false,
      delete: false,
      save: false
    }]
  })
  teardown(app.close.bind(app))
  teardown(() => authorizer.close())

  await app.ready()

  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      headers: {
        Authorization: 'Bearer foobar'
      },
      body: {
        query: `
          mutation {
            savePage(input: { title: "Hello" }) {
              id
              title
              userId
            }
          }
        `
      }
    })
    equal(res.statusCode, 200, 'savePage status code')
    same(res.json(), {
      data: {
        savePage: {
          id: 1,
          title: 'Hello',
          userId: 42
        }
      }
    }, 'savePage response')
  }

  {
    const signSync = createSigner({
      algorithm: 'RS256',
      key: privateKey,
      header,
      iss: issuer,
      kid
    })
    const payload = {
      'X-PLATFORMATIC-USER-ID': 42,
      'X-PLATFORMATIC-ROLE': ['user']
    }
    const token = signSync(payload)

    const res = await app.inject({
      method: 'GET',
      url: '/pages/1',
      headers: {
        Authorization: `Bearer ${token}`
      }
    })
    equal(res.statusCode, 200, 'pages status code')
    same(res.json(), {
      id: 1,
      title: 'Hello',
      userId: 42
    })
  }
})
