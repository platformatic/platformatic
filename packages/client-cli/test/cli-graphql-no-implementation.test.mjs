import { request, moveToTmpdir } from './helper.js'
import { test } from 'tap'
import { buildServer } from '@platformatic/db'
import { join } from 'path'
import * as desm from 'desm'
import { execa } from 'execa'
import { promises as fs } from 'fs'
import split from 'split2'
import graphql from 'graphql'
import dotenv from 'dotenv'

test('graphql client generation (javascript)', async ({ teardown, comment, same, equal, match }) => {
  try {
    await fs.unlink(desm.join(import.meta.url, 'fixtures', 'movies', 'db.sqlite'))
  } catch {
    // noop
  }
  const app = await buildServer(desm.join(import.meta.url, 'fixtures', 'movies', 'zero.db.json'))

  await app.start()

  const dir = await moveToTmpdir(teardown)

  comment(`working in ${dir}`)

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
    const res = await app.movies.graphql({
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

  const server2 = execa(desm.join(import.meta.url, '..', 'node_modules', '.bin', 'plt-service'), ['start'])

  teardown(() => server2.kill())
  teardown(async () => { await app.close() })

  const stream = server2.stdout.pipe(split(JSON.parse))

  // this is unfortuate :(
  const base = 'Server listening at '
  let url
  for await (const line of stream) {
    const msg = line.msg
    if (msg.indexOf(base) !== 0) {
      continue
    }
    url = msg.slice(base.length)
    break
  }
  if (!url) {
    throw new Error('no url was found')
  }
  const res = await request(url, {
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

test('graphql client generation (typescript)', async ({ teardown, comment, same, match }) => {
  try {
    await fs.unlink(desm.join(import.meta.url, 'fixtures', 'movies', 'db.sqlite'))
  } catch {
    // noop
  }
  const app = await buildServer(desm.join(import.meta.url, 'fixtures', 'movies', 'zero.db.json'))

  await app.start()

  const dir = await moveToTmpdir(teardown)

  comment(`working in ${dir}`)

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
import { FastifyPluginAsync } from 'fastify'

const myPlugin: FastifyPluginAsync<{}> = async (app, options) => {
  app.post('/', async (request, reply) => {
    const res = await app.movies.graphql({
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
      moduleResolution: 'node',
      lib: ['es2018']
    }
  }, null, 2)

  await fs.writeFile(join(dir, 'tsconfig.json'), tsconfig)

  await execa('node', [desm.join(import.meta.url, '..', 'cli.mjs'), app.url + '/graphql', '--name', 'movies'])

  comment(`upstream URL is ${app.url}`)

  const server2 = execa(desm.join(import.meta.url, '..', 'node_modules', '.bin', 'plt-service'), ['start'])

  teardown(() => server2.kill())
  teardown(async () => { await app.close() })

  const stream = server2.stdout.pipe(split(JSON.parse))

  // this is unfortuate :(
  const base = 'Server listening at '
  let url
  for await (const line of stream) {
    const msg = line.msg
    if (msg.indexOf(base) !== 0) {
      continue
    }
    url = msg.slice(base.length)
    break
  }
  comment(`client URL is ${url}`)
  const res = await request(url, {
    method: 'POST'
  })
  const body = await res.body.json()
  match(body, {
    title: 'foo'
  })
})
