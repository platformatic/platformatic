/// <reference types="@platformatic/service" />
'use strict'
/** @param {import('fastify').FastifyInstance} fastify */
module.exports = async function (fastify, opts) {
  fastify.get('/invalid', async (req, res) => {
    return {
      headers: req.headers,
      body: req.body,
      query: req.query
    }
  })

  fastify.get('/valid', async (req, res) => {
    return {
      message: 'This is a valid response'
    }
  })

  fastify.get('/no-content-type', async (req, res) => {
    const query = req.query
    if (query.returnType === 'html') {
      res.header('content-type', 'text/html')
      return res.code(200).send('<h1>Hello World</h1>')
    }
    return { message: 'This is a JSON' }
  })

  fastify.get('/with-refs', async (req, res) => {
    const movie = {
      id: 123,
      title: 'Harry Potter'
    }
    return movie
  })
}
