'use strict'

async function configRoutes (app, opts) {
  const { configManager } = opts
  const headersSchema = {
    type: 'object',
    properties: {
      'x-platformatic-admin-secret': {
        type: 'string',
        description: 'The secret defined in authorization.adminSecret property of config file.'
      }
    },
    required: ['x-platformatic-admin-secret']
  }
  const unauthorizedResponseSchema = {
    type: 'object',
    properties: {
      success: { type: 'boolean', default: false },
      message: { type: 'string', default: 'Unauthorized' }
    }
  }
  // TODO: where we implement authorization for this?
  // app.addHook('preHandler', async (request, reply) => {
  //   if (!request.user) {
  //     return reply.code(401).send({ success: false, message: 'Unauthorized' })
  //   }
  // })
  app.post('/config-file', {
    schema: {
      headers: headersSchema,
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' }
          }
        },
        401: unauthorizedResponseSchema
      },
      body: {
        type: 'object'
      }
    }
  }, async (req, reply) => {
    await configManager.update(req.body)
    return reply
      .code(200)
      .header('Content-Type', 'application/json')
      .send({ success: true })
  })

  app.get('/config-file', async (req, reply) => {
    const data = configManager.current
    return reply
      .code(200)
      .header('Content-Type', 'application/json')
      .send(data)
  })
  app.decorate('platformaticConfigManager', configManager)
}

module.exports = configRoutes
