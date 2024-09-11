/// <reference path="../global.d.ts" />
import { FastifyInstance, FastifyPluginOptions } from 'fastify'

export default async function (fastify: FastifyInstance, opts: FastifyPluginOptions) {
  fastify.decorate('example', 'foobar')
}
