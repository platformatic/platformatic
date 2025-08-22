'use strict'

/** @param {import('fastify').FastifyInstance} app */
export default async function (app) {
  app.get('/combined-example/:id', async (req, reply) => {
    return {
      id: req.params.id,
      name: 'combined example',
      description: 'Combined properties',
      timestamp: '2023-01-01T00:00:00Z'
    }
  })

  app.post('/type-example', async (req, reply) => {
    const { objectType } = req.body
    if (objectType === 'typeA') {
      return {
        result: 'typeA',
        originalValue: req.body.valueA
      }
    } else if (objectType === 'typeB') {
      return {
        result: 'typeB',
        originalValue: req.body.valueB
      }
    } else {
      return reply.code(400).send({ error: 'Invalid type' })
    }
  })
}
