import { request, moveToTmpdir } from './helper.js'
import { test, after } from 'node:test'
import { equal } from 'node:assert'
import { match } from '@platformatic/utils'
import { buildServer } from '@platformatic/db'
import { join } from 'path'
import * as desm from 'desm'
import { execa } from 'execa'
import { promises as fs, existsSync } from 'fs'
import split from 'split2'
import graphql from 'graphql'
import { copy } from 'fs-extra'

const env = { ...process.env, NODE_V8_COVERAGE: undefined }

function findTSCPath () {
  let tscPath = desm.join(import.meta.url, '..', 'node_modules', '.bin', 'tsc')

  // If the local npm installation should use global tsc in the root
  if (!existsSync(tscPath)) {
    tscPath = desm.join(import.meta.url, '../../..', 'node_modules', '.bin', 'tsc')
  }

  return tscPath
}

test('dashes in name', async (t) => {
  try {
    await fs.unlink(desm.join(import.meta.url, 'fixtures', 'movies', 'db.sqlite'))
  } catch {
    // noop
  }
  const app = await buildServer(desm.join(import.meta.url, 'fixtures', 'movies', 'zero.db.json'))

  await app.start()

  const dir = await moveToTmpdir(after)

  await execa('node', [desm.join(import.meta.url, '..', 'cli.mjs'), app.url + '/graphql', '--name', 'uncanny-movies'])

  const readSDL = await fs.readFile(join(dir, 'uncanny-movies', 'uncanny-movies.schema.graphql'), 'utf8')
  {
    const schema = graphql.buildSchema(readSDL)
    const sdl = graphql.printSchema(schema)
    equal(sdl, readSDL)
  }

  const toWrite = `
'use strict'

const Fastify = require('fastify')
const movies = require('./uncanny-movies')
const app = Fastify({ logger: true })

app.register(movies, { url: '${app.url}' })
app.post('/', async (request, reply) => {
  const res = await request.uncannyMovies.graphql({
    query: 'mutation { saveMovie(input: { title: "foo" }) { id, title } }'
  })
  return res
})
app.listen({ port: 0 })
`
  await fs.writeFile(join(dir, 'index.js'), toWrite)

  const server2 = execa('node', ['index.js'], { env })
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
    method: 'POST',
  })
  const body = await res.body.json()
  equal(match(body, {
    title: 'foo',
  }), true)
})

test('dashes in name (typescript)', async (t) => {
  try {
    await fs.unlink(desm.join(import.meta.url, 'fixtures', 'movies', 'db.sqlite'))
  } catch {
    // noop
  }
  const app = await buildServer(desm.join(import.meta.url, 'fixtures', 'movies', 'zero.db.json'))

  await app.start()

  const dir = await moveToTmpdir(after)

  await execa('node', [desm.join(import.meta.url, '..', 'cli.mjs'), app.url + '/graphql', '--name', 'uncanny-movies'])

  const toWrite = `
import Fastify from 'fastify';
import movies from './uncanny-movies';

const app = Fastify({ logger: true });
app.register(movies, {
  url: '${app.url}'
});

app.post('/', async (req) => {
  const res = await req.uncannyMovies.graphql({
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
      lib: ['es2018'],
    },
  }, null, 2)

  await fs.writeFile(join(dir, 'tsconfig.json'), tsconfig)

  const tsc = findTSCPath()
  await execa(tsc, [], { env })

  // TODO how can we avoid this copy?
  await copy(join(dir, 'uncanny-movies'), join(dir, 'build', 'uncanny-movies'))

  const server2 = execa('node', ['build/index.js'], { env })
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
    method: 'POST',
  })
  const body = await res.body.json()
  equal(match(body, {
    title: 'foo',
  }), true)
})

test('different folder name', async (t) => {
  try {
    await fs.unlink(desm.join(import.meta.url, 'fixtures', 'movies', 'db.sqlite'))
  } catch {
    // noop
  }
  const app = await buildServer(desm.join(import.meta.url, 'fixtures', 'movies', 'zero.db.json'))

  await app.start()

  const dir = await moveToTmpdir(after)

  await execa('node', [desm.join(import.meta.url, '..', 'cli.mjs'), app.url + '/graphql', '--name', 'movies', '--folder', 'uncanny'])

  const readSDL = await fs.readFile(join(dir, 'uncanny', 'movies.schema.graphql'), 'utf8')
  {
    const schema = graphql.buildSchema(readSDL)
    const sdl = graphql.printSchema(schema)
    equal(sdl, readSDL)
  }

  const toWrite = `
'use strict'

const Fastify = require('fastify')
const movies = require('./uncanny')
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

  const server2 = execa('node', ['index.js'], { env })
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
    method: 'POST',
  })
  const body = await res.body.json()
  equal(match(body, {
    title: 'foo',
  }), true)
})

test('tilde in name', async (t) => {
  try {
    await fs.unlink(desm.join(import.meta.url, 'fixtures', 'movies', 'db.sqlite'))
  } catch {
    // noop
  }
  const app = await buildServer(desm.join(import.meta.url, 'fixtures', 'movies', 'zero.db.json'))

  await app.start()

  const dir = await moveToTmpdir(after)

  await execa('node', [desm.join(import.meta.url, '..', 'cli.mjs'), app.url + '/graphql', '--name', 'uncanny~movies'])

  const readSDL = await fs.readFile(join(dir, 'uncanny~movies', 'uncanny~movies.schema.graphql'), 'utf8')
  {
    const schema = graphql.buildSchema(readSDL)
    const sdl = graphql.printSchema(schema)
    equal(sdl, readSDL)
  }

  const toWrite = `
'use strict'

const Fastify = require('fastify')
const movies = require('./uncanny~movies')
const app = Fastify({ logger: true })

app.register(movies, { url: '${app.url}' })
app.post('/', async (request, reply) => {
  const res = await request.uncannyMovies.graphql({
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
    method: 'POST',
  })
  const body = await res.body.json()
  equal(match(body, {
    title: 'foo',
  }), true)
})
