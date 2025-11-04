/// <reference types="./plt-env.d.ts" />

import { fastify, FastifyInstance } from 'fastify'
import { expectType } from 'tsd'
import { Graph } from './types/graph.ts'

const app: FastifyInstance = fastify()

const graphs = await app.platformatic.entities.graph.find()
expectType<Graph[]>(graphs)

const graph = graphs[0]
expectType<number | undefined>(graph.id)
expectType<string | null | undefined>(graph.name)

app.platformatic.addEntityHooks('graph', {
  async find (originalFind, options) {
    expectType<Partial<Graph>[]>(await originalFind())
    expectType<Parameters<typeof app.platformatic.entities.graph.find>[0]>(options)

    return [
      {
        id: 42
      }
    ]
  }
})
