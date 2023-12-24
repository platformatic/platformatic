import { request, moveToTmpdir } from './helper.js'
import { test, after } from 'node:test'
import { equal } from 'node:assert'
import { match } from '@platformatic/utils'
import { buildServer } from '@platformatic/db'
import { join } from 'path'
import * as desm from 'desm'
import { execa } from 'execa'
import { promises as fs } from 'fs'
import split from 'split2'
import graphql from 'graphql'
import { copy } from 'fs-extra'

const env = { ...process.env, NODE_V8_COVERAGE: undefined }

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
  await execa('node', [desm.join(import.meta.url, '..', 'cli.mjs'), app.url, '--name', 'movies', '--type', 'graphql'])

  const readSDL = await fs.readFile(join(dir, 'movies', 'movies.schema.graphql'), 'utf8')
  {
    const schema = graphql.buildSchema(readSDL)
    const sdl = graphql.printSchema(schema)
    equal(sdl, readSDL)
  }

  t.diagnostic(`server at ${app.url}`)

  const toWrite = `
'use strict'

const Fastify = require('fastify')
const movies = require('./movies')
const app = Fastify({ logger: true })

app.register(movies, { url: '${app.url}' })
app.post('/', async (request, reply) => {
  const res = await request.movies.graphql({
    query: 'mutation { saveMovie(input: { title: "foo" }) { id, title } }'
  })
  return res
})
app.listen({ port: 0 })
`
  await fs.writeFile(join(dir, 'index.js'), toWrite)

  const server2 = execa('node', ['index.js'])
  t.after(() => server2.kill())
  t.after(async () => { await app.close() })

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
  await execa('node', [desm.join(import.meta.url, '..', 'cli.mjs'), app.url + '/graphql', '--name', 'movies'])

  t.diagnostic(`upstream URL is ${app.url}`)

  const toWrite = `
import Fastify from 'fastify';
import movies from './movies';

const app = Fastify({ logger: true });
app.register(movies, {
  url: '${app.url}'
});

app.post('/', async (req) => {
  const res = await req.movies.graphql({
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
      moduleResolution: 'NodeNext',
      lib: ['es2018']
    }
  }, null, 2)

  await fs.writeFile(join(dir, 'tsconfig.json'), tsconfig)

  const tsc = desm.join(import.meta.url, '..', 'node_modules', '.bin', 'tsc')
  await execa(tsc, [], { env })

  // TODO how can we avoid this copy?
  await copy(join(dir, 'movies'), join(dir, 'build', 'movies'))

  const server2 = execa('node', ['build/index.js'])
  t.after(() => server2.kill())
  t.after(async () => { await app.close() })

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
  t.diagnostic(`client URL is ${url}`)
  const res = await request(url, {
    method: 'POST'
  })
  const body = await res.body.json()
  match(body, {
    title: 'foo'
  })
})

test('graphql client generation with relations (typescript)', async (t) => {
  try {
    await fs.unlink(desm.join(import.meta.url, 'fixtures', 'movies-quotes', 'db.sqlite'))
  } catch {
    // noop
  }
  const app = await buildServer(desm.join(import.meta.url, 'fixtures', 'movies-quotes', 'platformatic.db.json'))

  await app.start()

  const dir = await moveToTmpdir(after)

  t.diagnostic(`working in ${dir}`)
  await execa('node', [desm.join(import.meta.url, '..', 'cli.mjs'), app.url + '/graphql', '--name', 'movies'])

  const toWrite = `
import Fastify from 'fastify';
import movies from './movies';
import type { Movie, Quote } from './movies';

const app = Fastify({ logger: true });
app.register(movies, {
  url: '${app.url}'
});

app.post('/', async (req) => {
  const res1 = await req.movies.graphql<Movie>({
    query: \`mutation {
      saveMovie(input: { title: "foo" }) { id, title } }
    \`
  })
  const res2 = await req.movies.graphql<Quote>({
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
      moduleResolution: 'NodeNext',
      lib: ['es2018']
    }
  }, null, 2)

  await fs.writeFile(join(dir, 'tsconfig.json'), tsconfig)

  const tsc = desm.join(import.meta.url, '..', 'node_modules', '.bin', 'tsc')
  await execa(tsc, [], { env })

  // TODO how can we avoid this symlink?
  await copy(join(dir, 'movies'), join(dir, 'build', 'movies'))

  const server2 = execa('node', ['build/index.js'])
  t.after(() => server2.kill())
  t.after(async () => { await app.close() })

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

test('graphql client generation (javascript) with slash at the end of the URL', async (t) => {
  try {
    await fs.unlink(desm.join(import.meta.url, 'fixtures', 'movies', 'db.sqlite'))
  } catch {
    // noop
  }
  const app = await buildServer(desm.join(import.meta.url, 'fixtures', 'movies', 'zero.db.json'))

  await app.start()

  const dir = await moveToTmpdir(after)

  t.diagnostic(`working in ${dir}`)
  await execa('node', [desm.join(import.meta.url, '..', 'cli.mjs'), app.url + '/graphql', '--name', 'movies'])

  t.diagnostic(`server at ${app.url}`)

  const toWrite = `
'use strict'

const Fastify = require('fastify')
const movies = require('./movies')
const app = Fastify({ logger: true })

app.register(movies, { url: '${app.url}/' })
app.post('/', async (request, reply) => {
  const res = await request.movies.graphql({
    query: 'mutation { saveMovie(input: { title: "foo" }) { id, title } }'
  })
  return res
})
app.listen({ port: 0 })
`
  await fs.writeFile(join(dir, 'index.js'), toWrite)

  const server2 = execa('node', ['index.js'])
  t.after(() => server2.kill())
  t.after(async () => { await app.close() })

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

test('configureClient (typescript)', async (t) => {
  try {
    await fs.unlink(desm.join(import.meta.url, 'fixtures', 'movies', 'db.sqlite'))
  } catch {
    // noop
  }
  const app = await buildServer(desm.join(import.meta.url, 'fixtures', 'movies', 'zero.db.json'))

  await app.start()

  const dir = await moveToTmpdir(after)

  t.diagnostic(`working in ${dir}`)
  await execa('node', [desm.join(import.meta.url, '..', 'cli.mjs'), app.url + '/graphql', '--name', 'movies'])

  t.diagnostic(`upstream URL is ${app.url}`)

  const toWrite = `
import Fastify from 'fastify';
import movies from './movies';

const app = Fastify({ logger: true });
app.register(movies, {
  url: '${app.url}'
});

app.register(async function (app) {
  app.configureMovies({
    async getHeaders (req, reply) {
      return { foo: 'bar' }
    }
  })
});

app.post('/', async (req) => {
  const res = await req.movies.graphql({
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
      moduleResolution: 'NodeNext',
      lib: ['es2018']
    }
  }, null, 2)

  await fs.writeFile(join(dir, 'tsconfig.json'), tsconfig)

  const tsc = desm.join(import.meta.url, '..', 'node_modules', '.bin', 'tsc')
  await execa(tsc, [], { env })

  // TODO how can we avoid this copy?
  await copy(join(dir, 'movies'), join(dir, 'build', 'movies'))

  const server2 = execa('node', ['build/index.js'])
  t.after(() => server2.kill())
  t.after(async () => { await app.close() })

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
  t.diagnostic(`client URL is ${url}`)
  const res = await request(url, {
    method: 'POST'
  })
  const body = await res.body.json()
  match(body, {
    title: 'foo'
  })
})

test('graphql client generation (javascript) from a file', async (t) => {
  try {
    await fs.unlink(desm.join(import.meta.url, 'fixtures', 'movies', 'db.sqlite'))
  } catch {
    // noop
  }
  const app = await buildServer(desm.join(import.meta.url, 'fixtures', 'movies', 'zero.db.json'))

  await app.start()

  const dir = await moveToTmpdir(after)
  t.diagnostic(`working in ${dir}`)

  const sdl = graphql.printSchema(app.graphql.schema)
  const sdlFile = join(dir, 'movies.schema.graphql')
  await fs.writeFile(sdlFile, sdl)

  await execa('node', [desm.join(import.meta.url, '..', 'cli.mjs'), sdlFile, '--name', 'movies'])

  const readSDL = await fs.readFile(join(dir, 'movies', 'movies.schema.graphql'), 'utf8')
  equal(sdl, readSDL)

  t.diagnostic(`server at ${app.url}`)

  const toWrite = `
'use strict'

const Fastify = require('fastify')
const movies = require('./movies')
const app = Fastify({ logger: true })

app.register(movies, { url: '${app.url}' })
app.post('/', async (request, reply) => {
  const res = await request.movies.graphql({
    query: 'mutation { saveMovie(input: { title: "foo" }) { id, title } }'
  })
  return res
})
app.listen({ port: 0 })
`
  await fs.writeFile(join(dir, 'index.js'), toWrite)

  const server2 = execa('node', ['index.js'])
  t.after(() => server2.kill())
  t.after(async () => { await app.close() })

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
