import { FastifyInstance } from 'fastify'
/// <reference path="./hello" />

export default async function (app: FastifyInstance) {
  app.get('/', async () => {
    return app.hello.get({})
  })
}
