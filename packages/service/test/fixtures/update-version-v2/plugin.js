'use strict'

module.exports = async function (app) {
  app.get('/hello', {
    schema: {
      response: {
        200: {
          type: 'object',
          properties: {
            data: { type: 'string' }
          }
        }
      }
    }
  }, async (req, res) => {
    return { data: 'world' }
  })

  app.post('/hello', {
    schema: {
      body: {
        type: 'object',
        properties: {
          data: { type: 'number' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            data: { type: 'string' }
          }
        }
      }
    }
  }, async (req, res) => {
    const data = req.body.data
    return { data: data.toString() }
  })

  app.get('/hello/:id', {
    schema: {
      params: {
        type: 'object',
        properties: {
          id: { type: 'number' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            data: { type: 'string' }
          }
        }
      }
    }
  }, async (req, res) => {
    const id = req.params.id
    return { data: id }
  })
}
