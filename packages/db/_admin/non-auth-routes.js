'use strict'

async function nonAuthRoutes (app, opts) {
  let adminSecret
  if (opts.authorization && opts.authorization.adminSecret) {
    adminSecret = opts.authorization.adminSecret
  }
  /** NON AUTHENTICATED ROUTES */
  app.get('/config', {
    schema: {
      response: {
        200: {
          type: 'object',
          properties: {
            loginRequired: { type: 'boolean' }
          }
        }
      }
    }
  },
  async (req, reply) => {
    const output = {
      loginRequired: false
    }
    if (adminSecret) {
      output.loginRequired = true
    }
    return reply.code(200).send(output)
  })

  // handles login
  app.post('/login', {
    schema: {
      response: {
        200: {
          type: 'object',
          properties: {
            authorized: { type: 'boolean' }
          }
        }
      },
      body: {
        type: 'object',
        required: ['password'],
        properties: {
          password: { type: 'string' }
        }
      }
    },
    handler: (req, reply) => {
      if (adminSecret !== null && req.body.password === adminSecret) {
        return reply.code(200).send({ authorized: true })
      } else {
        return reply.code(401).send({ authorized: false })
      }
    }
  })
}
module.exports = nonAuthRoutes
