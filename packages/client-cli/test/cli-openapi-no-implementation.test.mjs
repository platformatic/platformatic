import { create } from '@platformatic/db'
import { create as buildService } from '@platformatic/service'
import { execa } from 'execa'
import { promises as fs } from 'fs'
import { match, ok, deepEqual as same } from 'node:assert'
import { after, test } from 'node:test'
import { join } from 'path'
import { moveToTmpdir, request } from './helper.js'

test('generates only types in target folder with --types-only flag', async t => {
  const dir = await moveToTmpdir(after)
  await execa('node', [
    join(import.meta.dirname, '..', 'cli.mjs'),
    join(import.meta.dirname, 'fixtures', 'movies', 'openapi.json'),
    '--name',
    'movies',
    '-f',
    dir,
    '--types-only'
  ])
  const files = await fs.readdir(dir)
  same(files.length, 1)
  same(files[0], 'movies.d.ts')

  // avoid name clash
  const fileContents = await fs.readFile(join(dir, 'movies.d.ts'), 'utf-8')
  match(fileContents, /export interface FullResponse<T, U extends number> {/)
  match(fileContents, /'statusCode': U;/)
  match(fileContents, /'headers': Record<string, string>;/)
  match(fileContents, /'body': T;/)
  match(fileContents, /export type GetMoviesRequest = {/)
  match(fileContents, /export type GetMoviesResponseOK = Array/)
  match(fileContents, /export type Movies = {/)
  match(fileContents, /export function generateMoviesClient\(opts: PlatformaticClientOptions\): Promise<Movies>;/)
  match(fileContents, /export default generateMoviesClient;/)
})

test('add an initial comment with --types-comment flag', async t => {
  const dir = await moveToTmpdir(after)
  await execa('node', [
    join(import.meta.dirname, '..', 'cli.mjs'),
    join(import.meta.dirname, 'fixtures', 'movies', 'openapi.json'),
    '--name',
    'movies',
    '-f',
    dir,
    '--types-only',
    '--types-comment',
    'this is an auto-generated file'
  ])

  const fileContents = await fs.readFile(join(dir, 'movies.d.ts'), 'utf-8')
  ok(fileContents.startsWith('// this is an auto-generated file'))
})

test('openapi client generation (javascript)', async t => {
  try {
    await fs.unlink(join(import.meta.dirname, 'fixtures', 'movies', 'db.sqlite'))
  } catch {
    // noop
  }
  const app = await create(join(import.meta.dirname, 'fixtures', 'movies', 'zero.db.json'))
  t.after(async () => {
    await app.close()
  })

  await app.start()

  await moveToTmpdir(after)

  const pltServiceConfig = {
    $schema: 'https://schemas.platformatic.dev/@platformatic/service/1.52.0.json',
    server: {
      hostname: '127.0.0.1',
      port: 0,
      logger: {
        level: 'fatal'
      }
    },
    plugins: {
      paths: ['./plugin.js']
    }
  }

  const plugin = `
const { resolve } = require('node:path')
const { buildOpenAPIClient } = require('@platformatic/client')

module.exports = async function (app) {
  const client = await buildOpenAPIClient({
    url: '${app.url}',
    path: resolve(__dirname, './movies/movies.openapi.json'),
  })

  app.post('/', async (request, reply) => {
    const res = await client.createMovie({ body: { title: 'foo' } })
    return res
  })
}
  `

  await fs.writeFile('./platformatic.service.json', JSON.stringify(pltServiceConfig, null, 2))
  await fs.writeFile('./plugin.js', plugin)

  await execa('node', [join(import.meta.dirname, '..', 'cli.mjs'), app.url + '/documentation/json', '--name', 'movies'])

  process.env.PLT_MOVIES_URL = app.url

  const app2 = await buildService('./platformatic.service.json')
  await app2.start()
  t.after(async () => {
    await app2.close()
  })

  const res = await request(app2.url, {
    method: 'POST'
  })
  const { body } = await res.body.json()
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

  await app.start()

  const dir = await moveToTmpdir(after)

  const pltServiceConfig = {
    $schema: 'https://schemas.platformatic.dev/@platformatic/service/1.52.0.json',
    server: {
      hostname: '127.0.0.1',
      port: 0,
      logger: {
        level: 'fatal'
      }
    },
    plugins: {
      paths: ['./plugin.ts']
    }
  }

  const plugin = `
/// <reference types="./movies" />
import { type FastifyPluginAsync } from 'fastify'
import { resolve } from 'node:path'
import { buildOpenAPIClient } from '@platformatic/client'

const myPlugin: FastifyPluginAsync<{}> = async (app, options) => {
  const client = await buildOpenAPIClient({
    url: '${app.url}',
    path: resolve(import.meta.dirname, './movies/movies.openapi.json'),
  })
    
  app.post('/', async (request, reply) => {
    const res = await client.createMovie({ body: { title: 'foo' } })
    return res
  })
}

export default myPlugin
  `

  await fs.writeFile('./platformatic.service.json', JSON.stringify(pltServiceConfig, null, 2))
  await fs.writeFile('./plugin.ts', plugin)
  await fs.writeFile('./package.json', JSON.stringify({ type: 'module' }))

  await execa('node', [join(import.meta.dirname, '..', 'cli.mjs'), app.url + '/documentation/json', '--name', 'movies'])

  const tsconfig = JSON.stringify(
    {
      extends: 'fastify-tsconfig',
      compilerOptions: {
        outDir: 'build',
        target: 'es2018',
        moduleResolution: 'NodeNext',
        lib: ['es2018']
      }
    },
    null,
    2
  )

  await fs.writeFile(join(dir, 'tsconfig.json'), tsconfig)

  process.env.PLT_MOVIES_URL = app.url

  const app2 = await buildService('./platformatic.service.json')
  await app2.start()
  t.after(async () => {
    await app.close()
  })
  t.after(async () => {
    await app2.close()
  })

  const res = await request(app2.url, {
    method: 'POST'
  })
  const { body } = await res.body.json()
  same(body, {
    id: 1,
    title: 'foo'
  })
})

test('openapi client generation (typescript) with --types-only', async t => {
  try {
    await fs.unlink(join(import.meta.dirname, 'fixtures', 'movies', 'db.sqlite'))
  } catch {
    // noop
  }
  const app = await create(join(import.meta.dirname, 'fixtures', 'movies', 'zero.db.json'))

  await app.start()

  const dir = await moveToTmpdir(after)

  const pltServiceConfig = {
    $schema: 'https://schemas.platformatic.dev/@platformatic/service/1.52.0.json',
    server: {
      hostname: '127.0.0.1',
      port: 0,
      logger: {
        level: 'fatal'
      }
    },
    plugins: {
      paths: ['./plugin.ts']
    }
  }

  const plugin = `
/// <reference types="${dir}/movies/movies" />
import { type FastifyPluginAsync } from 'fastify'
import pltClient from '@platformatic/client/fastify-plugin.js'

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
  await fs.writeFile('./package.json', JSON.stringify({ type: 'module' }))

  await execa('node', [
    join(import.meta.dirname, '..', 'cli.mjs'),
    app.url + '/documentation/json',
    '--name',
    'movies',
    '--types-only',
    '--full',
    'false'
  ])

  const tsconfig = JSON.stringify(
    {
      extends: 'fastify-tsconfig',
      compilerOptions: {
        outDir: 'build',
        target: 'es2018',
        moduleResolution: 'NodeNext',
        lib: ['es2018']
      }
    },
    null,
    2
  )

  await fs.writeFile(join(dir, 'tsconfig.json'), tsconfig)

  process.env.PLT_MOVIES_URL = app.url

  const app2 = await buildService('./platformatic.service.json')
  await app2.start()
  t.after(async () => {
    await app.close()
  })
  t.after(async () => {
    await app2.close()
  })

  const res = await request(app2.url, {
    method: 'POST'
  })
  const body = await res.body.json()
  same(body, {
    id: 1,
    title: 'foo'
  })
})

test('openapi client generation (typescript) with --types-only and --folder', async t => {
  try {
    await fs.unlink(join(import.meta.dirname, 'fixtures', 'movies', 'db.sqlite'))
  } catch {
    // noop
  }
  const app = await create(join(import.meta.dirname, 'fixtures', 'movies', 'zero.db.json'))

  await app.start()

  const dir = await moveToTmpdir(after)

  const pltServiceConfig = {
    $schema: 'https://schemas.platformatic.dev/@platformatic/service/1.52.0.json',
    server: {
      hostname: '127.0.0.1',
      port: 0,
      logger: {
        level: 'fatal'
      }
    },
    plugins: {
      paths: ['./plugin.ts']
    }
  }

  const plugin = `
/// <reference types="./uncanny/movies" />
import { type FastifyPluginAsync } from 'fastify'
import pltClient from '@platformatic/client/fastify-plugin.js'

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
  await fs.writeFile('./package.json', JSON.stringify({ type: 'module' }))

  await execa('node', [
    join(import.meta.dirname, '..', 'cli.mjs'),
    app.url + '/documentation/json',
    '--name',
    'movies',
    '--folder',
    'uncanny',
    '--types-only',
    '--full',
    'false'
  ])

  const tsconfig = JSON.stringify(
    {
      extends: 'fastify-tsconfig',
      compilerOptions: {
        outDir: 'build',
        target: 'es2018',
        moduleResolution: 'NodeNext',
        lib: ['es2018']
      }
    },
    null,
    2
  )

  await fs.writeFile(join(dir, 'tsconfig.json'), tsconfig)

  process.env.PLT_MOVIES_URL = app.url

  const app2 = await buildService('./platformatic.service.json')
  await app2.start()
  t.after(async () => {
    await app.close()
  })
  t.after(async () => {
    await app2.close()
  })

  const res = await request(app2.url, {
    method: 'POST'
  })
  const body = await res.body.json()
  same(body, {
    id: 1,
    title: 'foo'
  })
})

test('generate client twice', async t => {
  try {
    await fs.unlink(join(import.meta.dirname, 'fixtures', 'movies', 'db.sqlite'))
  } catch {
    // noop
  }
  const app = await create(join(import.meta.dirname, 'fixtures', 'movies', 'zero.db.json'))

  await app.start()
  t.after(async () => {
    await app.close()
  })

  await moveToTmpdir(after)

  const pltServiceConfig = {
    $schema: 'https://schemas.platformatic.dev/@platformatic/service/1.52.0.json',
    server: {
      hostname: '127.0.0.1',
      port: 0,
      logger: {
        level: 'fatal'
      }
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

  await execa('node', [join(import.meta.dirname, '..', 'cli.mjs'), app.url + '/documentation/json', '--name', 'movies'])
  await execa('node', [join(import.meta.dirname, '..', 'cli.mjs'), app.url + '/documentation/json', '--name', 'movies'])
})

test('openapi client generation (javascript) from file', async t => {
  const openapi = join(import.meta.dirname, 'fixtures', 'movies', 'openapi.json')

  await moveToTmpdir(after)

  const pltServiceConfig = {
    $schema: 'https://schemas.platformatic.dev/@platformatic/service/1.52.0.json',
    server: {
      hostname: '127.0.0.1',
      port: 0,
      logger: {
        level: 'fatal'
      }
    },
    plugins: {
      paths: ['./plugin.js']
    }
  }

  await fs.writeFile('./platformatic.service.json', JSON.stringify(pltServiceConfig, null, 2))

  await execa('node', [join(import.meta.dirname, '..', 'cli.mjs'), openapi, '--name', 'movies'])
})
