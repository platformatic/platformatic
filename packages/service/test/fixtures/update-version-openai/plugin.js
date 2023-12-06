'use strict'

module.exports = async function (app) {
  app.get('/hello', {
    schema: {
      headers: {
        type: 'object',
        properties: {
          'x-bar': { type: 'string' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            bar: { type: 'string' }
          }
        }
      }
    }
  }, async (req, res) => {
    const bar = req.headers['x-bar']
    return { bar }
  })
}
