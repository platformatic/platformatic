import { FastifyInstance, fastify } from 'fastify'
import { expectType } from 'tsd'
import { PltDb } from './types/PltDb.ts'

const app: FastifyInstance = fastify()

const graphs = await app.platformatic.entities.graph.find()
expectType<PltDb[]>(graphs)

const graph = graphs[0]
expectType<number | undefined>(graph.id)
expectType<string | null | undefined>(graph.name)
