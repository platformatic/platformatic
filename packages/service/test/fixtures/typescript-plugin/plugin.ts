import { FastifyInstance } from 'fastify'

export default async function (app: FastifyInstance) {
  app.log.info('Typescript plugin loaded')
}
