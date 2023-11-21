'use strict'

module.exports = async function (app) {
  app.get('/hello', {
    schema: {
      response: {
        200: {
          type: 'object',
          properties: {
            hello: { type: 'string' }
          }
        }
      }
    }
  }, async (req, res) => {
    return { hello: 'world' }
  })
}
