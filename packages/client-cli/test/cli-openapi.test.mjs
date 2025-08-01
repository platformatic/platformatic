import { create as createDatabase } from '@platformatic/db'
import { create } from '@platformatic/runtime'
import { match } from '@platformatic/utils'
import dotenv from 'dotenv'
import { execa } from 'execa'
import { existsSync, promises as fs } from 'fs'
import { copy } from 'fs-extra'
import { readFile } from 'fs/promises'
import { equal, ok, rejects, deepEqual as same } from 'node:assert'
import { after, test } from 'node:test'
import { join } from 'path'
import split from 'split2'
import { isFileAccessible } from '../cli.mjs'
import { moveToTmpdir, request, safeKill } from './helper.js'

const env = { ...process.env, NODE_V8_COVERAGE: undefined }

function findTSCPath () {
  let tscPath = join(import.meta.dirname, '..', 'node_modules', '.bin', 'tsc')

  // If the local npm installation should use global tsc in the root
  if (!existsSync(tscPath)) {
    tscPath = join(import.meta.dirname, '../../..', 'node_modules', '.bin', 'tsc')
  }

  return tscPath
}

test('openapi client generation (javascript)', async t => {
  try {
    await fs.unlink(join(import.meta.dirname, 'fixtures', 'movies', 'db.sqlite'))
  } catch {
    // noop
  }
  const app = await create(join(import.meta.dirname, 'fixtures', 'movies', 'zero.db.json'))

  const runtimeUrl = await app.start()

  const dir = await moveToTmpdir(after)

  await execa('node', [join(import.meta.dirname, '..', 'cli.mjs'), runtimeUrl, '--name', 'movies', '--type', 'openapi', '--full', 'false'])

  const toWrite = `
'use strict'

const Fastify = require('fastify')
const movies = require('./movies')
const app = Fastify({ logger: true })

app.register(movies, { url: '${runtimeUrl}' })
app.post('/', async (request, reply) => {
  const res = await request.movies.createMovie({ title: 'foo' })
  return res
})
app.listen({ port: 0 })
`
  await fs.writeFile(join(dir, 'index.js'), toWrite)

  const app2 = execa('node', ['index.js'], { env })
  t.after(() => safeKill(app2))
  t.after(async () => {
    await app.close()
  })

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

test('openapi client generation (typescript)', async t => {
  try {
    await fs.unlink(join(import.meta.dirname, 'fixtures', 'movies', 'db.sqlite'))
  } catch {
    // noop
  }
  const app = await create(join(import.meta.dirname, 'fixtures', 'movies', 'zero.db.json'))

  const runtimeUrl = await app.start()

  const dir = await moveToTmpdir(after)

  await execa('node', [
    join(import.meta.dirname, '..', 'cli.mjs'),
    runtimeUrl + '/documentation/json',
    '--name',
    'movies',
    '--full',
    'false'
  ])

  const toWrite = `
import Fastify from 'fastify';
import movies from './movies';

const app = Fastify({ logger: true });
app.register(movies, {
  url: '${runtimeUrl}'
});

app.get('/', async (req) => {
  const res = await req.movies.getMovies({})
  return res
})

app.post('/', async (req) => {
  const res = await req.movies.createMovie({ title: 'foo' })
  return res
})

app.listen({ port: 0 });
`

  await fs.writeFile(join(dir, 'index.ts'), toWrite)

  const tsconfig = JSON.stringify(
    {
      extends: 'fastify-tsconfig',
      compilerOptions: {
        outDir: 'build',
        target: 'es2018',
        moduleResolution: 'NodeNext',
        lib: ['es2018'],
        esModuleInterop: true
      }
    },
    null,
    2
  )

  await fs.writeFile(join(dir, 'tsconfig.json'), tsconfig)

  const tsc = findTSCPath()
  await execa(tsc, [], { env })

  // TODO how can we avoid this copy?
  await copy(join(dir, 'movies'), join(dir, 'build', 'movies'))

  const server2 = execa('node', ['build/index.js'], { env })
  t.after(() => safeKill(server2))
  t.after(async () => {
    await app.close()
  })

  const stream = server2.stdout.pipe(split(JSON.parse))
  server2.stderr.pipe(process.stderr)

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

test('openapi client generation (javascript) with slash at the end', async t => {
  try {
    await fs.unlink(join(import.meta.dirname, 'fixtures', 'movies', 'db.sqlite'))
  } catch {
    // noop
  }
  const app = await create(join(import.meta.dirname, 'fixtures', 'movies', 'zero.db.json'))

  const runtimeUrl = await app.start()

  const dir = await moveToTmpdir(after)

  await execa('node', [
    join(import.meta.dirname, '..', 'cli.mjs'),
    runtimeUrl + '/documentation/json',
    '--name',
    'movies',
    '--full',
    'false'
  ])

  const toWrite = `
'use strict'

const Fastify = require('fastify')
const movies = require('./movies')
const app = Fastify({ logger: true })

app.register(movies, { url: '${runtimeUrl}/' })
app.post('/', async (request, reply) => {
  const res = await request.movies.createMovie({ title: 'foo' })
  return res
})
app.listen({ port: 0 })
`
  await fs.writeFile(join(dir, 'index.js'), toWrite)

  const server2 = execa('node', ['index.js'], { env })
  t.after(() => safeKill(server2))
  t.after(async () => {
    await app.close()
  })

  const stream = server2.stdout.pipe(split(JSON.parse))

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

test('no such file', async t => {
  try {
    await fs.unlink(join(import.meta.dirname, 'fixtures', 'movies', 'db.sqlite'))
  } catch {
    // noop
  }
  const app = await create(join(import.meta.dirname, 'fixtures', 'movies', 'zero.db.json'))

  const runtimeUrl = await app.start()
  t.after(async () => {
    await app.close()
  })

  await moveToTmpdir(after)
  await rejects(
    execa('node', [join(import.meta.dirname, '..', 'cli.mjs'), `${runtimeUrl}/foo/bar`, '--name', 'movies', '--full', 'false'])
  )
})

test('no such file', async t => {
  await rejects(execa('node', [join(import.meta.dirname, '..', 'cli.mjs')]))
})

test('datatypes', async t => {
  try {
    await fs.unlink(join(import.meta.dirname, 'fixtures', 'movies-quotes', 'db.sqlite'))
  } catch {
    // noop
  }
  const app = await create(join(import.meta.dirname, 'fixtures', 'movies-quotes', 'platformatic.db.json'))

  const runtimeUrl = await app.start()

  const dir = await moveToTmpdir(after)

  await execa('node', [
    join(import.meta.dirname, '..', 'cli.mjs'),
    runtimeUrl + '/documentation/json',
    '--name',
    'movies',
    '--full',
    'false'
  ])

  const toWrite = `
'use strict'

const Fastify = require('fastify')
const movies = require('./movies')
const app = Fastify({ logger: true })

app.register(movies, { url: '${runtimeUrl}' })
app.post('/', async (request, reply) => {
  const res = await request.movies.createMovie({ title: 'foo' })
  return res
})
app.listen({ port: 0 })
`
  await fs.writeFile(join(dir, 'index.js'), toWrite)

  const server2 = execa('node', ['index.js'], { env })
  t.after(() => safeKill(server2))
  t.after(async () => {
    await app.close()
  })

  const stream = server2.stdout.pipe(split(JSON.parse))

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
  equal(
    match(body, {
      id: 1,
      title: 'foo'
    }),
    true
  )
})

test('configureClient (typescript)', async t => {
  try {
    await fs.unlink(join(import.meta.dirname, 'fixtures', 'movies', 'db.sqlite'))
  } catch {
    // noop
  }
  const app = await create(join(import.meta.dirname, 'fixtures', 'movies', 'zero.db.json'))

  const runtimeUrl = await app.start()

  const dir = await moveToTmpdir(after)

  await execa('node', [
    join(import.meta.dirname, '..', 'cli.mjs'),
    runtimeUrl + '/documentation/json',
    '--name',
    'movies',
    '--full',
    'false'
  ])

  const toWrite = `
import Fastify from 'fastify';
import movies from './movies';

const app = Fastify({ logger: true });
app.register(movies, {
  url: '${runtimeUrl}'
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

  const tsconfig = JSON.stringify(
    {
      extends: 'fastify-tsconfig',
      compilerOptions: {
        outDir: 'build',
        target: 'es2018',
        moduleResolution: 'NodeNext',
        lib: ['es2018'],
        esModuleInterop: true
      }
    },
    null,
    2
  )

  await fs.writeFile(join(dir, 'tsconfig.json'), tsconfig)

  const tsc = findTSCPath()
  await execa(tsc, [], { env })

  // TODO how can we avoid this copy?
  await copy(join(dir, 'movies'), join(dir, 'build', 'movies'))

  const server2 = execa('node', ['build/index.js'])
  t.after(() => safeKill(server2))
  t.after(async () => {
    await app.close()
  })

  const stream = server2.stdout.pipe(split(JSON.parse))
  server2.stderr.pipe(process.stderr)

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

test('dotenv & config support', async t => {
  try {
    await fs.unlink(join(import.meta.dirname, 'fixtures', 'movies', 'db.sqlite'))
  } catch {
    // noop
  }
  const app = await create(join(import.meta.dirname, 'fixtures', 'movies', 'zero.db.json'))

  const runtimeUrl = await app.start()
  t.after(async () => {
    await app.close()
  })

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

  await fs.writeFile('./platformatic.service.json', JSON.stringify(pltServiceConfig, null, 2))

  await fs.writeFile(join(dir, '.env'), 'FOO=bar')
  await fs.writeFile(join(dir, '.env.sample'), 'FOO=bar')

  await execa('node', [
    join(import.meta.dirname, '..', 'cli.mjs'),
    runtimeUrl + '/documentation/json',
    '--name',
    'movies',
    '--full',
    'false'
  ])

  const url = runtimeUrl + '/'
  {
    const envs = dotenv.parse(await fs.readFile(join(dir, '.env'), 'utf-8'))
    same(envs, {
      FOO: 'bar',
      PLT_MOVIES_URL: url
    })
  }

  {
    const envs = dotenv.parse(await fs.readFile(join(dir, '.env.sample'), 'utf-8'))
    same(envs, {
      FOO: 'bar',
      PLT_MOVIES_URL: url
    })
  }
})

test('full-response option', async t => {
  try {
    await fs.unlink(join(import.meta.dirname, 'fixtures', 'movies', 'db.sqlite'))
  } catch {
    // noop
  }
  const app = await create(join(import.meta.dirname, 'fixtures', 'movies', 'zero.db.json'))

  const runtimeUrl = await app.start()

  const dir = await moveToTmpdir(after)

  await execa('node', [
    join(import.meta.dirname, '..', 'cli.mjs'),
    runtimeUrl + '/documentation/json',
    '--name',
    'movies',
    '--full-response',
    '--full',
    'false'
  ])

  const toWrite = `
'use strict'

const Fastify = require('fastify')
const movies = require('./movies')
const app = Fastify({ logger: true })

app.register(movies, { url: '${runtimeUrl}' })
app.post('/', async (request, reply) => {
  const res = await request.movies.createMovie({ title: 'foo' })
  return res
})
app.listen({ port: 0 })
`
  await fs.writeFile(join(dir, 'index.js'), toWrite)
  const app2 = execa('node', ['index.js'])
  t.after(() => safeKill(app2))
  t.after(async () => {
    await app.close()
  })

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
  {
    const res = await request(url, {
      method: 'POST'
    })
    const body = await res.body.json()
    const matchDate = /[a-z]{3}, \d{2} [a-z]{3} \d{4} \d{2}:\d{2}:\d{2} GMT/i
    const matchKeepAlive = /timeout=\d+/

    equal(
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
      }),
      true
    )
  }

  {
    const res = await request(`${runtimeUrl}/redirect-me`)
    equal(match(res.statusCode, 302), true)
    equal(match(res.headers.location, 'https://google.com'), true)
  }
})

test('openapi client generation (javascript) from file', async t => {
  try {
    await fs.unlink(join(import.meta.dirname, 'fixtures', 'movies', 'db.sqlite'))
  } catch {
    // noop
  }
  const app = await createDatabase(join(import.meta.dirname, 'fixtures', 'movies', 'zero.db.json'))

  const runtimeUrl = await app.start()

  const dir = await moveToTmpdir(after)

  const openAPI = app.getApplication().swagger()
  const openAPIfile = join(dir, 'movies.schema.json')
  await fs.writeFile(openAPIfile, JSON.stringify(openAPI, null, 2))

  await execa('node', [join(import.meta.dirname, '..', 'cli.mjs'), openAPIfile, '--name', 'movies', '--full', 'false'])

  const toWrite = `
'use strict'

const Fastify = require('fastify')
const movies = require('./movies')
const app = Fastify({ logger: true })

app.register(movies, { url: '${runtimeUrl}' })
app.post('/', async (request, reply) => {
  const res = await request.movies.createMovie({ title: 'foo' })
  return res
})
app.listen({ port: 0 })
`
  await fs.writeFile(join(dir, 'index.js'), toWrite)

  const app2 = execa('node', ['index.js'])
  t.after(() => safeKill(app2))
  t.after(async () => {
    await app.close()
  })

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

test('name with dashes', async t => {
  try {
    await fs.unlink(join(import.meta.dirname, 'fixtures', 'movies', 'db.sqlite'))
  } catch {
    // noop
  }
  const app = await create(join(import.meta.dirname, 'fixtures', 'movies', 'zero.db.json'))

  const runtimeUrl = await app.start()

  const dir = await moveToTmpdir(after)

  await execa('node', [
    join(import.meta.dirname, '..', 'cli.mjs'),
    runtimeUrl + '/documentation/json',
    '--name',
    'uncanny-movies',
    '--full',
    'false'
  ])

  {
    const pkg = JSON.parse(await fs.readFile(join(dir, 'uncanny-movies', 'package.json'), 'utf-8'))
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

app.register(movies, { url: '${runtimeUrl}' })
app.post('/', async (request, reply) => {
  const res = await request.uncannyMovies.createMovie({ title: 'foo' })
  return res
})
app.listen({ port: 0 })
`
  await fs.writeFile(join(dir, 'index.js'), toWrite)

  const app2 = execa('node', ['index.js'])
  t.after(() => safeKill(app2))
  t.after(async () => {
    await app.close()
  })

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

test('no dashes typescript', async t => {
  try {
    await fs.unlink(join(import.meta.dirname, 'fixtures', 'movies', 'db.sqlite'))
  } catch {
    // noop
  }
  const app = await create(join(import.meta.dirname, 'fixtures', 'movies', 'zero.db.json'))

  const runtimeUrl = await app.start()
  const dir = await moveToTmpdir(after)

  await execa('node', [
    join(import.meta.dirname, '..', 'cli.mjs'),
    runtimeUrl + '/documentation/json',
    '--name',
    'uncanny-movies',
    '--full',
    'false'
  ])

  const toWrite = `
import Fastify from 'fastify';
import movies from './uncanny-movies';

const app = Fastify({ logger: true });
app.register(movies, {
  url: '${runtimeUrl}'
});

app.post('/', async (req) => {
  const res = await req.uncannyMovies.createMovie({ title: 'foo' })
  return res
})

app.listen({ port: 0 });
`

  await fs.writeFile(join(dir, 'index.ts'), toWrite)

  const tsconfig = JSON.stringify(
    {
      extends: 'fastify-tsconfig',
      compilerOptions: {
        outDir: 'build',
        target: 'es2018',
        moduleResolution: 'NodeNext',
        lib: ['es2018'],
        esModuleInterop: true
      }
    },
    null,
    2
  )

  await fs.writeFile(join(dir, 'tsconfig.json'), tsconfig)

  const tsc = findTSCPath()
  await execa(tsc, [], { env })

  // TODO how can we avoid this copy?
  await copy(join(dir, 'uncanny-movies'), join(dir, 'build', 'uncanny-movies'))

  const server2 = execa('node', ['build/index.js'])
  t.after(() => safeKill(server2))
  t.after(async () => {
    await app.close()
  })

  const stream = server2.stdout.pipe(split(JSON.parse))
  server2.stderr.pipe(process.stderr)

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

test('name with tilde', async t => {
  try {
    await fs.unlink(join(import.meta.dirname, 'fixtures', 'movies', 'db.sqlite'))
  } catch {
    // noop
  }
  const app = await create(join(import.meta.dirname, 'fixtures', 'movies', 'zero.db.json'))

  const runtimeUrl = await app.start()

  const dir = await moveToTmpdir(after)

  await execa('node', [
    join(import.meta.dirname, '..', 'cli.mjs'),
    runtimeUrl + '/documentation/json',
    '--name',
    'uncanny~movies',
    '--full',
    'false'
  ])

  {
    const pkg = JSON.parse(await fs.readFile(join(dir, 'uncanny~movies', 'package.json'), 'utf-8'))
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

app.register(movies, { url: '${runtimeUrl}' })
app.post('/', async (request, reply) => {
  const res = await request.uncannyMovies.createMovie({ title: 'foo' })
  return res
})
app.listen({ port: 0 })
`
  await fs.writeFile(join(dir, 'index.js'), toWrite)

  const app2 = execa('node', ['index.js'])
  t.after(() => safeKill(app2))
  t.after(async () => {
    await app.close()
  })

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

test('openapi client generation from YAML file', async t => {
  const dir = await moveToTmpdir(after)
  const openapiFile = join(import.meta.dirname, 'fixtures', 'openapi.yaml')
  await execa('node', [join(import.meta.dirname, '..', 'cli.mjs'), openapiFile, '--name', 'movies', '--full', 'false'])

  // check openapi json file has been created
  const jsonFile = join(dir, 'movies', 'movies.openapi.json')
  const data = await readFile(jsonFile, 'utf-8')
  const json = JSON.parse(data)
  same(json.openapi, '3.0.3')

  // Check operation names are correctly capitalized
  const typeFile = join(dir, 'movies', 'movies.d.ts')
  const typeData = await readFile(typeFile, 'utf-8')

  equal(match(typeData, 'getMovies(req: GetMoviesRequest): Promise<GetMoviesResponses>;'), true)
})

test('nested optional parameters are correctly identified', async t => {
  const dir = await moveToTmpdir(after)
  const openapiFile = join(import.meta.dirname, 'fixtures', 'optional-params-openapi.json')
  await execa('node', [join(import.meta.dirname, '..', 'cli.mjs'), openapiFile, '--name', 'movies', '--full', 'false'])

  // check the type file has the correct implementation for the request
  const typeFile = join(dir, 'movies', 'movies.d.ts')
  const data = await readFile(typeFile, 'utf-8')

  equal(
    data.includes(`
  export type GetMoviesResponseOK = { 'data'?: { 'foo': string; 'bar'?: string; 'baz'?: { 'nested1'?: string; 'nested2': string } } }
`),
    true
  )
})

test('request with same parameter name in body/path/header/query', async t => {
  const dir = await moveToTmpdir(after)
  const openapiFile = join(import.meta.dirname, 'fixtures', 'same-parameter-name-openapi.json')
  await execa('node', [join(import.meta.dirname, '..', 'cli.mjs'), openapiFile, '--name', 'movies', '--full', 'false'])
  // check the type file has the correct implementation for the request
  const typeFile = join(dir, 'movies', 'movies.d.ts')
  const data = await readFile(typeFile, 'utf-8')
  equal(
    data.includes(`
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
  }`),
    true
  )
})

test('openapi client generation (javascript) from file with fullRequest, fullResponse, validateResponse and optionalHeaders', async t => {
  const openapi = join(import.meta.dirname, 'fixtures', 'full-req-res', 'openapi.json')
  const dir = await moveToTmpdir(after)

  const fullOptions = [['--full-request', '--full-response'], ['--full']]
  for (const opt of fullOptions) {
    await execa('node', [
      join(import.meta.dirname, '..', 'cli.mjs'),
      openapi,
      '--name',
      'full',
      '--validate-response',
      '--optional-headers',
      'headerId',
      ...opt
    ])

    // check the type file has the correct implementation for the request and the response
    const typeFile = join(dir, 'full', 'full.d.ts')
    const data = await readFile(typeFile, 'utf-8')
    equal(
      data.includes(`
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
`),
      true
    )
    equal(
      data.includes(`
  export type Full = {
    /**
     * @param req - request parameters object
     * @returns the API response
     */
    postHello(req: PostHelloRequest): Promise<PostHelloResponses>;
  }`),
      true
    )
    const implementationFile = join(dir, 'full', 'full.cjs')
    const implementationData = await readFile(implementationFile, 'utf-8')
    // check the implementation instantiate the client with fullRequest and fullResponse
    equal(
      implementationData.includes(`
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
}`),
      true
    )
  }
})

test('do not generate implementation file if in @platformatic/service', async t => {
  const openapi = join(import.meta.dirname, 'fixtures', 'full-req-res', 'openapi.json')
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

  await fs.writeFile('./platformatic.service.json', JSON.stringify(pltServiceConfig, null, 2))

  const fullOptions = [['--full-request', '--full-response'], ['--full']]
  for (const opt of fullOptions) {
    await execa('node', [
      join(import.meta.dirname, '..', 'cli.mjs'),
      openapi,
      '--name',
      'full',
      '--validate-response',
      '--optional-headers',
      'headerId',
      ...opt
    ])

    equal(await isFileAccessible(join(dir, 'full', 'full.cjs')), false)

    // check the type file has the correct implementation for the request and the response
    const typeFile = join(dir, 'full', 'full.d.ts')
    const data = await readFile(typeFile, 'utf-8')
    equal(
      data.includes(`
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
`),
      true
    )
    equal(
      data.includes(`
  export type Full = {
    /**
     * @param req - request parameters object
     * @returns the API response
     */
    postHello(req: PostHelloRequest): Promise<PostHelloResponses>;
  }`),
      true
    )
  }
})

test('optional-headers option', async t => {
  const dir = await moveToTmpdir(after)

  const openAPIfile = join(import.meta.dirname, 'fixtures', 'optional-headers-openapi.json')
  await execa('node', [
    join(import.meta.dirname, '..', 'cli.mjs'),
    openAPIfile,
    '--name',
    'movies',
    '--optional-headers',
    'foobar,authorization',
    '--types-only',
    '--full',
    'false'
  ])

  const typeFile = join(dir, 'movies', 'movies.d.ts')
  const data = await readFile(typeFile, 'utf-8')
  equal(
    data.includes(`
  export type PostHelloRequest = {
    'authorization'?: string;
  }
`),
    true
  )
})

test('common parameters in paths', async t => {
  const dir = await moveToTmpdir(after)

  const openAPIfile = join(import.meta.dirname, 'fixtures', 'common-parameters', 'openapi.json')
  await execa('node', [join(import.meta.dirname, '..', 'cli.mjs'), openAPIfile, '--name', 'movies', '--full-request'])

  const typeFile = join(dir, 'movies', 'movies.d.ts')
  const data = await readFile(typeFile, 'utf-8')
  equal(
    data.includes(`
  export type GetPathWithFieldIdRequest = {
    path: {
      /**
       * A field ID
       */
      'fieldId': string;
    }
    query: {
      /**
       * Movie id
       */
      'movieId': string;
    }
  }
`),
    true
  )
  equal(
    data.includes(`
  export type GetSampleRequest = {
    query: {
      /**
       * Movie id
       */
      'movieId': string;
    }
  }
`),
    true
  )
  equal(
    data.includes(`
  export type PostPathWithFieldIdRequest = {
    path: {
      /**
       * A field ID
       */
      'fieldId': string;
    }
  }
`),
    true
  )
  // test implementation
  try {
    await fs.unlink(join(import.meta.dirname, 'fixtures', 'common-parameters', 'db.sqlite'))
  } catch {
    // noop
  }
  const app = await create(join(import.meta.dirname, 'fixtures', 'common-parameters', 'platformatic.service.json'))

  const runtimeUrl = await app.start()

  await execa('node', [
    join(import.meta.dirname, '..', 'cli.mjs'),
    openAPIfile,
    '--name',
    'commonparams',
    '--full-request',
    '--full',
    'false'
  ])

  const toWrite = `
'use strict'

const Fastify = require('fastify')
const commonparams = require('./commonparams')
const app = Fastify({ logger: true })

app.register(commonparams, { url: '${runtimeUrl}' })
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
  t.after(() => safeKill(server2))
  t.after(async () => {
    await app.close()
  })

  const stream = server2.stdout.pipe(split(JSON.parse))

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

test('requestbody as array', async t => {
  const dir = await moveToTmpdir(after)

  const openAPIfile = join(import.meta.dirname, 'fixtures', 'requestbody-as-array-openapi.json')
  await execa('node', [join(import.meta.dirname, '..', 'cli.mjs'), openAPIfile, '--name', 'movies', '--full', 'false'])
  const typeFile = join(dir, 'movies', 'movies.d.ts')
  const data = await readFile(typeFile, 'utf-8')

  equal(
    data.includes(`
  export type Movies = {
    /**
     * @param req - request parameters object
     * @returns the API response body
     */
    postFoobar(req: PostFoobarRequest): Promise<PostFoobarResponses>;
  }
`),
    true
  )
  equal(data.includes("export type PostFoobarRequest = Array<{ 'id'?: string; 'title'?: string }>"), true)
})

test('requestBody and params should generate a full request', async t => {
  const dir = await moveToTmpdir(after)
  const openapiFile = join(import.meta.dirname, 'fixtures', 'requestbody-and-parameters-openapi.json')
  await execa('node', [join(import.meta.dirname, '..', 'cli.mjs'), openapiFile, '--name', 'movies', '--full', 'false'])

  // check the type file has the correct implementation for the request
  const typeFile = join(dir, 'movies', 'movies.d.ts')
  const data = await readFile(typeFile, 'utf-8')
  equal(
    data.includes(`
  export type PutFooRequest = {
    'bar': string;
    body: Array<{ 'codeType': 'customField'; 'externalId': unknown; 'internalId': string; 'kind': 'mapped' } | { 'codeType': 'costCenter'; 'externalId': unknown; 'kind': 'mapped' } | { 'externalId': unknown; 'kind': 'notMapped' }>
  }
`),
    true
  )
})

test('support formdata', async t => {
  const dir = await moveToTmpdir(after)

  const openAPIfile = join(import.meta.dirname, 'fixtures', 'multipart-formdata-openapi.json')
  await execa('node', [join(import.meta.dirname, '..', 'cli.mjs'), openAPIfile, '--name', 'movies', '--full', 'false'])
  const typeFile = join(dir, 'movies', 'movies.d.ts')
  const data = await readFile(typeFile, 'utf-8')
  equal(
    data.includes(`
  export type Movies = {
    /**
     * @param req - request parameters object
     * @returns the API response body
     */
    postSample(req: PostSampleRequest): Promise<PostSampleResponses>;
  }
`),
    true
  )
  equal(
    data.includes(`
  export type PostSampleRequest = {
    'data': { 'description'?: string; 'endDate': string | Date; 'startDate': string | Date };
  }`),
    true
  )
})

test('export formdata on full request object', async t => {
  const dir = await moveToTmpdir(after)

  const openAPIfile = join(import.meta.dirname, 'fixtures', 'multipart-formdata-openapi.json')
  await execa('node', [join(import.meta.dirname, '..', 'cli.mjs'), openAPIfile, '--name', 'movies', '--full-request'])
  const typeFile = join(dir, 'movies', 'movies.d.ts')
  const data = await readFile(typeFile, 'utf-8')
  equal(data.includes("import { type FormData } from 'undici"), true)
  equal(
    data.includes(`
  export type PostSampleRequest = {
    body: FormData;
  }`),
    true
  )
})

test('client with watt.json and skipConfigUpdate', async t => {
  const dir = await moveToTmpdir(after)

  const openAPIfile = join(import.meta.dirname, 'fixtures', 'client-with-config', 'openapi.json')
  await execa('node', [join(import.meta.dirname, '..', 'cli.mjs'), openAPIfile, '--name', 'client', '--full-request'])

  const data = await readFile(join(dir, 'client', 'client.d.ts'), 'utf-8')
  ok(data.includes("import { type FormData } from 'undici"))
  ok(data.includes('type ClientPlugin = FastifyPluginAsync<NonNullable<client.ClientOptions>>'))
  ok(
    data.includes(`
  interface FastifyRequest {
    'client': client.Client;
  }`)
  )

  const wattConfig = JSON.parse(
    await readFile(join(import.meta.dirname, 'fixtures', 'client-with-config', 'watt.json'), 'utf-8')
  )
  ok('$schema' in wattConfig)
  ok(!('clients' in wattConfig), 'watt.json config has no clients')
})

test('tsdoc client description', async t => {
  const dir = await moveToTmpdir(after)

  const openAPIfile = join(import.meta.dirname, 'fixtures', 'tsdoc-openapi.json')
  await execa('node', [join(import.meta.dirname, '..', 'cli.mjs'), openAPIfile, '--name', 'tsdoc', '--full', 'false'])

  const data = await readFile(join(dir, 'tsdoc', 'tsdoc.d.ts'), 'utf-8')

  // Title and description on request client
  ok(
    data.includes(`
  interface FastifyRequest {
    /**
     * Movies API
     *
     * An API with movies in it
     */
    'tsdoc': tsdoc.Tsdoc;
  }`)
  )
})

test('tsdoc client operation descriptions', async t => {
  const dir = await moveToTmpdir(after)

  const openAPIfile = join(import.meta.dirname, 'fixtures', 'tsdoc-openapi.json')
  await execa('node', [join(import.meta.dirname, '..', 'cli.mjs'), openAPIfile, '--name', 'tsdoc', '--full', 'false'])

  const data = await readFile(join(dir, 'tsdoc', 'tsdoc.d.ts'), 'utf-8')

  // Description and summary on method
  ok(
    data.includes(`
    /**
     * Create a movie
     *
     * Add a new movie to the movies database
     * @param req - request parameters object
     * @returns the API response body
     */
    createMovie(req: CreateMovieRequest): Promise<CreateMovieResponses>;`)
  )

  // Summary only on method
  ok(
    data.includes(`
    /**
     * Get a movie
     * @param req - request parameters object
     * @returns the API response body
     */
    getMovieById(req: GetMovieByIdRequest): Promise<GetMovieByIdResponses>;`)
  )

  // Description only on method
  ok(
    data.includes(`
    /**
     * Update the details of a movie
     * @param req - request parameters object
     * @returns the API response body
     */
    updateMovie(req: UpdateMovieRequest): Promise<UpdateMovieResponses>;`)
  )

  // Deprecated method
  ok(
    data.includes(`
    /**
     * Patch a movie
     * @deprecated
     * @param req - request parameters object
     * @returns the API response body
     */
    patchMovie(req: PatchMovieRequest): Promise<PatchMovieResponses>;`)
  )
})

test('tsdoc client request option descriptions', async t => {
  const dir = await moveToTmpdir(after)

  const openAPIfile = join(import.meta.dirname, 'fixtures', 'tsdoc-openapi.json')
  await execa('node', [join(import.meta.dirname, '..', 'cli.mjs'), openAPIfile, '--name', 'tsdoc', '--full', 'false'])

  const data = await readFile(join(dir, 'tsdoc', 'tsdoc.d.ts'), 'utf-8')

  // Description on title, not on id, built from requestBody scheme #ref
  ok(
    data.includes(`
  export type CreateMovieRequest = {
    'id'?: number;
    /**
     * The title of the movie
     */
    'title': string;
  }`)
  )

  // Description on ID, from parameters
  ok(
    data.includes(`
  export type GetMovieByIdRequest = {
    /**
     * The ID of the movie
     */
    'id': number;
  }`)
  )

  // Descriptions from mixed parameters and requestBody schema #ref
  ok(
    data.includes(`
  export type UpdateMovieRequest = {
    'fields'?: Array<'id' | 'title'>;
    /**
     * The ID of the movie
     */
    'id': number;
    /**
     * The title of the movie
     */
    'title': string;
  }`)
  )

  // Deprecated fields with and without descriptions
  ok(
    data.includes(`
  export type PatchMovieRequest = {
    /**
     * @deprecated
     */
    'fields'?: Array<'id' | 'title'>;
    /**
     * The ID of the movie
     * @deprecated
     */
    'id': number;
    /**
     * The title of the movie
     */
    'title': string;
  }`)
  )
})

test('tsdoc client request option descriptions (full-request)', async t => {
  const dir = await moveToTmpdir(after)

  const openAPIfile = join(import.meta.dirname, 'fixtures', 'tsdoc-openapi.json')
  await execa('node', [join(import.meta.dirname, '..', 'cli.mjs'), openAPIfile, '--name', 'tsdoc', '--full-request'])

  const data = await readFile(join(dir, 'tsdoc', 'tsdoc.d.ts'), 'utf-8')

  // Descriptions from mixed parameters and requestBody schema #ref
  ok(
    data.includes(`
  export type UpdateMovieRequest = {
    path: {
      /**
       * The ID of the movie
       */
      'id': number;
    }
    query?: {
      'fields'?: Array<'id' | 'title'>;
    }
    body: {
      /**
       * The title of the movie
       */
      'title': string;
    }
  }`)
  )
})
