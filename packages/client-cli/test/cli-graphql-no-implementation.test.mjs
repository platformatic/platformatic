import { request, moveToTmpdir } from './helper.js'
import { test, after } from 'node:test'
import { equal, deepEqual as same } from 'node:assert'
import { match } from '@platformatic/utils'
import { buildServer } from '@platformatic/db'
import { join } from 'path'
import * as desm from 'desm'
import { execa } from 'execa'
import { promises as fs } from 'fs'
import graphql from 'graphql'
import dotenv from 'dotenv'
import { buildServer as buildService } from '@platformatic/service'

test('graphql client generation (javascript)', async (t) => {
  try {
    await fs.unlink(desm.join(import.meta.url, 'fixtures', 'movies', 'db.sqlite'))
  } catch {
    // noop
  }
  const app = await buildServer(desm.join(import.meta.url, 'fixtures', 'movies', 'zero.db.json'))

  await app.start()

  const dir = await moveToTmpdir(after)

  t.diagnostic(`working in ${dir}`)

  const pltServiceConfig = {
    $schema: 'https://platformatic.dev/schemas/v0.18.0/service',
    server: {
      hostname: '127.0.0.1',
      port: 0
    },
    plugins: {
      paths: ['./plugin.js']
    }
  }

  const plugin = `
module.exports = async function (app) {
  app.post('/', async (request, reply) => {
    const res = await request.movies.graphql({
      query: 'mutation { saveMovie(input: { title: "foo" }) { id, title } }'
    })
    return res
  })
}
  `

  await fs.writeFile('./platformatic.service.json', JSON.stringify(pltServiceConfig, null, 2))
  await fs.writeFile('./plugin.js', plugin)

  await execa('node', [desm.join(import.meta.url, '..', 'cli.mjs'), app.url + '/graphql', '--name', 'movies'])

  const readSDL = await fs.readFile(join(dir, 'movies', 'movies.schema.graphql'), 'utf8')
  {
    const schema = graphql.buildSchema(readSDL)
    const sdl = graphql.printSchema(schema)
    equal(sdl, readSDL)
  }

  process.env.PLT_MOVIES_URL = app.url

  const app2 = await buildService('./platformatic.service.json')
  await app2.start()

  t.after(async () => { await app2.close() })
  t.after(async () => { await app.close() })

  const res = await request(app2.url, {
    method: 'POST'
  })
  const body = await res.body.json()
  match(body, {
    title: 'foo'
  })

  {
    const envs = dotenv.parse(await fs.readFile(join(dir, '.env')))
    same(envs, {
      PLT_MOVIES_URL: app.url + '/graphql'
    })
  }

  {
    const envs = dotenv.parse(await fs.readFile(join(dir, '.env.sample')))
    same(envs, {
      PLT_MOVIES_URL: app.url + '/graphql'
    })
  }
})

test('graphql client generation (typescript)', async (t) => {
  try {
    await fs.unlink(desm.join(import.meta.url, 'fixtures', 'movies', 'db.sqlite'))
  } catch {
    // noop
  }
  const app = await buildServer(desm.join(import.meta.url, 'fixtures', 'movies', 'zero.db.json'))

  await app.start()

  const dir = await moveToTmpdir(after)

  t.diagnostic(`working in ${dir}`)

  const pltServiceConfig = {
    $schema: 'https://platformatic.dev/schemas/v0.18.0/service',
    server: {
      hostname: '127.0.0.1',
      port: 0
    },
    plugins: {
      paths: ['./plugin.ts'],
      typescript: true
    }
  }

  const plugin = `
/// <reference types="./movies" />
import { type FastifyPluginAsync } from 'fastify'

const myPlugin: FastifyPluginAsync<{}> = async (app, options) => {
  app.post('/', async (request, reply) => {
    const res = await request.movies.graphql({
      query: 'mutation { saveMovie(input: { title: "foo" }) { id, title } }'
    })
    return res
  })
}

export default myPlugin
  `

  await fs.writeFile('./platformatic.service.json', JSON.stringify(pltServiceConfig, null, 2))
  await fs.writeFile('./plugin.ts', plugin)

  const tsconfig = JSON.stringify({
    extends: 'fastify-tsconfig',
    compilerOptions: {
      outDir: 'build',
      target: 'es2018',
      moduleResolution: 'NodeNext',
      lib: ['es2018']
    }
  }, null, 2)

  await fs.writeFile(join(dir, 'tsconfig.json'), tsconfig)

  await execa('node', [desm.join(import.meta.url, '..', 'cli.mjs'), app.url + '/graphql', '--name', 'movies'])

  t.diagnostic(`upstream URL is ${app.url}`)

  const app2 = await buildService('./platformatic.service.json')
  await app2.start()

  t.after(async () => { await app2.close() })
  t.after(async () => { await app.close() })

  const res = await request(app2.url, {
    method: 'POST'
  })
  const body = await res.body.json()
  match(body, {
    title: 'foo'
  })
})
