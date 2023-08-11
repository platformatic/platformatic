import { request, moveToTmpdir } from './helper.js'
import { test } from 'tap'
import { buildServer } from '@platformatic/db'
import { buildServer as buildService } from '@platformatic/service'
import { join, posix } from 'path'
import * as desm from 'desm'
import { execa } from 'execa'
import { promises as fs } from 'fs'

test('generates only types in target folder with --only-types flag', async ({ teardown, comment, same, match }) => {
  const dir = await moveToTmpdir(teardown)
  comment(`working in ${dir}`)
  await execa('node', [desm.join(import.meta.url, '..', 'cli.mjs'), desm.join(import.meta.url, 'fixtures', 'movies', 'openapi.json'), '--name', 'movies', '-f', dir, '--types-only'])
  const files = await fs.readdir(dir)
  same(files.length, 1)
  same(files[0], 'movies.d.ts')

  // avoid name clash
  const fileContents = await fs.readFile(join(dir, 'movies.d.ts'), 'utf-8')
  match(fileContents, /declare namespace Movies {/)
  match(fileContents, /export const movies: MoviesPlugin;/)
})

test('openapi client generation (javascript)', async ({ teardown, comment, same }) => {
  try {
    await fs.unlink(desm.join(import.meta.url, 'fixtures', 'movies', 'db.sqlite'))
  } catch {
    // noop
  }
  const app = await buildServer(desm.join(import.meta.url, 'fixtures', 'movies', 'zero.db.json'))
  teardown(async () => { await app.close() })

  await app.start()

  const dir = await moveToTmpdir(teardown)
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

  const plugin = `
module.exports = async function (app) {
  app.post('/', async (request, reply) => {
    const res = await app.movies.createMovie({ title: 'foo' })
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
  teardown(async () => {
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
    fullResponse: false,
    throwOnError: false,
    type: 'openapi',
    url: '${app.url}/documentation/json',
    name: 'localMovies',
  })
  
  app.post('/', async (request, reply) => {
    const res = await app.movies.createMovie({ title: 'foo' })
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
      moduleResolution: 'node',
      lib: ['es2018']
    }
  }, null, 2)

  await fs.writeFile(join(dir, 'tsconfig.json'), tsconfig)

  process.env.PLT_MOVIES_URL = app.url

  const app2 = await buildService('./platformatic.service.json')
  await app2.start()
  teardown(async () => { await app.close() })
  teardown(async () => { await app2.close() })

  const res = await request(app2.url, {
    method: 'POST'
  })
  const body = await res.body.json()
  same(body, {
    id: 1,
    title: 'foo'
  })
})

test('config support with folder', async ({ teardown, comment, match }) => {
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

  await execa('node', [desm.join(import.meta.url, '..', 'cli.mjs'), app.url + '/documentation/json', '--name', 'movies', '--folder', 'uncanny'])

  {
    const config = JSON.parse(await fs.readFile('./platformatic.service.json'))
    match(config, {
      clients: [{
        schema: posix.join('uncanny', 'movies.openapi.json'),
        name: 'movies',
        type: 'openapi',
        url: '{PLT_MOVIES_URL}'
      }]
    })
  }
})

test('openapi client generation (typescript) with --types-only', async ({ teardown, comment, same }) => {
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
import { type FastifyPluginAsync } from 'fastify'
import pltClient from '@platformatic/client'

const myPlugin: FastifyPluginAsync<{}> = async (app, options) => {
  app.register(pltClient, {
    fullResponse: false,
    throwOnError: false,
    type: 'openapi',
    url: '${app.url}/documentation/json',
    name: 'movies'
  })
  
  app.post('/', async (request, reply) => {
    const res = await app.movies.createMovie({ title: 'foo' })
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
      moduleResolution: 'node',
      lib: ['es2018']
    }
  }, null, 2)

  await fs.writeFile(join(dir, 'tsconfig.json'), tsconfig)

  process.env.PLT_MOVIES_URL = app.url

  const app2 = await buildService('./platformatic.service.json')
  await app2.start()
  teardown(async () => { await app.close() })
  teardown(async () => { await app2.close() })

  const res = await request(app2.url, {
    method: 'POST'
  })
  const body = await res.body.json()
  same(body, {
    id: 1,
    title: 'foo'
  })
})
