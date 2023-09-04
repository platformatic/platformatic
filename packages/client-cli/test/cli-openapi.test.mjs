import { request, moveToTmpdir } from './helper.js'
import { test } from 'tap'
import { buildServer } from '@platformatic/db'
import { join } from 'path'
import * as desm from 'desm'
import { execa } from 'execa'
import { promises as fs } from 'fs'
import split from 'split2'
import { copy } from 'fs-extra'
import dotenv from 'dotenv'
import { readFile } from 'fs/promises'

test('openapi client generation (javascript)', async ({ teardown, comment, same }) => {
  try {
    await fs.unlink(desm.join(import.meta.url, 'fixtures', 'movies', 'db.sqlite'))
  } catch {
    // noop
  }
  const app = await buildServer(desm.join(import.meta.url, 'fixtures', 'movies', 'zero.db.json'))

  await app.start()

  const dir = await moveToTmpdir(teardown)
  comment(`working in ${dir}`)

  await execa('node', [desm.join(import.meta.url, '..', 'cli.mjs'), app.url + '/documentation/json', '--name', 'movies'])

  const toWrite = `
'use strict'

const Fastify = require('fastify')
const movies = require('./movies')
const app = Fastify({ logger: true })

app.register(movies, { url: '${app.url}' })
app.post('/', async (request, reply) => {
  const res = await app.movies.createMovie({ title: 'foo' })
  return res
})
app.listen({ port: 0 })
`
  await fs.writeFile(join(dir, 'index.js'), toWrite)

  const app2 = execa('node', ['index.js'])
  teardown(() => app2.kill())
  teardown(async () => { await app.close() })

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

test('openapi client generation (typescript)', async ({ teardown, comment, same }) => {
  try {
    await fs.unlink(desm.join(import.meta.url, 'fixtures', 'movies', 'db.sqlite'))
  } catch {
    // noop
  }
  const app = await buildServer(desm.join(import.meta.url, 'fixtures', 'movies', 'zero.db.json'))

  await app.start()

  const dir = await moveToTmpdir(teardown)

  comment(`working in ${dir}`)
  await execa('node', [desm.join(import.meta.url, '..', 'cli.mjs'), app.url + '/documentation/json', '--name', 'movies'])

  const toWrite = `
import Fastify from 'fastify';
import movies from './movies';

const app = Fastify({ logger: true });
app.register(movies, {
  url: '${app.url}'
});

app.get('/', async () => {
  const res = await app.movies.getMovies()
  return res
})

app.post('/', async () => {
  const res = await app.movies.createMovie({ title: 'foo' })
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
      moduleResolution: 'node',
      lib: ['es2018'],
      esModuleInterop: true
    }
  }, null, 2)

  await fs.writeFile(join(dir, 'tsconfig.json'), tsconfig)

  const tsc = desm.join(import.meta.url, '..', 'node_modules', '.bin', 'tsc')
  await execa(tsc)

  // TODO how can we avoid this copy?
  await copy(join(dir, 'movies'), join(dir, 'build', 'movies'))

  const server2 = execa('node', ['build/index.js'])
  teardown(() => server2.kill())
  teardown(async () => { await app.close() })

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

test('openapi client generation (javascript) with slash at the end', async ({ teardown, comment, same }) => {
  try {
    await fs.unlink(desm.join(import.meta.url, 'fixtures', 'movies', 'db.sqlite'))
  } catch {
    // noop
  }
  const app = await buildServer(desm.join(import.meta.url, 'fixtures', 'movies', 'zero.db.json'))

  await app.start()

  const dir = await moveToTmpdir(teardown)

  comment(`working in ${dir}`)
  await execa('node', [desm.join(import.meta.url, '..', 'cli.mjs'), app.url + '/documentation/json', '--name', 'movies'])

  const toWrite = `
'use strict'

const Fastify = require('fastify')
const movies = require('./movies')
const app = Fastify({ logger: true })

app.register(movies, { url: '${app.url}/' })
app.post('/', async (request, reply) => {
  const res = await app.movies.createMovie({ title: 'foo' })
  return res
})
app.listen({ port: 0 })
`
  await fs.writeFile(join(dir, 'index.js'), toWrite)

  const server2 = execa('node', ['index.js'])
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
  const res = await request(url, {
    method: 'POST'
  })
  const body = await res.body.json()
  same(body, {
    id: 1,
    title: 'foo'
  })
})

test('no such file', async ({ rejects, teardown }) => {
  try {
    await fs.unlink(desm.join(import.meta.url, 'fixtures', 'movies', 'db.sqlite'))
  } catch {
    // noop
  }
  const app = await buildServer(desm.join(import.meta.url, 'fixtures', 'movies', 'zero.db.json'))

  await app.start()
  teardown(async () => {
    await app.close()
  })

  await moveToTmpdir(teardown)
  await rejects(execa('node', [desm.join(import.meta.url, '..', 'cli.mjs'), `${app.url}/foo/bar`, '--name', 'movies']))
})

test('no such file', async ({ rejects, teardown }) => {
  await rejects(execa('node', [desm.join(import.meta.url, '..', 'cli.mjs')]))
})

test('datatypes', async ({ teardown, comment, match }) => {
  try {
    await fs.unlink(desm.join(import.meta.url, 'fixtures', 'movies-quotes', 'db.sqlite'))
  } catch {
    // noop
  }
  const app = await buildServer(desm.join(import.meta.url, 'fixtures', 'movies-quotes', 'platformatic.db.json'))

  await app.start()

  const dir = await moveToTmpdir(teardown)

  comment(`working in ${dir}`)
  await execa('node', [desm.join(import.meta.url, '..', 'cli.mjs'), app.url + '/documentation/json', '--name', 'movies'])

  const toWrite = `
'use strict'

const Fastify = require('fastify')
const movies = require('./movies')
const app = Fastify({ logger: true })

app.register(movies, { url: '${app.url}' })
app.post('/', async (request, reply) => {
  const res = await app.movies.createMovie({ title: 'foo' })
  return res
})
app.listen({ port: 0 })
`
  await fs.writeFile(join(dir, 'index.js'), toWrite)

  const server2 = execa('node', ['index.js'])
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
  const res = await request(url, {
    method: 'POST'
  })
  const body = await res.body.json()
  match(body, {
    id: 1,
    title: 'foo'
  })
})

test('configureClient (typescript)', async ({ teardown, comment, same }) => {
  try {
    await fs.unlink(desm.join(import.meta.url, 'fixtures', 'movies', 'db.sqlite'))
  } catch {
    // noop
  }
  const app = await buildServer(desm.join(import.meta.url, 'fixtures', 'movies', 'zero.db.json'))

  await app.start()

  const dir = await moveToTmpdir(teardown)

  comment(`working in ${dir}`)
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
      moduleResolution: 'node',
      lib: ['es2018'],
      esModuleInterop: true
    }
  }, null, 2)

  await fs.writeFile(join(dir, 'tsconfig.json'), tsconfig)

  const tsc = desm.join(import.meta.url, '..', 'node_modules', '.bin', 'tsc')
  await execa(tsc)

  // TODO how can we avoid this copy?
  await copy(join(dir, 'movies'), join(dir, 'build', 'movies'))

  const server2 = execa('node', ['build/index.js'])
  teardown(() => server2.kill())
  teardown(async () => { await app.close() })

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

test('dotenv & config support', async ({ teardown, comment, same }) => {
  try {
    await fs.unlink(desm.join(import.meta.url, 'fixtures', 'movies', 'db.sqlite'))
  } catch {
    // noop
  }
  const app = await buildServer(desm.join(import.meta.url, 'fixtures', 'movies', 'zero.db.json'))

  await app.start()
  teardown(async () => {
    await app.close()
  })

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

test('full-response option', async ({ teardown, comment, match }) => {
  try {
    await fs.unlink(desm.join(import.meta.url, 'fixtures', 'movies', 'db.sqlite'))
  } catch {
    // noop
  }
  const app = await buildServer(desm.join(import.meta.url, 'fixtures', 'movies', 'zero.db.json'))

  await app.start()

  const dir = await moveToTmpdir(teardown)
  comment(`working in ${dir}`)

  await execa('node', [desm.join(import.meta.url, '..', 'cli.mjs'), app.url + '/documentation/json', '--name', 'movies', '--full-response'])

  const toWrite = `
'use strict'

const Fastify = require('fastify')
const movies = require('./movies')
const app = Fastify({ logger: true })

app.register(movies, { url: '${app.url}' })
app.post('/', async (request, reply) => {  
  const res = await app.movies.createMovie({ title: 'foo' })
  return res
})
app.listen({ port: 0 })
`
  await fs.writeFile(join(dir, 'index.js'), toWrite)
  const app2 = execa('node', ['index.js'])
  teardown(() => app2.kill())
  teardown(async () => { await app.close() })

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

    match(body, {
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
    })
  }

  {
    const res = await request(`${app.url}/redirect-me`)
    match(res.statusCode, 302)
    match(res.headers.location, 'https://google.com')
  }
})

test('openapi client generation (javascript) from file', async ({ teardown, comment, same }) => {
  try {
    await fs.unlink(desm.join(import.meta.url, 'fixtures', 'movies', 'db.sqlite'))
  } catch {
    // noop
  }
  const app = await buildServer(desm.join(import.meta.url, 'fixtures', 'movies', 'zero.db.json'))

  await app.start()

  const dir = await moveToTmpdir(teardown)
  comment(`working in ${dir}`)

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
  const res = await app.movies.createMovie({ title: 'foo' })
  return res
})
app.listen({ port: 0 })
`
  await fs.writeFile(join(dir, 'index.js'), toWrite)

  const app2 = execa('node', ['index.js'])
  teardown(() => app2.kill())
  teardown(async () => { await app.close() })

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

test('name with dashes', async ({ teardown, comment, same }) => {
  try {
    await fs.unlink(desm.join(import.meta.url, 'fixtures', 'movies', 'db.sqlite'))
  } catch {
    // noop
  }
  const app = await buildServer(desm.join(import.meta.url, 'fixtures', 'movies', 'zero.db.json'))

  await app.start()

  const dir = await moveToTmpdir(teardown)
  comment(`working in ${dir}`)

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
  const res = await app.uncannyMovies.createMovie({ title: 'foo' })
  return res
})
app.listen({ port: 0 })
`
  await fs.writeFile(join(dir, 'index.js'), toWrite)

  const app2 = execa('node', ['index.js'])
  teardown(() => app2.kill())
  teardown(async () => { await app.close() })

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

test('no dashes typescript', async ({ teardown, comment, same }) => {
  try {
    await fs.unlink(desm.join(import.meta.url, 'fixtures', 'movies', 'db.sqlite'))
  } catch {
    // noop
  }
  const app = await buildServer(desm.join(import.meta.url, 'fixtures', 'movies', 'zero.db.json'))

  await app.start()

  const dir = await moveToTmpdir(teardown)

  comment(`working in ${dir}`)
  await execa('node', [desm.join(import.meta.url, '..', 'cli.mjs'), app.url + '/documentation/json', '--name', 'uncanny-movies'])

  const toWrite = `
import Fastify from 'fastify';
import movies from './uncanny-movies';

const app = Fastify({ logger: true });
app.register(movies, {
  url: '${app.url}'
});

app.post('/', async () => {
  const res = await app.uncannyMovies.createMovie({ title: 'foo' })
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
      moduleResolution: 'node',
      lib: ['es2018'],
      esModuleInterop: true
    }
  }, null, 2)

  await fs.writeFile(join(dir, 'tsconfig.json'), tsconfig)

  const tsc = desm.join(import.meta.url, '..', 'node_modules', '.bin', 'tsc')
  await execa(tsc)

  // TODO how can we avoid this copy?
  await copy(join(dir, 'uncanny-movies'), join(dir, 'build', 'uncanny-movies'))

  const server2 = execa('node', ['build/index.js'])
  teardown(() => server2.kill())
  teardown(async () => { await app.close() })

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

test('name with tilde', async ({ teardown, comment, same }) => {
  try {
    await fs.unlink(desm.join(import.meta.url, 'fixtures', 'movies', 'db.sqlite'))
  } catch {
    // noop
  }
  const app = await buildServer(desm.join(import.meta.url, 'fixtures', 'movies', 'zero.db.json'))

  await app.start()

  const dir = await moveToTmpdir(teardown)
  comment(`working in ${dir}`)

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
  const res = await app.uncannyMovies.createMovie({ title: 'foo' })
  return res
})
app.listen({ port: 0 })
`
  await fs.writeFile(join(dir, 'index.js'), toWrite)

  const app2 = execa('node', ['index.js'])
  teardown(() => app2.kill())
  teardown(async () => { await app.close() })

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

test('openapi client generation from YAML file', async ({ teardown, comment, same }) => {
  const dir = await moveToTmpdir(teardown)
  const openapiFile = desm.join(import.meta.url, 'fixtures', 'openapi.yaml')
  comment(`working in ${dir}`)
  await execa('node', [desm.join(import.meta.url, '..', 'cli.mjs'), openapiFile, '--name', 'movies'])

  // check openapi json file has been created
  const jsonFile = join(dir, 'movies', 'movies.openapi.json')
  const data = await readFile(jsonFile, 'utf-8')
  const json = JSON.parse(data)
  same(json.openapi, '3.0.3')
})

test('nested optional parameters are correctly identified', async ({ teardown, comment, match }) => {
  const dir = await moveToTmpdir(teardown)
  const openapiFile = desm.join(import.meta.url, 'fixtures', 'optional-params-openapi.json')
  comment(`working in ${dir}`)
  await execa('node', [desm.join(import.meta.url, '..', 'cli.mjs'), openapiFile, '--name', 'movies'])

  // check the type file has the correct implementation for the request
  const typeFile = join(dir, 'movies', 'movies.d.ts')
  const data = await readFile(typeFile, 'utf-8')
  match(data, `
export interface GetMoviesResponseOK {
  'data': { foo: string; bar?: string; baz?: { nested1?: string; nested2: string } };
}
`)
})

test('request with same parameter name in body/path/header/query', async ({ teardown, comment, match }) => {
  const dir = await moveToTmpdir(teardown)
  const openapiFile = desm.join(import.meta.url, 'fixtures', 'same-parameter-name-openapi.json')
  comment(`working in ${dir}`)
  await execa('node', [desm.join(import.meta.url, '..', 'cli.mjs'), openapiFile, '--name', 'movies'])

  // check the type file has the correct implementation for the request
  const typeFile = join(dir, 'movies', 'movies.d.ts')
  const data = await readFile(typeFile, 'utf-8')
  match(data, `
export interface GetMoviesRequest {
  body: {
    'id': string;
  }
  query: {
    'id': string;
  }
  headers: {
    'id': string;
  }
}`)
})

test('openapi client generation (javascript) from file with fullRequest and fullResponse', async ({ teardown, comment, match }) => {
  const openapi = desm.join(import.meta.url, 'fixtures', 'full-req-res', 'openapi.json')
  teardown = () => {}
  const dir = await moveToTmpdir((teardown))
  comment(`working in ${dir}`)

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
    await execa('node', [desm.join(import.meta.url, '..', 'cli.mjs'), openapi, '--name', 'full', ...opt])

    // check the type file has the correct implementation for the request and the response
    const typeFile = join(dir, 'full', 'full.d.ts')
    const data = await readFile(typeFile, 'utf-8')
    match(data, `
export interface PostHelloRequest {
  body: {
    'bodyId': string;
  }
  query: {
    'queryId': string;
  }
  headers: {
    'headerId': string;
  }
}
`)
    match(data, `
export interface Full {
  postHello(req?: PostHelloRequest): Promise<FullResponse<PostHelloResponseOK>>;
}`)
    const implementationFile = join(dir, 'full', 'full.cjs')
    const implementationData = await readFile(implementationFile, 'utf-8')
    // check the implementation instantiate the client with fullRequest and fullResponse
    match(implementationData, `
async function generateFullClientPlugin (app, opts) {
  app.register(pltClient, {
    type: 'openapi',
    name: 'full',
    path: join(__dirname, 'full.openapi.json'),
    url: opts.url,
    serviceId: opts.serviceId,
    throwOnError: opts.throwOnError,
    fullResponse: true,
    fullRequest: true
  })
}`)
  }
})

test('optional-headers option', async ({ teardown, comment, match }) => {
  const dir = await moveToTmpdir(teardown)
  comment(`working in ${dir}`)

  const openAPIfile = desm.join(import.meta.url, 'fixtures', 'optional-headers-openapi.json')
  await execa('node', [desm.join(import.meta.url, '..', 'cli.mjs'), openAPIfile, '--name', 'movies', '--optional-headers', 'foobar,authorization', '--types-only'])

  const typeFile = join(dir, 'movies.d.ts')
  const data = await readFile(typeFile, 'utf-8')
  match(data, `
export interface PostHelloRequest {
  'authorization'?: string;
}
`)
})
