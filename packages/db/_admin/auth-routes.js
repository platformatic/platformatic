'use strict'

async function authRoutes (app, opts) {
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
  // restarts the server
  app.post('/restart', {
    schema: {
      headers: headersSchema,
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean', default: true }
          }
        },
        401: unauthorizedResponseSchema
      }
    }
  },
  async function (req, reply) {
    app.log.info('Restarting server...')
    await app.restart()
    app.log.info('...server restarted')
    return { success: true }
  })

  if (opts.configManager) {
    app.register(opts.configManager.toFastifyPlugin())
  }
}

module.exports = authRoutes
