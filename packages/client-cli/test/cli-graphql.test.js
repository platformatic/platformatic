import { create } from '@platformatic/db'
import { match } from '@platformatic/foundation'
import { execa } from 'execa'
import { existsSync, promises as fs } from 'fs'
import { copy } from 'fs-extra'
import graphql from 'graphql'
import { equal } from 'node:assert'
import { after, test } from 'node:test'
import { join } from 'path'
import split from 'split2'
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

test('graphql client generation (javascript)', async t => {
  try {
    await fs.unlink(join(import.meta.dirname, 'fixtures', 'movies', 'db.sqlite'))
  } catch {
    // noop
  }
  const app = await create(join(import.meta.dirname, 'fixtures', 'movies', 'zero.db.json'))

  await app.start()

  const dir = await moveToTmpdir(after)

  await execa('node', [join(import.meta.dirname, '..', 'index.js'), app.url, '--name', 'movies', '--type', 'graphql'])

  const readSDL = await fs.readFile(join(dir, 'movies', 'movies.schema.graphql'), 'utf8')
  {
    const schema = graphql.buildSchema(readSDL)
    const sdl = graphql.printSchema(schema)
    equal(sdl, readSDL)
  }

  const toWrite = `
import Fastify from 'fastify'
import movies from './movies/movies.js'

const app = Fastify({ logger: true })
const client = await movies({ url: '${app.url}' })

app.post('/', async (request, reply) => {
  const res = await client.graphql({
    query: 'mutation { saveMovie(input: { title: "foo" }) { id, title } }'
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
  if (!url) {
    throw new Error('no url was found')
  }
  const res = await request(url, {
    method: 'POST'
  })
  const body = await res.body.json()
  equal(
    match(body, {
      title: 'foo'
    }),
    true
  )
})

test('graphql client generation (typescript)', async t => {
  try {
    await fs.unlink(join(import.meta.dirname, 'fixtures', 'movies', 'db.sqlite'))
  } catch {
    // noop
  }
  const app = await create(join(import.meta.dirname, 'fixtures', 'movies', 'zero.db.json'))

  await app.start()

  const dir = await moveToTmpdir(after)

  await execa('node', [join(import.meta.dirname, '..', 'index.js'), app.url + '/graphql', '--name', 'movies'])

  const toWrite = `
import Fastify from 'fastify'
import { generateMoviesClient } from './movies/movies.js'

const app = Fastify({ logger: true })

app.post('/', async (req) => {
  const client = await generateMoviesClient({ url: '${app.url}' })

  const res = await client.graphql({
    query: 'mutation { saveMovie(input: { title: "foo" }) { id, title } }'
  })
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
        lib: ['es2018']
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
  await fs.writeFile(join(dir, 'build', 'movies', 'package.json'), JSON.stringify({ type: 'module' }))

  const server2 = execa('node', ['build/index.js'])
  server2.catch(() => {})

  t.after(() => server2.kill())
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
      title: 'foo'
    }),
    true
  )
})

test('graphql client generation with relations (typescript)', async t => {
  try {
    await fs.unlink(join(import.meta.dirname, 'fixtures', 'movies-quotes', 'db.sqlite'))
  } catch {
    // noop
  }
  const app = await create(join(import.meta.dirname, 'fixtures', 'movies-quotes', 'platformatic.db.json'))

  await app.start()

  const dir = await moveToTmpdir(after)

  await execa('node', [join(import.meta.dirname, '..', 'index.js'), app.url + '/graphql', '--name', 'movies'])

  const toWrite = `
import Fastify from 'fastify';
import { generateMoviesClient } from './movies/movies.js';
import type { Movie, Quote } from './movies/movies.js';

const app = Fastify({ logger: true });

app.post('/', async (req) => {
  const client = await generateMoviesClient({ url: '${app.url}' })

  const res1 = await client.graphql<Movie>({
    query: \`mutation {
      saveMovie(input: { title: "foo" }) { id, title } }
    \`
  })
  const res2 = await client.graphql<Quote>({
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

  const tsconfig = JSON.stringify(
    {
      extends: 'fastify-tsconfig',
      compilerOptions: {
        outDir: 'build',
        target: 'es2018',
        module: 'nodenext',
        moduleResolution: 'NodeNext',
        lib: ['es2018']
      }
    },
    null,
    2
  )

  await fs.writeFile(join(dir, 'tsconfig.json'), tsconfig)

  const tsc = findTSCPath()
  await execa(tsc, [], { env })

  // TODO how can we avoid this symlink?
  await copy(join(dir, 'movies'), join(dir, 'build', 'movies'))
  await fs.writeFile(join(dir, 'build', 'movies', 'package.json'), JSON.stringify({ type: 'module' }))

  const server2 = execa('node', ['build/index.js'])
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
      quote: 'foo',
      movie: {
        title: 'foo'
      }
    }),
    true
  )
})

test('graphql client generation (javascript) with slash at the end of the URL', async t => {
  try {
    await fs.unlink(join(import.meta.dirname, 'fixtures', 'movies', 'db.sqlite'))
  } catch {
    // noop
  }
  const app = await create(join(import.meta.dirname, 'fixtures', 'movies', 'zero.db.json'))

  await app.start()

  const dir = await moveToTmpdir(after)

  await execa('node', [join(import.meta.dirname, '..', 'index.js'), app.url + '/graphql', '--name', 'movies'])

  const toWrite = `
import Fastify from 'fastify'
import movies from './movies/movies.js'

const app = Fastify({ logger: true })
const client = await movies({ url: '${app.url}' })

app.post('/', async (request, reply) => {
  const res = await client.graphql({
    query: 'mutation { saveMovie(input: { title: "foo" }) { id, title } }'
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
  const res = await request(url, {
    method: 'POST'
  })
  const body = await res.body.json()
  equal(
    match(body, {
      title: 'foo'
    }),
    true
  )
})

test('graphql client generation (javascript) from a file', async t => {
  try {
    await fs.unlink(join(import.meta.dirname, 'fixtures', 'movies', 'db.sqlite'))
  } catch {
    // noop
  }
  const app = await create(join(import.meta.dirname, 'fixtures', 'movies', 'zero.db.json'))

  await app.start()

  const dir = await moveToTmpdir(after)

  const sdl = graphql.printSchema(app.getApplication().graphql.schema)
  const sdlFile = join(dir, 'movies.schema.graphql')
  await fs.writeFile(sdlFile, sdl)

  await execa('node', [join(import.meta.dirname, '..', 'index.js'), sdlFile, '--name', 'movies'])

  const readSDL = await fs.readFile(join(dir, 'movies', 'movies.schema.graphql'), 'utf8')
  equal(sdl, readSDL)

  const toWrite = `
import Fastify from 'fastify'
import movies from './movies/movies.js'

const app = Fastify({ logger: true })
const client = await movies({ url: '${app.url}' })

app.post('/', async (request, reply) => {
  const res = await client.graphql({
    query: 'mutation { saveMovie(input: { title: "foo" }) { id, title } }'
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
  if (!url) {
    throw new Error('no url was found')
  }
  const res = await request(url, {
    method: 'POST'
  })
  const body = await res.body.json()
  equal(
    match(body, {
      title: 'foo'
    }),
    true
  )
})
