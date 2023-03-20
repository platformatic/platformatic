import { request, moveToTmpdir, installDeps } from './helper.js'
import { test } from 'tap'
import { buildServer } from '@platformatic/db'
import service from '@platformatic/service'
import { join } from 'path'
import * as desm from 'desm'
import { execa } from 'execa'
import { promises as fs } from 'fs'
import split from 'split2'
import graphql from 'graphql'
import { copy } from 'fs-extra'

test('graphql client generation (javascript)', async ({ teardown, comment, same, equal, match }) => {
  try {
    await fs.unlink(desm.join(import.meta.url, 'fixtures', 'movies', 'db.sqlite'))
  } catch {
    // noop
  }
  const server = await buildServer(desm.join(import.meta.url, 'fixtures', 'movies', 'zero.db.json'))

  await server.listen()

  const dir = await moveToTmpdir(teardown)

  comment(`working in ${dir}`)
  await execa('node', [desm.join(import.meta.url, '..', 'cli.mjs'), server.url + '/graphql', '--name', 'movies'])

  const readSDL = await fs.readFile(join(dir, 'movies', 'movies.schema.graphql'), 'utf8')
  {
    const schema = graphql.buildSchema(readSDL)
    const sdl = graphql.printSchema(schema)
    equal(sdl, readSDL)
  }

  comment(`server at ${server.url}`)

  const toWrite = `
'use strict'

const Fastify = require('fastify')
const movies = require('./movies')
const app = Fastify({ logger: true })

app.register(movies, { url: '${server.url}' })
app.post('/', async (request, reply) => {
  const res = await app.movies.graphql({
    query: 'mutation { saveMovie(input: { title: "foo" }) { id, title } }'
  })
  return res 
})
app.listen({ port: 0 })
`
  await fs.writeFile(join(dir, 'index.js'), toWrite)
  await installDeps(dir)

  const server2 = execa('node', ['index.js'])
  teardown(() => server2.kill())
  teardown(server.stop)

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
})

test('graphql client generation (typescript)', async ({ teardown, comment, same, match }) => {
  try {
    await fs.unlink(desm.join(import.meta.url, 'fixtures', 'movies', 'db.sqlite'))
  } catch {
    // noop
  }
  const server = await buildServer(desm.join(import.meta.url, 'fixtures', 'movies', 'zero.db.json'))

  await server.listen()

  const dir = await moveToTmpdir(teardown)

  comment(`working in ${dir}`)
  await execa('node', [desm.join(import.meta.url, '..', 'cli.mjs'), server.url + '/graphql', '--name', 'movies'])

  comment(`upstream URL is ${server.url}`)

  const toWrite = `
import Fastify from 'fastify';
import movies from './movies';

const app = Fastify({ logger: true });
app.register(movies, {
  url: '${server.url}'
});

app.post('/', async () => {
  const res = await app.movies.graphql({
    query: 'mutation { saveMovie(input: { title: "foo" }) { id, title } }'
  })
  return res 
})

app.listen({ port: 0 });
`

  await fs.writeFile(join(dir, 'index.ts'), toWrite)

  const tsconfig = JSON.stringify({
    extends: 'fastify-tsconfig',
    compilerOptions: {
      outDir: 'build',
      target: 'es2018',
      lib: ['es2018']
    }
  }, null, 2)

  await fs.writeFile(join(dir, 'tsconfig.json'), tsconfig)

  await installDeps(dir)

  const tsc = desm.join(import.meta.url, '..', 'node_modules', '.bin', 'tsc')
  await execa(tsc)

  // TODO how can we avoid this copy?
  await copy(join(dir, 'movies'), join(dir, 'build', 'movies'))

  const server2 = execa('node', ['build/index.js'])
  teardown(() => server2.kill())
  teardown(server.stop)

  const stream = server2.stdout.pipe(split(JSON.parse))
  server2.stderr.pipe(process.stderr)

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

test('graphql client generation with relations (typescript)', async ({ teardown, comment, same, match }) => {
  try {
    await fs.unlink(desm.join(import.meta.url, 'fixtures', 'movies-quotes', 'db.sqlite'))
  } catch {
    // noop
  }
  const server = await buildServer(desm.join(import.meta.url, 'fixtures', 'movies-quotes', 'platformatic.db.json'))

  await server.listen()

  const dir = await moveToTmpdir(teardown)

  comment(`working in ${dir}`)
  await execa('node', [desm.join(import.meta.url, '..', 'cli.mjs'), server.url + '/graphql', '--name', 'movies'])

  const toWrite = `
import Fastify from 'fastify';
import movies from './movies';
import type { Movie, Quote } from './movies';

const app = Fastify({ logger: true });
app.register(movies, {
  url: '${server.url}'
});

app.post('/', async () => {
  const res1 = await app.movies.graphql<Movie>({
    query: \`mutation {
      saveMovie(input: { title: "foo" }) { id, title } }
    \` 
  })
  const res2 = await app.movies.graphql<Quote>({
    query: \`
      mutation saveQuote($movieId: ID!) {
        saveQuote(input: { movieId: $movieId, quote: "foo"}) {
          id
          quote
          movie {
            id
            title
          }
        }
      }
    \`,
    variables: {
      movieId: res1.id
    }
  })
  return res2
})

app.listen({ port: 0});
`

  await fs.writeFile(join(dir, 'index.ts'), toWrite)

  const tsconfig = JSON.stringify({
    extends: 'fastify-tsconfig',
    compilerOptions: {
      outDir: 'build',
      target: 'es2018',
      lib: ['es2018']
    }
  }, null, 2)

  await fs.writeFile(join(dir, 'tsconfig.json'), tsconfig)
  await installDeps(dir)

  const tsc = desm.join(import.meta.url, '..', 'node_modules', '.bin', 'tsc')
  await execa(tsc)

  // TODO how can we avoid this symlink?
  await copy(join(dir, 'movies'), join(dir, 'build', 'movies'))

  const server2 = execa('node', ['build/index.js'])
  teardown(() => server2.kill())
  teardown(server.stop)

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
  const res = await request(url, {
    method: 'POST'
  })
  const body = await res.body.json()
  match(body, {
    quote: 'foo',
    movie: {
      title: 'foo'
    }
  })
})

test('graphql client generation (javascript) with slash at the end of the URL', async ({ teardown, comment, same, match }) => {
  try {
    await fs.unlink(desm.join(import.meta.url, 'fixtures', 'movies', 'db.sqlite'))
  } catch {
    // noop
  }
  const server = await buildServer(desm.join(import.meta.url, 'fixtures', 'movies', 'zero.db.json'))

  await server.listen()

  const dir = await moveToTmpdir(teardown)

  comment(`working in ${dir}`)
  await execa('node', [desm.join(import.meta.url, '..', 'cli.mjs'), server.url + '/graphql', '--name', 'movies'])

  comment(`server at ${server.url}`)

  const toWrite = `
'use strict'

const Fastify = require('fastify')
const movies = require('./movies')
const app = Fastify({ logger: true })

app.register(movies, { url: '${server.url}/' })
app.post('/', async (request, reply) => {
  const res = await app.movies.graphql({
    query: 'mutation { saveMovie(input: { title: "foo" }) { id, title } }'
  })
  return res 
})
app.listen({ port: 0 })
`
  await fs.writeFile(join(dir, 'index.js'), toWrite)
  await installDeps(dir)

  const server2 = execa('node', ['index.js'])
  teardown(() => server2.kill())
  teardown(server.stop)

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
  const res = await request(url, {
    method: 'POST'
  })
  const body = await res.body.json()
  match(body, {
    title: 'foo'
  })
})

test('adds clients to platformatic service', async ({ teardown, comment, same, match }) => {
  try {
    await fs.unlink(desm.join(import.meta.url, 'fixtures', 'movies', 'db.sqlite'))
  } catch {
    // noop
  }
  const server = await buildServer(desm.join(import.meta.url, 'fixtures', 'movies', 'zero.db.json'))

  await server.listen()

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

  await fs.writeFile('./platformatic.service.json', JSON.stringify(pltServiceConfig, null, 2))

  await execa('node', [desm.join(import.meta.url, '..', 'cli.mjs'), server.url + '/graphql', '--name', 'movies'])

  {
    const newConfig = JSON.parse(await fs.readFile('./platformatic.service.json', 'utf8'))
    same(newConfig, {
      $schema: 'https://platformatic.dev/schemas/v0.18.0/service',
      server: {
        hostname: '127.0.0.1',
        port: 0
      },
      plugins: {
        paths: ['./plugin.js']
      },
      clients: [{
        path: './movies',
        url: '{PLT_MOVIES_URL}'
      }]
    })
  }

  comment(`server at ${server.url}`)

  const toWrite = `
module.exports = async function (app, opts) {
  app.post('/', async (request, reply) => {
    const res = await app.movies.graphql({
      query: 'mutation { saveMovie(input: { title: "foo" }) { id, title } }'
    })
    return res 
  })
}
`
  await fs.writeFile(join(dir, 'plugin.js'), toWrite)
  await installDeps(dir)

  process.env.PLT_MOVIES_URL = server.url

  const server2 = await service.buildServer('./platformatic.service.json')
  await server2.listen()
  teardown(server2.stop)
  teardown(server.stop)

  const res = await request(server2.url, {
    method: 'POST'
  })
  const body = await res.body.json()
  match(body, {
    title: 'foo'
  })
})
