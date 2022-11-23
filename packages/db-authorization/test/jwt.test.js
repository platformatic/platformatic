'use strict'

const fastify = require('fastify')
const auth = require('..')
const { test } = require('tap')
const core = require('@platformatic/db-core')
const { connInfo, clear, isSQLite } = require('./helper')
const { createPublicKey, generateKeyPairSync } = require('crypto')
const { createSigner } = require('fast-jwt')

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

test('jwt verify success getting public key from jwks endpoint', async ({ pass, teardown, same, equal }) => {
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
  const issuer = `http://localhost:${jwksEndpoint.server.address().port}`
  const header = {
    kid,
    alg,
    typ: 'JWT'
  }
  const payload = {
    'X-PLATFORMATIC-USER-ID': 42,
    'X-PLATFORMATIC-ROLE': ['user']
  }

  const app = fastify()
  app.register(core, {
    ...connInfo,
    async onDatabaseLoad (db, sql) {
      pass('onDatabaseLoad called')

      await clear(db, sql)
      await createBasicPages(db, sql)
    }
  })
  app.register(auth, {
    jwt: {
      jwks: true
    },
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
    }]
  })
  teardown(app.close.bind(app))
  teardown(() => jwksEndpoint.close())

  await app.ready()

  const signSync = createSigner({
    algorithm: 'RS256',
    key: privateKey,
    header,
    iss: issuer,
    kid
  })
  const token = signSync(payload)

  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      headers: {
        Authorization: `Bearer ${token}`
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
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      headers: {
        Authorization: `Bearer ${token}`
      },
      body: {
        query: `
          query {
            getPageById(id: 1) {
              id
              title
              userId
            }
          }
        `
      }
    })
    equal(res.statusCode, 200, 'pages status code')
    same(res.json(), {
      data: {
        getPageById: {
          id: 1,
          title: 'Hello',
          userId: 42
        }
      }
    }, 'pages response')
  }
})

test('jwt verify fail if getting public key from jwks endpoint fails', async ({ pass, teardown, same, equal }) => {
  const kid = 'TEST-KID'
  const alg = 'RS256'
  // This fails
  const jwksEndpoint = await buildJwksEndpoint(
    {}, true
  )
  const issuer = `http://localhost:${jwksEndpoint.server.address().port}`
  const header = {
    kid,
    alg,
    typ: 'JWT'
  }
  const payload = {
    'X-PLATFORMATIC-USER-ID': 42,
    'X-PLATFORMATIC-ROLE': ['user']
  }

  const app = fastify()
  app.register(core, {
    ...connInfo,
    async onDatabaseLoad (db, sql) {
      pass('onDatabaseLoad called')

      await clear(db, sql)
      await createBasicPages(db, sql)
    }
  })
  app.register(auth, {
    jwt: {
      jwks: true
    },
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
    }]
  })
  teardown(app.close.bind(app))
  teardown(() => jwksEndpoint.close())

  await app.ready()

  const signSync = createSigner({
    algorithm: 'RS256',
    key: privateKey,
    header,
    iss: issuer,
    kid
  })
  const token = signSync(payload)

  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      headers: {
        Authorization: `Bearer ${token}`
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
        savePage: null
      },
      errors: [
        {
          message: 'operation not allowed',
          locations: [
            {
              line: 3,
              column: 13
            }
          ],
          path: [
            'savePage'
          ]
        }
      ]
    }, 'savePage response')
  }
})

test('jwt verify fail if jwks succeed but kid is not found', async ({ pass, teardown, same, equal }) => {
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

  const issuer = `http://localhost:${jwksEndpoint.server.address().port}`
  const header = {
    kid: 'DIFFERENT_KID',
    alg,
    typ: 'JWT'
  }
  const payload = {
    'X-PLATFORMATIC-USER-ID': 42,
    'X-PLATFORMATIC-ROLE': ['user']
  }

  const app = fastify()
  app.register(core, {
    ...connInfo,
    async onDatabaseLoad (db, sql) {
      pass('onDatabaseLoad called')
      await clear(db, sql)
      await createBasicPages(db, sql)
    }
  })
  app.register(auth, {
    jwt: {
      jwks: true
    },
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
    }]
  })
  teardown(app.close.bind(app))
  teardown(() => jwksEndpoint.close())

  await app.ready()

  const signSync = createSigner({
    algorithm: 'RS256',
    key: privateKey,
    header,
    iss: issuer,
    kid
  })
  const token = signSync(payload)

  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      headers: {
        Authorization: `Bearer ${token}`
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
        savePage: null
      },
      errors: [
        {
          message: 'operation not allowed',
          locations: [
            {
              line: 3,
              column: 13
            }
          ],
          path: [
            'savePage'
          ]
        }
      ]
    }, 'savePage response')
  }
})

test('jwt verify fail if the domain is not allowed', async ({ pass, teardown, same, equal }) => {
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

  const issuer = `http://localhost:${jwksEndpoint.server.address().port}`
  const header = {
    kid,
    alg,
    typ: 'JWT'
  }
  const payload = {
    'X-PLATFORMATIC-USER-ID': 42,
    'X-PLATFORMATIC-ROLE': ['user']
  }

  const app = fastify()
  app.register(core, {
    ...connInfo,
    async onDatabaseLoad (db, sql) {
      pass('onDatabaseLoad called')
      await clear(db, sql)
      await createBasicPages(db, sql)
    }
  })
  app.register(auth, {
    jwt: {
      jwks: {
        allowedDomains: ['http://myalloawedomain.com']
      }
    },
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
    }]
  })
  teardown(app.close.bind(app))
  teardown(() => jwksEndpoint.close())

  await app.ready()

  const signSync = createSigner({
    algorithm: 'RS256',
    key: privateKey,
    header,
    iss: issuer,
    kid
  })
  const token = signSync(payload)

  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      headers: {
        Authorization: `Bearer ${token}`
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
        savePage: null
      },
      errors: [
        {
          message: 'operation not allowed',
          locations: [
            {
              line: 3,
              column: 13
            }
          ],
          path: [
            'savePage'
          ]
        }
      ]
    }, 'savePage response')
  }
})

test('jwt skips configure namespace in custom claims', async ({ pass, teardown, same, equal }) => {
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
  const issuer = `http://localhost:${jwksEndpoint.server.address().port}`
  const header = {
    kid,
    alg,
    typ: 'JWT'
  }
  const namespace = 'https://test.com/'
  const payload = {
    [`${namespace}X-PLATFORMATIC-USER-ID`]: 42,
    [`${namespace}X-PLATFORMATIC-ROLE`]: ['user']
  }

  const app = fastify()
  app.register(core, {
    ...connInfo,
    async onDatabaseLoad (db, sql) {
      pass('onDatabaseLoad called')

      await clear(db, sql)
      await createBasicPages(db, sql)
    }
  })
  app.register(auth, {
    jwt: {
      jwks: true,
      namespace
    },
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
    }]
  })
  teardown(app.close.bind(app))
  teardown(() => jwksEndpoint.close())

  await app.ready()

  const signSync = createSigner({
    algorithm: 'RS256',
    key: privateKey,
    header,
    iss: issuer,
    kid
  })
  const token = signSync(payload)

  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      headers: {
        Authorization: `Bearer ${token}`
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
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      headers: {
        Authorization: `Bearer ${token}`
      },
      body: {
        query: `
          query {
            getPageById(id: 1) {
              id
              title
              userId
            }
          }
        `
      }
    })
    equal(res.statusCode, 200, 'pages status code')
    same(res.json(), {
      data: {
        getPageById: {
          id: 1,
          title: 'Hello',
          userId: 42
        }
      }
    }, 'pages response')
  }
})
