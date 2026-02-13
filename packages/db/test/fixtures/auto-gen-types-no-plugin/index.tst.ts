/// <reference types="./plt-env.d.ts" />

import { fastify, type FastifyInstance } from 'fastify'
import { expect } from 'tstyche'
import type { Graph } from './types/graph.js'

const app: FastifyInstance = fastify()

const graphs = await app.platformatic.entities.graph.find()
expect(graphs).type.toBe<Graph[]>()

const graph = graphs[0]
expect(graph?.id).type.toBe<number | undefined>()
expect(graph?.name).type.toBe<string | null | undefined>()
