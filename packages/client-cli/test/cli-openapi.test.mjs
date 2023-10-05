import assert from 'node:assert/strict'
import { test } from 'node:test'
import { join } from 'node:path'
import { readFile, writeFile, unlink } from 'node:fs/promises'
import { buildServer } from '@platformatic/db'
import * as desm from 'desm'
import { execa } from 'execa'
import split from 'split2'
import { copy } from 'fs-extra'
import dotenv from 'dotenv'
import { request, moveToTmpdir } from './helper.js'

test('openapi client generation (javascript)', async (t) => {
  try {
    await unlink(desm.join(import.meta.url, 'fixtures', 'movies', 'db.sqlite'))
  } catch {
    // noop
  }
  const app = await buildServer(desm.join(import.meta.url, 'fixtures', 'movies', 'zero.db.json'))

  await app.start()

  const dir = await moveToTmpdir(t)

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
  await writeFile(join(dir, 'index.js'), toWrite)

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
  assert.deepEqual(body, {
    id: 1,
    title: 'foo'
  })
})

test('openapi client generation (typescript)', async (t) => {
  try {
    await unlink(desm.join(import.meta.url, 'fixtures', 'movies', 'db.sqlite'))
  } catch {
    // noop
  }
  const app = await buildServer(desm.join(import.meta.url, 'fixtures', 'movies', 'zero.db.json'))

  await app.start()

  const dir = await moveToTmpdir(t)

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

  await writeFile(join(dir, 'index.ts'), toWrite)

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

  await writeFile(join(dir, 'tsconfig.json'), tsconfig)

  const tsc = desm.join(import.meta.url, '..', 'node_modules', '.bin', 'tsc')
  await execa(tsc)

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
  assert.deepEqual(body, {
    id: 1,
    title: 'foo'
  })
})

test('openapi client generation (javascript) with slash at the end', async (t) => {
  try {
    await unlink(desm.join(import.meta.url, 'fixtures', 'movies', 'db.sqlite'))
  } catch {
    // noop
  }
  const app = await buildServer(desm.join(import.meta.url, 'fixtures', 'movies', 'zero.db.json'))

  await app.start()

  const dir = await moveToTmpdir(t)

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
  await writeFile(join(dir, 'index.js'), toWrite)

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
  assert.deepEqual(body, {
    id: 1,
    title: 'foo'
  })
})

test('no such file', async (t) => {
  try {
    await unlink(desm.join(import.meta.url, 'fixtures', 'movies', 'db.sqlite'))
  } catch {
    // noop
  }
  const app = await buildServer(desm.join(import.meta.url, 'fixtures', 'movies', 'zero.db.json'))

  await app.start()
  t.after(async () => {
    await app.close()
  })

  await moveToTmpdir(t)
  await assert.rejects(execa('node', [desm.join(import.meta.url, '..', 'cli.mjs'), `${app.url}/foo/bar`, '--name', 'movies']))
})

test('no such file', async (t) => {
  await assert.rejects(execa('node', [desm.join(import.meta.url, '..', 'cli.mjs')]))
})

test('datatypes', async (t) => {
  try {
    await unlink(desm.join(import.meta.url, 'fixtures', 'movies-quotes', 'db.sqlite'))
  } catch {
    // noop
  }
  const app = await buildServer(desm.join(import.meta.url, 'fixtures', 'movies-quotes', 'platformatic.db.json'))

  await app.start()

  const dir = await moveToTmpdir(t)

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
  await writeFile(join(dir, 'index.js'), toWrite)

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
  assert.equal(body.id, 1)
  assert.equal(body.title, 'foo')
})

test('configureClient (typescript)', async (t) => {
  try {
    await unlink(desm.join(import.meta.url, 'fixtures', 'movies', 'db.sqlite'))
  } catch {
    // noop
  }
  const app = await buildServer(desm.join(import.meta.url, 'fixtures', 'movies', 'zero.db.json'))

  await app.start()

  const dir = await moveToTmpdir(t)

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

  await writeFile(join(dir, 'index.ts'), toWrite)

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

  await writeFile(join(dir, 'tsconfig.json'), tsconfig)

  const tsc = desm.join(import.meta.url, '..', 'node_modules', '.bin', 'tsc')
  await execa(tsc)

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
  assert.deepEqual(body, {
    id: 1,
    title: 'foo'
  })
})

test('dotenv & config support', async (t) => {
  try {
    await unlink(desm.join(import.meta.url, 'fixtures', 'movies', 'db.sqlite'))
  } catch {
    // noop
  }
  const app = await buildServer(desm.join(import.meta.url, 'fixtures', 'movies', 'zero.db.json'))

  await app.start()
  t.after(async () => {
    await app.close()
  })

  const dir = await moveToTmpdir(t)

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

  await writeFile('./platformatic.service.json', JSON.stringify(pltServiceConfig, null, 2))

  await writeFile(join(dir, '.env'), 'FOO=bar')
  await writeFile(join(dir, '.env.sample'), 'FOO=bar')

  await execa('node', [desm.join(import.meta.url, '..', 'cli.mjs'), app.url + '/documentation/json', '--name', 'movies'])

  const url = app.url + '/'
  {
    const envs = dotenv.parse(await readFile(join(dir, '.env')))
    assert.deepEqual(envs, {
      FOO: 'bar',
      PLT_MOVIES_URL: url
    })
  }

  {
    const envs = dotenv.parse(await readFile(join(dir, '.env.sample')))
    assert.deepEqual(envs, {
      FOO: 'bar',
      PLT_MOVIES_URL: url
    })
  }
})

test('full-response option', async (t) => {
  try {
    await unlink(desm.join(import.meta.url, 'fixtures', 'movies', 'db.sqlite'))
  } catch {
    // noop
  }
  const app = await buildServer(desm.join(import.meta.url, 'fixtures', 'movies', 'zero.db.json'))

  await app.start()

  const dir = await moveToTmpdir(t)

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
  await writeFile(join(dir, 'index.js'), toWrite)
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

    assert.equal(body.statusCode, 200)
    assert.equal(body.headers['content-type'], 'application/json; charset=utf-8')
    assert.equal(body.headers['content-length'], '22')
    assert.equal(body.headers.location, '/movies/1')
    assert.match(body.headers.date, matchDate)
    assert.equal(body.headers.connection, 'keep-alive')
    assert.match(body.headers['keep-alive'], matchKeepAlive)
    assert.deepEqual(body.body, {
      id: 1,
      title: 'foo'
    })
  }
  {
    const res = await request(`${app.url}/redirect-me`)
    assert.equal(res.statusCode, 302)
    assert.equal(res.headers.location, 'https://google.com')
  }
})

test('openapi client generation (javascript) from file', async (t) => {
  try {
    await unlink(desm.join(import.meta.url, 'fixtures', 'movies', 'db.sqlite'))
  } catch {
    // noop
  }
  const app = await buildServer(desm.join(import.meta.url, 'fixtures', 'movies', 'zero.db.json'))

  await app.start()

  const dir = await moveToTmpdir(t)

  const openAPI = app.swagger()
  const openAPIfile = join(dir, 'movies.schema.json')
  await writeFile(openAPIfile, JSON.stringify(openAPI, null, 2))

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
  await writeFile(join(dir, 'index.js'), toWrite)

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
  assert.deepEqual(body, {
    id: 1,
    title: 'foo'
  })
})

test('name with dashes', async (t) => {
  try {
    await unlink(desm.join(import.meta.url, 'fixtures', 'movies', 'db.sqlite'))
  } catch {
    // noop
  }
  const app = await buildServer(desm.join(import.meta.url, 'fixtures', 'movies', 'zero.db.json'))

  await app.start()

  const dir = await moveToTmpdir(t)

  try {
    await execa('node', [desm.join(import.meta.url, '..', 'cli.mjs'), app.url + '/documentation/json', '--name', 'uncanny-movies'])
  } catch (err) {
    console.log(err.stderr)
    throw err
  }

  {
    const pkg = JSON.parse(await readFile(join(dir, 'uncanny-movies', 'package.json')))
    assert.deepEqual(pkg, {
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
  await writeFile(join(dir, 'index.js'), toWrite)

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
  assert.deepEqual(body, {
    id: 1,
    title: 'foo'
  })
})

test('no dashes typescript', async (t) => {
  try {
    await unlink(desm.join(import.meta.url, 'fixtures', 'movies', 'db.sqlite'))
  } catch {
    // noop
  }
  const app = await buildServer(desm.join(import.meta.url, 'fixtures', 'movies', 'zero.db.json'))

  await app.start()

  const dir = await moveToTmpdir(t)

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

  await writeFile(join(dir, 'index.ts'), toWrite)

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

  await writeFile(join(dir, 'tsconfig.json'), tsconfig)

  const tsc = desm.join(import.meta.url, '..', 'node_modules', '.bin', 'tsc')
  await execa(tsc)

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
  assert.deepEqual(body, {
    id: 1,
    title: 'foo'
  })
})

test('name with tilde', async (t) => {
  try {
    await unlink(desm.join(import.meta.url, 'fixtures', 'movies', 'db.sqlite'))
  } catch {
    // noop
  }
  const app = await buildServer(desm.join(import.meta.url, 'fixtures', 'movies', 'zero.db.json'))

  await app.start()

  const dir = await moveToTmpdir(t)

  try {
    await execa('node', [desm.join(import.meta.url, '..', 'cli.mjs'), app.url + '/documentation/json', '--name', 'uncanny~movies'])
  } catch (err) {
    console.log(err.stderr)
    throw err
  }

  {
    const pkg = JSON.parse(await readFile(join(dir, 'uncanny~movies', 'package.json')))
    assert.deepEqual(pkg, {
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
  await writeFile(join(dir, 'index.js'), toWrite)

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
  assert.deepEqual(body, {
    id: 1,
    title: 'foo'
  })
})

test('openapi client generation from YAML file', async (t) => {
  const dir = await moveToTmpdir(t)
  const openapiFile = desm.join(import.meta.url, 'fixtures', 'openapi.yaml')
  await execa('node', [desm.join(import.meta.url, '..', 'cli.mjs'), openapiFile, '--name', 'movies'])

  // check openapi json file has been created
  const jsonFile = join(dir, 'movies', 'movies.openapi.json')
  const data = await readFile(jsonFile, 'utf-8')
  const json = JSON.parse(data)
  assert.deepEqual(json.openapi, '3.0.3')
})

test('nested optional parameters are correctly identified', async (t) => {
  const dir = await moveToTmpdir(t)
  const openapiFile = desm.join(import.meta.url, 'fixtures', 'optional-params-openapi.json')
  await execa('node', [desm.join(import.meta.url, '..', 'cli.mjs'), openapiFile, '--name', 'movies'])

  // check the type file has the correct implementation for the request
  const typeFile = join(dir, 'movies', 'movies.d.ts')
  const data = await readFile(typeFile, 'utf-8')
  assert.equal(data.includes(`
  export interface GetMoviesResponseOK {
    'data': { foo: string; bar?: string; baz?: { nested1?: string; nested2: string } };
  }
`), true)
})

test('request with same parameter name in body/path/header/query', async (t) => {
  const dir = await moveToTmpdir(t)
  const openapiFile = desm.join(import.meta.url, 'fixtures', 'same-parameter-name-openapi.json')
  await execa('node', [desm.join(import.meta.url, '..', 'cli.mjs'), openapiFile, '--name', 'movies'])
  // check the type file has the correct implementation for the request
  const typeFile = join(dir, 'movies', 'movies.d.ts')
  const data = await readFile(typeFile, 'utf-8')
  assert.equal(data.includes(`
  export interface GetMoviesRequest {
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
  const dir = await moveToTmpdir(t)

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

  await writeFile('./platformatic.service.json', JSON.stringify(pltServiceConfig, null, 2))

  const fullOptions = [
    ['--full-request', '--full-response'],
    ['--full']
  ]
  for (const opt of fullOptions) {
    await execa('node', [desm.join(import.meta.url, '..', 'cli.mjs'), openapi, '--name', 'full', '--validate-response', '--optional-headers', 'headerId', ...opt])

    // check the type file has the correct implementation for the request and the response
    const typeFile = join(dir, 'full', 'full.d.ts')
    const data = await readFile(typeFile, 'utf-8')
    assert.equal(data.includes(`
  export interface PostHelloRequest {
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
    assert.equal(data.includes(`
  export interface Full {
    postHello(req?: PostHelloRequest): Promise<PostHelloResponses>;
  }`), true)
    const implementationFile = join(dir, 'full', 'full.cjs')
    const implementationData = await readFile(implementationFile, 'utf-8')
    // check the implementation instantiate the client with fullRequest and fullResponse
    assert.equal(implementationData.includes(`
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
    validateResponse: true
  })
}`), true)
  }
})

test('optional-headers option', async (t) => {
  const dir = await moveToTmpdir(t)

  const openAPIfile = desm.join(import.meta.url, 'fixtures', 'optional-headers-openapi.json')
  await execa('node', [desm.join(import.meta.url, '..', 'cli.mjs'), openAPIfile, '--name', 'movies', '--optional-headers', 'foobar,authorization', '--types-only'])

  const typeFile = join(dir, 'movies.d.ts')
  const data = await readFile(typeFile, 'utf-8')
  assert.equal(data.includes(`
  export interface PostHelloRequest {
    'authorization'?: string;
  }
`), true)
})
