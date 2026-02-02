/// <reference types="./plt-env.d.ts" />

import { type FastifyInstance, fastify } from 'fastify'
import { expect } from 'tstyche'
import type { PltDb } from './types/pltDb.js'

const app: FastifyInstance = fastify()

const graphs = await app.platformatic.entities.pltDb.find()
expect(graphs).type.toBe<PltDb[]>()

const graph = graphs[0]
expect(graph?.id).type.toBe<number | undefined>()
expect(graph?.name).type.toBe<string | null | undefined>()
