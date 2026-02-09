import { FastifyInstance, fastify } from 'fastify'
import { expectType } from 'tsd'
import { Graph } from './types/Graph'

const app: FastifyInstance = fastify()

const graphs = await app.platformatic.entities.graph.find()
expectType<Graph[]>(graphs)

const graph = graphs[0]
expectType<number | undefined>(graph.id)
expectType<string | null | undefined>(graph.name)
