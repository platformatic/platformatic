import { create } from '@platformatic/db'
import { create as createService } from '@platformatic/service'
import { match } from '@platformatic/utils'
import { execa } from 'execa'
import { promises as fs } from 'fs'
import graphql from 'graphql'
import { equal } from 'node:assert'
import { join } from 'node:path'
import { after, test } from 'node:test'
import { moveToTmpdir, request } from './helper.js'

test('graphql client generation (javascript)', async t => {
  try {
    await fs.unlink(join(import.meta.dirname, 'fixtures', 'movies', 'db.sqlite'))
  } catch {
    // noop
  }
  const app = await create(join(import.meta.dirname, 'fixtures', 'movies', 'zero.db.json'))

  await app.start()

  const dir = await moveToTmpdir(after)

  const pltServiceConfig = {
    $schema: 'https://schemas.platformatic.dev/@platformatic/service/1.52.0.json',
    server: {
      hostname: '127.0.0.1',
      port: 0
    },
    plugins: {
      paths: ['./plugin.js']
    }
  }

  const plugin = `
const { resolve } = require('node:path')
const { buildGraphQLClient } = require('@platformatic/client')

module.exports = async function (app) {
  const client = await buildGraphQLClient({
    url: '${app.url}/graphql',
    path: resolve(__dirname, './movies/movies.schema.graphql'),
  })

  app.post('/', async (request, reply) => {
    const res = await client.graphql({
      query: 'mutation { saveMovie(input: { title: "foo" }) { id, title } }'
    })
    return res
  })
}
  `

  await fs.writeFile('./platformatic.service.json', JSON.stringify(pltServiceConfig, null, 2))
  await fs.writeFile('./plugin.js', plugin)

  await execa('node', [join(import.meta.dirname, '..', 'cli.mjs'), app.url + '/graphql', '--name', 'movies'])

  const readSDL = await fs.readFile(join(dir, 'movies', 'movies.schema.graphql'), 'utf8')
  {
    const schema = graphql.buildSchema(readSDL)
    const sdl = graphql.printSchema(schema)
    equal(sdl, readSDL)
  }

  process.env.PLT_MOVIES_URL = app.url

  const app2 = await createService('./platformatic.service.json')
  await app2.start()

  t.after(async () => {
    await app2.close()
  })
  t.after(async () => {
    await app.close()
  })

  const res = await request(app2.url, {
    method: 'POST'
  })
  const body = await res.body.json()
  equal(
    match(body, {
      title: 'foo'
    }),
    true
  )
})

test('graphql client generation (typescript)', async t => {
  try {
    await fs.unlink(join(import.meta.dirname, 'fixtures', 'movies', 'db.sqlite'))
  } catch {
    // noop
  }
  const app = await create(join(import.meta.dirname, 'fixtures', 'movies', 'zero.db.json'))

  await app.start()

  const dir = await moveToTmpdir(after)

  const pltServiceConfig = {
    $schema: 'https://schemas.platformatic.dev/@platformatic/service/1.52.0.json',
    server: {
      hostname: '127.0.0.1',
      port: 0
    },
    plugins: {
      paths: ['./plugin.ts']
    }
  }

  const plugin = `
/// <reference types="./movies" />
import { type FastifyPluginAsync } from 'fastify'
import { resolve } from 'node:path'
import { buildGraphQLClient } from '@platformatic/client'

const myPlugin: FastifyPluginAsync<{}> = async (app, options) => {
  const client = await buildGraphQLClient({
    url: '${app.url}/graphql',
    path: resolve(import.meta.dirname, './movies/movies.schema.graphql'),
  })

  app.post('/', async (request, reply) => {
    const res = await client.graphql({
      query: 'mutation { saveMovie(input: { title: "foo" }) { id, title } }'
    })
    return res
  })
}

export default myPlugin
  `

  await fs.writeFile('./platformatic.service.json', JSON.stringify(pltServiceConfig, null, 2))
  await fs.writeFile('./plugin.ts', plugin)

  const tsconfig = JSON.stringify(
    {
      extends: 'fastify-tsconfig',
      compilerOptions: {
        outDir: 'build',
        target: 'es2018',
        moduleResolution: 'NodeNext',
        lib: ['es2018']
      }
    },
    null,
    2
  )

  await fs.writeFile(join(dir, 'tsconfig.json'), tsconfig)

  await execa('node', [join(import.meta.dirname, '..', 'cli.mjs'), app.url + '/graphql', '--name', 'movies'])

  const app2 = await createService('./platformatic.service.json')
  await app2.start()

  t.after(async () => {
    await app2.close()
  })
  t.after(async () => {
    await app.close()
  })

  const res = await request(app2.url, {
    method: 'POST'
  })
  const body = await res.body.json()
  equal(
    match(body, {
      title: 'foo'
    }),
    true
  )
})
