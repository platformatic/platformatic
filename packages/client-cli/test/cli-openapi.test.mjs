import { request, moveToTmpdir } from './helper.js'
import { test, after } from 'node:test'
import { equal, deepEqual as same, rejects } from 'node:assert'
import { match } from '@platformatic/utils'
import { buildServer } from '@platformatic/runtime'
import { join } from 'path'
import * as desm from 'desm'
import { execa } from 'execa'
import { promises as fs } from 'fs'
import split from 'split2'
import { copy } from 'fs-extra'
import dotenv from 'dotenv'
import { readFile } from 'fs/promises'
import { isFileAccessible } from '../cli.mjs'

const env = { ...process.env, NODE_V8_COVERAGE: undefined }

test('openapi client generation (javascript)', async (t) => {
  try {
    await fs.unlink(desm.join(import.meta.url, 'fixtures', 'movies', 'db.sqlite'))
  } catch {
    // noop
  }
  const app = await buildServer(desm.join(import.meta.url, 'fixtures', 'movies', 'zero.db.json'))

  await app.start()

  const dir = await moveToTmpdir(after)
  t.diagnostic(`working in ${dir}`)

  await execa('node', [desm.join(import.meta.url, '..', 'cli.mjs'), app.url, '--name', 'movies', '--type', 'openapi'])

  const toWrite = `
'use strict'

const Fastify = require('fastify')
const movies = require('./movies')
const app = Fastify({ logger: true })

app.register(movies, { url: '${app.url}' })
app.post('/', async (request, reply) => {
  const res = await request.movies.createMovie({ title: 'foo' })
  return res
})
app.listen({ port: 0 })
`
  await fs.writeFile(join(dir, 'index.js'), toWrite)

  const app2 = execa('node', ['index.js'], { env })
  t.after(() => app2.kill())
  t.after(async () => { await app.close() })

  const stream = app2.stdout.pipe(split(JSON.parse))

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
  same(body, {
    id: 1,
    title: 'foo'
  })
})

test('openapi client generation (typescript)', async (t) => {
  try {
    await fs.unlink(desm.join(import.meta.url, 'fixtures', 'movies', 'db.sqlite'))
  } catch {
    // noop
  }
  const app = await buildServer(desm.join(import.meta.url, 'fixtures', 'movies', 'zero.db.json'))

  await app.start()

  const dir = await moveToTmpdir(after)

  t.diagnostic(`working in ${dir}`)
  await execa('node', [desm.join(import.meta.url, '..', 'cli.mjs'), app.url + '/documentation/json', '--name', 'movies'])

  const toWrite = `
import Fastify from 'fastify';
import movies from './movies';

const app = Fastify({ logger: true });
app.register(movies, {
  url: '${app.url}'
});

app.get('/', async (req) => {
  const res = await req.movies.getMovies()
  return res
})

app.post('/', async (req) => {
  const res = await req.movies.createMovie({ title: 'foo' })
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
      esModuleInterop: true
    }
  }, null, 2)

  await fs.writeFile(join(dir, 'tsconfig.json'), tsconfig)

  const tsc = desm.join(import.meta.url, '..', 'node_modules', '.bin', 'tsc')
  await execa(tsc, [], { env })

  // TODO how can we avoid this copy?
  await copy(join(dir, 'movies'), join(dir, 'build', 'movies'))

  const server2 = execa('node', ['build/index.js'], { env })
  t.after(() => server2.kill())
  t.after(async () => { await app.close() })

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
  const res = await request(url, {
    method: 'POST'
  })
  const body = await res.body.json()
  same(body, {
    id: 1,
    title: 'foo'
  })
})

test('openapi client generation (javascript) with slash at the end', async (t) => {
  try {
    await fs.unlink(desm.join(import.meta.url, 'fixtures', 'movies', 'db.sqlite'))
  } catch {
    // noop
  }
  const app = await buildServer(desm.join(import.meta.url, 'fixtures', 'movies', 'zero.db.json'))

  await app.start()

  const dir = await moveToTmpdir(after)

  t.diagnostic(`working in ${dir}`)
  await execa('node', [desm.join(import.meta.url, '..', 'cli.mjs'), app.url + '/documentation/json', '--name', 'movies'])

  const toWrite = `
'use strict'

const Fastify = require('fastify')
const movies = require('./movies')
const app = Fastify({ logger: true })

app.register(movies, { url: '${app.url}/' })
app.post('/', async (request, reply) => {
  const res = await request.movies.createMovie({ title: 'foo' })
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
  const res = await request(url, {
    method: 'POST'
  })
  const body = await res.body.json()
  same(body, {
    id: 1,
    title: 'foo'
  })
})

test('no such file', async (t) => {
  try {
    await fs.unlink(desm.join(import.meta.url, 'fixtures', 'movies', 'db.sqlite'))
  } catch {
    // noop
  }
  const app = await buildServer(desm.join(import.meta.url, 'fixtures', 'movies', 'zero.db.json'))

  await app.start()
  t.after(async () => {
    await app.close()
  })

  await moveToTmpdir(after)
  await rejects(execa('node', [desm.join(import.meta.url, '..', 'cli.mjs'), `${app.url}/foo/bar`, '--name', 'movies']))
})

test('no such file', async (t) => {
  await rejects(execa('node', [desm.join(import.meta.url, '..', 'cli.mjs')]))
})

test('datatypes', async (t) => {
  try {
    await fs.unlink(desm.join(import.meta.url, 'fixtures', 'movies-quotes', 'db.sqlite'))
  } catch {
    // noop
  }
  const app = await buildServer(desm.join(import.meta.url, 'fixtures', 'movies-quotes', 'platformatic.db.json'))

  await app.start()

  const dir = await moveToTmpdir(after)

  t.diagnostic(`working in ${dir}`)
  await execa('node', [desm.join(import.meta.url, '..', 'cli.mjs'), app.url + '/documentation/json', '--name', 'movies'])

  const toWrite = `
'use strict'

const Fastify = require('fastify')
const movies = require('./movies')
const app = Fastify({ logger: true })

app.register(movies, { url: '${app.url}' })
app.post('/', async (request, reply) => {
  const res = await request.movies.createMovie({ title: 'foo' })
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
  const res = await request(url, {
    method: 'POST'
  })
  const body = await res.body.json()
  equal(match(body, {
    id: 1,
    title: 'foo'
  }), true)
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
  await execa('node', [desm.join(import.meta.url, '..', 'cli.mjs'), app.url + '/documentation/json', '--name', 'movies'])

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
  const res = await req.movies.createMovie({ title: 'foo' })
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
      esModuleInterop: true
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
  const res = await request(url, {
    method: 'POST'
  })
  const body = await res.body.json()
  same(body, {
    id: 1,
    title: 'foo'
  })
})

test('dotenv & config support', async (t) => {
  try {
    await fs.unlink(desm.join(import.meta.url, 'fixtures', 'movies', 'db.sqlite'))
  } catch {
    // noop
  }
  const app = await buildServer(desm.join(import.meta.url, 'fixtures', 'movies', 'zero.db.json'))

  await app.start()
  t.after(async () => {
    await app.close()
  })

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

  await fs.writeFile('./platformatic.service.json', JSON.stringify(pltServiceConfig, null, 2))

  await fs.writeFile(join(dir, '.env'), 'FOO=bar')
  await fs.writeFile(join(dir, '.env.sample'), 'FOO=bar')

  await execa('node', [desm.join(import.meta.url, '..', 'cli.mjs'), app.url + '/documentation/json', '--name', 'movies'])

  const url = app.url + '/'
  {
    const envs = dotenv.parse(await fs.readFile(join(dir, '.env')))
    same(envs, {
      FOO: 'bar',
      PLT_MOVIES_URL: url
    })
  }

  {
    const envs = dotenv.parse(await fs.readFile(join(dir, '.env.sample')))
    same(envs, {
      FOO: 'bar',
      PLT_MOVIES_URL: url
    })
  }
})

test('full-response option', async (t) => {
  try {
    await fs.unlink(desm.join(import.meta.url, 'fixtures', 'movies', 'db.sqlite'))
  } catch {
    // noop
  }
  const app = await buildServer(desm.join(import.meta.url, 'fixtures', 'movies', 'zero.db.json'))

  await app.start()

  const dir = await moveToTmpdir(after)
  t.diagnostic(`working in ${dir}`)

  await execa('node', [desm.join(import.meta.url, '..', 'cli.mjs'), app.url + '/documentation/json', '--name', 'movies', '--full-response'])

  const toWrite = `
'use strict'

const Fastify = require('fastify')
const movies = require('./movies')
const app = Fastify({ logger: true })

app.register(movies, { url: '${app.url}' })
app.post('/', async (request, reply) => {
  const res = await request.movies.createMovie({ title: 'foo' })
  return res
})
app.listen({ port: 0 })
`
  await fs.writeFile(join(dir, 'index.js'), toWrite)
  const app2 = execa('node', ['index.js'])
  t.after(() => app2.kill())
  t.after(async () => { await app.close() })

  const stream = app2.stdout.pipe(split(JSON.parse))

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
  {
    const res = await request(url, {
      method: 'POST'
    })
    const body = await res.body.json()
    const matchDate = /[a-z]{3}, \d{2} [a-z]{3} \d{4} \d{2}:\d{2}:\d{2} GMT/i
    const matchKeepAlive = /timeout=\d+/

    equal(match(body, {
      statusCode: 200,
      headers: {
        location: '/movies/1',
        'content-type': 'application/json; charset=utf-8',
        'content-length': '22',
        date: matchDate,
        connection: 'keep-alive',
        'keep-alive': matchKeepAlive
      },
      body: {
        id: 1,
        title: 'foo'
      }
    }), true)
  }

  {
    const res = await request(`${app.url}/redirect-me`)
    equal(match(res.statusCode, 302), true)
    equal(match(res.headers.location, 'https://google.com'), true)
  }
})

test('openapi client generation (javascript) from file', async (t) => {
  try {
    await fs.unlink(desm.join(import.meta.url, 'fixtures', 'movies', 'db.sqlite'))
  } catch {
    // noop
  }
  const app = await buildServer(desm.join(import.meta.url, 'fixtures', 'movies', 'zero.db.json'))

  await app.start()

  const dir = await moveToTmpdir(after)
  t.diagnostic(`working in ${dir}`)

  const openAPI = app.swagger()
  const openAPIfile = join(dir, 'movies.schema.json')
  await fs.writeFile(openAPIfile, JSON.stringify(openAPI, null, 2))

  await execa('node', [desm.join(import.meta.url, '..', 'cli.mjs'), openAPIfile, '--name', 'movies'])

  const toWrite = `
'use strict'

const Fastify = require('fastify')
const movies = require('./movies')
const app = Fastify({ logger: true })

app.register(movies, { url: '${app.url}' })
app.post('/', async (request, reply) => {
  const res = await request.movies.createMovie({ title: 'foo' })
  return res
})
app.listen({ port: 0 })
`
  await fs.writeFile(join(dir, 'index.js'), toWrite)

  const app2 = execa('node', ['index.js'])
  t.after(() => app2.kill())
  t.after(async () => { await app.close() })

  const stream = app2.stdout.pipe(split(JSON.parse))

  // this is unfortunate :(
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
  same(body, {
    id: 1,
    title: 'foo'
  })
})

test('name with dashes', async (t) => {
  try {
    await fs.unlink(desm.join(import.meta.url, 'fixtures', 'movies', 'db.sqlite'))
  } catch {
    // noop
  }
  const app = await buildServer(desm.join(import.meta.url, 'fixtures', 'movies', 'zero.db.json'))

  await app.start()

  const dir = await moveToTmpdir(after)
  t.diagnostic(`working in ${dir}`)

  try {
    await execa('node', [desm.join(import.meta.url, '..', 'cli.mjs'), app.url + '/documentation/json', '--name', 'uncanny-movies'])
  } catch (err) {
    console.log(err.stderr)
    throw err
  }

  {
    const pkg = JSON.parse(await fs.readFile(join(dir, 'uncanny-movies', 'package.json')))
    same(pkg, {
      name: 'uncanny-movies',
      main: './uncanny-movies.cjs',
      types: './uncanny-movies.d.ts'
    })
  }

  const toWrite = `
'use strict'

const Fastify = require('fastify')
const movies = require('./uncanny-movies')
const app = Fastify({ logger: true })

app.register(movies, { url: '${app.url}' })
app.post('/', async (request, reply) => {
  const res = await request.uncannyMovies.createMovie({ title: 'foo' })
  return res
})
app.listen({ port: 0 })
`
  await fs.writeFile(join(dir, 'index.js'), toWrite)

  const app2 = execa('node', ['index.js'])
  t.after(() => app2.kill())
  t.after(async () => { await app.close() })

  const stream = app2.stdout.pipe(split(JSON.parse))

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
  same(body, {
    id: 1,
    title: 'foo'
  })
})

test('no dashes typescript', async (t) => {
  try {
    await fs.unlink(desm.join(import.meta.url, 'fixtures', 'movies', 'db.sqlite'))
  } catch {
    // noop
  }
  const app = await buildServer(desm.join(import.meta.url, 'fixtures', 'movies', 'zero.db.json'))

  await app.start()
  const dir = await moveToTmpdir(after)

  t.diagnostic(`working in ${dir}`)
  await execa('node', [desm.join(import.meta.url, '..', 'cli.mjs'), app.url + '/documentation/json', '--name', 'uncanny-movies'])

  const toWrite = `
import Fastify from 'fastify';
import movies from './uncanny-movies';

const app = Fastify({ logger: true });
app.register(movies, {
  url: '${app.url}'
});

app.post('/', async (req) => {
  const res = await req.uncannyMovies.createMovie({ title: 'foo' })
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
      esModuleInterop: true
    }
  }, null, 2)

  await fs.writeFile(join(dir, 'tsconfig.json'), tsconfig)

  const tsc = desm.join(import.meta.url, '..', 'node_modules', '.bin', 'tsc')
  await execa(tsc, [], { env })

  // TODO how can we avoid this copy?
  await copy(join(dir, 'uncanny-movies'), join(dir, 'build', 'uncanny-movies'))

  const server2 = execa('node', ['build/index.js'])
  t.after(() => server2.kill())
  t.after(async () => { await app.close() })

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
  const res = await request(url, {
    method: 'POST'
  })
  const body = await res.body.json()
  same(body, {
    id: 1,
    title: 'foo'
  })
})

test('name with tilde', async (t) => {
  try {
    await fs.unlink(desm.join(import.meta.url, 'fixtures', 'movies', 'db.sqlite'))
  } catch {
    // noop
  }
  const app = await buildServer(desm.join(import.meta.url, 'fixtures', 'movies', 'zero.db.json'))

  await app.start()

  const dir = await moveToTmpdir(after)
  t.diagnostic(`working in ${dir}`)

  try {
    await execa('node', [desm.join(import.meta.url, '..', 'cli.mjs'), app.url + '/documentation/json', '--name', 'uncanny~movies'])
  } catch (err) {
    console.log(err.stderr)
    throw err
  }

  {
    const pkg = JSON.parse(await fs.readFile(join(dir, 'uncanny~movies', 'package.json')))
    same(pkg, {
      name: 'uncanny~movies',
      main: './uncanny~movies.cjs',
      types: './uncanny~movies.d.ts'
    })
  }

  const toWrite = `
'use strict'

const Fastify = require('fastify')
const movies = require('./uncanny~movies')
const app = Fastify({ logger: true })

app.register(movies, { url: '${app.url}' })
app.post('/', async (request, reply) => {
  const res = await request.uncannyMovies.createMovie({ title: 'foo' })
  return res
})
app.listen({ port: 0 })
`
  await fs.writeFile(join(dir, 'index.js'), toWrite)

  const app2 = execa('node', ['index.js'])
  t.after(() => app2.kill())
  t.after(async () => { await app.close() })

  const stream = app2.stdout.pipe(split(JSON.parse))

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
  same(body, {
    id: 1,
    title: 'foo'
  })
})

test('openapi client generation from YAML file', async (t) => {
  const dir = await moveToTmpdir(after)
  const openapiFile = desm.join(import.meta.url, 'fixtures', 'openapi.yaml')
  t.diagnostic(`working in ${dir}`)
  await execa('node', [desm.join(import.meta.url, '..', 'cli.mjs'), openapiFile, '--name', 'movies'])

  // check openapi json file has been created
  const jsonFile = join(dir, 'movies', 'movies.openapi.json')
  const data = await readFile(jsonFile, 'utf-8')
  const json = JSON.parse(data)
  same(json.openapi, '3.0.3')

  // Check operation names are correctly capitalized
  const typeFile = join(dir, 'movies', 'movies.d.ts')
  const typeData = await readFile(typeFile, 'utf-8')

  equal(match(typeData, 'getMovies(req?: GetMoviesRequest): Promise<GetMoviesResponses>;'), true)
})

test('nested optional parameters are correctly identified', async (t) => {
  const dir = await moveToTmpdir(after)
  const openapiFile = desm.join(import.meta.url, 'fixtures', 'optional-params-openapi.json')
  t.diagnostic(`working in ${dir}`)
  await execa('node', [desm.join(import.meta.url, '..', 'cli.mjs'), openapiFile, '--name', 'movies'])

  // check the type file has the correct implementation for the request
  const typeFile = join(dir, 'movies', 'movies.d.ts')
  const data = await readFile(typeFile, 'utf-8')

  equal(data.includes(`
  export type GetMoviesResponseOK = {
    'data': { 'foo': string; 'bar'?: string; 'baz'?: { 'nested1'?: string; 'nested2': string } };
  }
`), true)
})

test('request with same parameter name in body/path/header/query', async (t) => {
  const dir = await moveToTmpdir(after)
  const openapiFile = desm.join(import.meta.url, 'fixtures', 'same-parameter-name-openapi.json')
  t.diagnostic(`working in ${dir}`)
  await execa('node', [desm.join(import.meta.url, '..', 'cli.mjs'), openapiFile, '--name', 'movies'])
  // check the type file has the correct implementation for the request
  const typeFile = join(dir, 'movies', 'movies.d.ts')
  const data = await readFile(typeFile, 'utf-8')
  equal(data.includes(`
  export type GetMoviesRequest = {
    body: {
      'id': string;
    }
    path: {
      'id': string;
    }
    query: {
      'id': string;
    }
    headers: {
      'id': string;
    }
  }`), true)
})

test('openapi client generation (javascript) from file with fullRequest, fullResponse, validateResponse and optionalHeaders', async (t) => {
  const openapi = desm.join(import.meta.url, 'fixtures', 'full-req-res', 'openapi.json')
  const dir = await moveToTmpdir(after)
  t.diagnostic(`working in ${dir}`)

  const fullOptions = [
    ['--full-request', '--full-response'],
    ['--full']
  ]
  for (const opt of fullOptions) {
    await execa('node', [desm.join(import.meta.url, '..', 'cli.mjs'), openapi, '--name', 'full', '--validate-response', '--optional-headers', 'headerId', ...opt])

    // check the type file has the correct implementation for the request and the response
    const typeFile = join(dir, 'full', 'full.d.ts')
    const data = await readFile(typeFile, 'utf-8')
    equal(data.includes(`
  export type PostHelloRequest = {
    body: {
      'bodyId': string;
    }
    query: {
      'queryId': string;
    }
    headers?: {
      'headerId'?: string;
    }
  }
`), true)
    equal(data.includes(`
  export interface Full {
    postHello(req?: PostHelloRequest): Promise<PostHelloResponses>;
  }`), true)
    const implementationFile = join(dir, 'full', 'full.cjs')
    const implementationData = await readFile(implementationFile, 'utf-8')
    // check the implementation instantiate the client with fullRequest and fullResponse
    equal(implementationData.includes(`
async function generateFullClientPlugin (app, opts) {
  app.register(pltClient, {
    type: 'openapi',
    name: 'full',
    path: join(__dirname, 'full.openapi.json'),
    url: opts.url,
    serviceId: opts.serviceId,
    throwOnError: opts.throwOnError,
    fullResponse: true,
    fullRequest: true,
    validateResponse: true,
    getHeaders: opts.getHeaders
  })
}`), true)
  }
})

test('do not generate implementation file if in platformatic service', async (t) => {
  const openapi = desm.join(import.meta.url, 'fixtures', 'full-req-res', 'openapi.json')
  const dir = await moveToTmpdir(after)
  t.diagnostic(`working in ${dir}`)

  const pltServiceConfig = {
    $schema: 'https://platformatic.dev/schemas/v0.28.0/service',
    server: {
      hostname: '127.0.0.1',
      port: 0
    },
    plugins: {
      paths: ['./plugin.js']
    }
  }

  await fs.writeFile('./platformatic.service.json', JSON.stringify(pltServiceConfig, null, 2))

  const fullOptions = [
    ['--full-request', '--full-response'],
    ['--full']
  ]
  for (const opt of fullOptions) {
    await execa('node', [desm.join(import.meta.url, '..', 'cli.mjs'), openapi, '--name', 'full', '--validate-response', '--optional-headers', 'headerId', ...opt])

    equal(await isFileAccessible(join(dir, 'full', 'full.cjs')), false)

    // check the type file has the correct implementation for the request and the response
    const typeFile = join(dir, 'full', 'full.d.ts')
    const data = await readFile(typeFile, 'utf-8')
    equal(data.includes(`
  export type PostHelloRequest = {
    body: {
      'bodyId': string;
    }
    query: {
      'queryId': string;
    }
    headers?: {
      'headerId'?: string;
    }
  }
`), true)
    equal(data.includes(`
  export interface Full {
    postHello(req?: PostHelloRequest): Promise<PostHelloResponses>;
  }`), true)
  }
})

test('optional-headers option', async (t) => {
  const dir = await moveToTmpdir(after)
  t.diagnostic(`working in ${dir}`)

  const openAPIfile = desm.join(import.meta.url, 'fixtures', 'optional-headers-openapi.json')
  await execa('node', [desm.join(import.meta.url, '..', 'cli.mjs'), openAPIfile, '--name', 'movies', '--optional-headers', 'foobar,authorization', '--types-only'])

  const typeFile = join(dir, 'movies.d.ts')
  const data = await readFile(typeFile, 'utf-8')
  equal(data.includes(`
  export type PostHelloRequest = {
    'authorization'?: string;
  }
`), true)
})

test('common parameters in paths', async (t) => {
  const dir = await moveToTmpdir(after)
  t.diagnostic(`working in ${dir}`)

  const openAPIfile = desm.join(import.meta.url, 'fixtures', 'common-parameters', 'openapi.json')
  await execa('node', [desm.join(import.meta.url, '..', 'cli.mjs'), openAPIfile, '--name', 'movies', '--full-request'])

  const typeFile = join(dir, 'movies', 'movies.d.ts')
  const data = await readFile(typeFile, 'utf-8')
  equal(data.includes(`
  export type GetPathWithFieldIdRequest = {
    path: {
      'fieldId': string;
    }
    query: {
      'movieId': string;
    }
  }
`), true)
  equal(data.includes(`
  export type GetSampleRequest = {
    query: {
      'movieId': string;
    }
  }
`), true)
  equal(data.includes(`
  export type PostPathWithFieldIdRequest = {
    path: {
      'fieldId': string;
    }
  }
`), true)
  // test implementation
  try {
    await fs.unlink(desm.join(import.meta.url, 'fixtures', 'common-parameters', 'db.sqlite'))
  } catch {
    // noop
  }
  const app = await buildServer(desm.join(import.meta.url, 'fixtures', 'common-parameters', 'platformatic.service.json'))

  await app.start()

  t.diagnostic(`working in ${dir}`)
  await execa('node', [desm.join(import.meta.url, '..', 'cli.mjs'), openAPIfile, '--name', 'commonparams', '--full-request'])

  const toWrite = `
'use strict'

const Fastify = require('fastify')
const commonparams = require('./commonparams')
const app = Fastify({ logger: true })

app.register(commonparams, { url: '${app.url}' })
app.get('/', async (request, reply) => {
  const res = await request.commonparams.getPathWithFieldId({
    path: { fieldId: 'foo' },
    query: { movieId: '123' }
  })
  return res
})

app.post('/', async (request, reply) => {
  const res = await request.commonparams.postPathWithFieldId({
    path: { fieldId: 'foo' }
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
  {
    const res = await request(url, {
      method: 'GET'
    })
    const body = await res.body.json()
    equal(match(body, { query: { movieId: '123' }, path: { fieldId: 'foo' } }), true)
  }
  {
    const res = await request(url, {
      method: 'POST'
    })
    const body = await res.body.json()
    equal(match(body, { path: { fieldId: 'foo' } }), true)
  }
})
