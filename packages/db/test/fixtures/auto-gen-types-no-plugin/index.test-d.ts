/// <reference path="./global.d.ts" />

import { expectType } from 'tsd'
import { Graph } from './types/Graph'
import { FastifyInstance, fastify } from 'fastify'

const app: FastifyInstance = fastify()

const graphs = await app.platformatic.entities.graph.find()
expectType<Graph[]>(graphs)

const graph = graphs[0]
expectType<number | undefined>(graph.id)
expectType<string | null | undefined>(graph.name)
