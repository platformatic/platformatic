import { FastifyInstance } from 'fastify'
/// <reference path="./hello" />

export default async function (app: FastifyInstance) {
  app.get('/', async (req) => {
    return req.hello.get({})
  })
}
