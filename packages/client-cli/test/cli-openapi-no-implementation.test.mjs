import assert from 'node:assert/strict'
import { test } from 'node:test'
import { join, posix } from 'node:path'
import { promises as fs } from 'node:fs'
import { buildServer } from '@platformatic/db'
import { buildServer as buildService } from '@platformatic/service'
import * as desm from 'desm'
import { execa } from 'execa'
import { request, moveToTmpdir } from './helper.js'

test('generates only types in target folder with --types-only flag', async (t) => {
  const dir = await moveToTmpdir(t)
  await execa('node', [desm.join(import.meta.url, '..', 'cli.mjs'), desm.join(import.meta.url, 'fixtures', 'movies', 'openapi.json'), '--name', 'movies', '-f', dir, '--types-only'])
  const files = await fs.readdir(dir)
  assert.equal(files.length, 1)
  assert.equal(files[0], 'movies.d.ts')

  // avoid name clash
  const fileContents = await fs.readFile(join(dir, 'movies.d.ts'), 'utf-8')
  assert.match(fileContents, /declare namespace movies {/)
  assert.match(fileContents, /type MoviesPlugin = FastifyPluginAsync<NonNullable<movies.MoviesOptions>>/)
  assert.match(fileContents, /export const movies: MoviesPlugin;/)
  assert.match(fileContents, /export interface FullResponse<T, U extends number> {/)
  assert.match(fileContents, /'statusCode': U;/)
  assert.match(fileContents, /'headers': Record<string, string>;/)
  assert.match(fileContents, /'body': T;/)
  assert.match(fileContents, /export interface GetMoviesRequest {/)
  assert.match(fileContents, /export interface GetMoviesResponseOK {/)
  assert.match(fileContents, /export interface Movies {/)
})

test('openapi client generation (javascript)', async (t) => {
  try {
    await fs.unlink(desm.join(import.meta.url, 'fixtures', 'movies', 'db.sqlite'))
  } catch {
    // noop
  }
  const app = await buildServer(desm.join(import.meta.url, 'fixtures', 'movies', 'zero.db.json'))
  t.after(async () => { await app.close() })

  await app.start()

  await moveToTmpdir(t)

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

  const plugin = `
module.exports = async function (app) {
  app.post('/', async (request, reply) => {
    const res = await request.movies.createMovie({ title: 'foo' })
    return res
  })
}
  `

  await fs.writeFile('./platformatic.service.json', JSON.stringify(pltServiceConfig, null, 2))
  await fs.writeFile('./plugin.js', plugin)

  await execa('node', [desm.join(import.meta.url, '..', 'cli.mjs'), app.url + '/documentation/json', '--name', 'movies'])

  process.env.PLT_MOVIES_URL = app.url

  const app2 = await buildService('./platformatic.service.json')
  await app2.start()
  t.after(async () => {
    await app2.close()
  })

  const res = await request(app2.url, {
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
    await fs.unlink(desm.join(import.meta.url, 'fixtures', 'movies', 'db.sqlite'))
  } catch {
    // noop
  }
  const app = await buildServer(desm.join(import.meta.url, 'fixtures', 'movies', 'zero.db.json'))

  await app.start()

  const dir = await moveToTmpdir(t)

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
    const res = await request.movies.createMovie({ title: 'foo' })
    return res
  })
}

export default myPlugin
  `

  await fs.writeFile('./platformatic.service.json', JSON.stringify(pltServiceConfig, null, 2))
  await fs.writeFile('./plugin.ts', plugin)

  await execa('node', [desm.join(import.meta.url, '..', 'cli.mjs'), app.url + '/documentation/json', '--name', 'movies'])

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

  process.env.PLT_MOVIES_URL = app.url

  const app2 = await buildService('./platformatic.service.json')
  await app2.start()
  t.after(async () => { await app.close() })
  t.after(async () => { await app2.close() })

  const res = await request(app2.url, {
    method: 'POST'
  })
  const body = await res.body.json()
  assert.deepEqual(body, {
    id: 1,
    title: 'foo'
  })
})

test('config support with folder', async (t) => {
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

  await moveToTmpdir(t)

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

  await execa('node', [desm.join(import.meta.url, '..', 'cli.mjs'), app.url + '/documentation/json', '--name', 'movies', '--folder', 'uncanny'])

  {
    const config = JSON.parse(await fs.readFile('./platformatic.service.json'))
    assert.deepEqual(config.clients,
      [{
        schema: posix.join('uncanny', 'movies.openapi.json'),
        name: 'movies',
        type: 'openapi',
        url: '{PLT_MOVIES_URL}'
      }]
    )
  }
})

test('openapi client generation (typescript) with --types-only', async (t) => {
  try {
    await fs.unlink(desm.join(import.meta.url, 'fixtures', 'movies', 'db.sqlite'))
  } catch {
    // noop
  }
  const app = await buildServer(desm.join(import.meta.url, 'fixtures', 'movies', 'zero.db.json'))

  await app.start()

  const dir = await moveToTmpdir(t)

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
import pltClient from '@platformatic/client'

const myPlugin: FastifyPluginAsync<{}> = async (app, options) => {
  app.register(pltClient, {
    fullRequest: false,
    fullResponse: false,
    throwOnError: false,
    type: 'openapi',
    url: '${app.url}/documentation/json',
    name: 'movies'
  })
  
  app.post('/', async (request, reply) => {
    const res = await request.movies.createMovie({ title: 'foo' })
    return res
  })
}

export default myPlugin
  `

  await fs.writeFile('./platformatic.service.json', JSON.stringify(pltServiceConfig, null, 2))
  await fs.writeFile('./plugin.ts', plugin)

  await execa('node', [desm.join(import.meta.url, '..', 'cli.mjs'), app.url + '/documentation/json', '--name', 'movies', '--types-only'])

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

  process.env.PLT_MOVIES_URL = app.url

  const app2 = await buildService('./platformatic.service.json')
  await app2.start()
  t.after(async () => { await app.close() })
  t.after(async () => { await app2.close() })

  const res = await request(app2.url, {
    method: 'POST'
  })
  const body = await res.body.json()
  assert.deepEqual(body, {
    id: 1,
    title: 'foo'
  })
})

test('generate client twice', async (t) => {
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

  const plugin = `
module.exports = async function (app) {
  app.post('/', async (request, reply) => {
    const res = await request.movies.createMovie({ title: 'foo' })
    return res
  })
}
  `

  await fs.writeFile('./platformatic.service.json', JSON.stringify(pltServiceConfig, null, 2))
  await fs.writeFile('./plugin.js', plugin)

  await execa('node', [desm.join(import.meta.url, '..', 'cli.mjs'), app.url + '/documentation/json', '--name', 'movies'])
  await execa('node', [desm.join(import.meta.url, '..', 'cli.mjs'), app.url + '/documentation/json', '--name', 'movies'])

  const envFile = await fs.readFile(join(dir, '.env'), 'utf8')
  assert.equal(envFile.match(/PLT_MOVIES_URL/g).length, 1)
})

test('openapi client generation (javascript) from file', async (t) => {
  const openapi = desm.join(import.meta.url, 'fixtures', 'movies', 'openapi.json')

  await moveToTmpdir(t)

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

  await execa('node', [desm.join(import.meta.url, '..', 'cli.mjs'), openapi, '--name', 'movies'])
})
