/// <reference path="./global.d.ts" />

import { expectType } from 'tsd'
import { PltDb } from './types/PltDb'
import { FastifyInstance, fastify } from 'fastify'

const app: FastifyInstance = fastify()

const graphs = await app.platformatic.entities.graph.find()
expectType<PltDb[]>(graphs)

const graph = graphs[0]
expectType<number | undefined>(graph.id)
expectType<string | null | undefined>(graph.name)
