import { request, moveToTmpdir } from './helper.js'
import { test } from 'tap'
import { join, dirname, posix } from 'path'
import { fileURLToPath } from 'node:url'
import * as desm from 'desm'
import { execa } from 'execa'
import { cp, writeFile, readFile } from 'node:fs/promises'
import split from 'split2'
import { once } from 'node:events'

test('openapi client generation (javascript) via the runtime', async ({ teardown, comment, same, match }) => {
  const dir = await moveToTmpdir(teardown)
  comment(`working in ${dir}`)

  await cp(join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'runtime'), dir, { recursive: true })

  await writeFile(join(dir, 'services', 'somber-chariot', '.env'), `
PLT_SERVER_HOSTNAME=127.0.0.1
PORT=3003
PLT_SERVER_LOGGER_LEVEL=info
DATABASE_URL=sqlite://./db.sqlite
`)

  await writeFile(join(dir, 'services', 'languid-nobleman', '.env'), `
PLT_SERVER_HOSTNAME=127.0.0.1
PORT=3004
PLT_SERVER_LOGGER_LEVEL=info
`)

  await writeFile(join(dir, 'services', 'composer', '.env'), `
PLT_SERVER_HOSTNAME=127.0.0.1
PORT=3000
PLT_SERVER_LOGGER_LEVEL=info
`)

  await writeFile(join(dir, 'services', 'sample-service', '.env'), `
PLT_SERVER_HOSTNAME=127.0.0.1
PORT=3005
PLT_SERVER_LOGGER_LEVEL=info
`)

  process.chdir(join(dir, 'services', 'languid-nobleman'))

  await execa('node', [desm.join(import.meta.url, '..', 'cli.mjs'), '--name', 'movies', '--runtime', 'somber-chariot'])

  const read = JSON.parse(await readFile(join(dir, 'services', 'languid-nobleman', 'platformatic.service.json'), 'utf8'))
  match(read, {
    clients: [{
      serviceId: 'somber-chariot',
      type: 'openapi',
      schema: posix.join('movies', 'movies.openapi.json')
    }]
  })

  const toWrite = `
'use strict'

module.exports = async function (app, opts) {
  app.post('/', async (request, reply) => {
    const res = await request.movies.createMovie({ title: 'foo' })
    return res
  })
}
`
  await writeFile(join(dir, 'services', 'languid-nobleman', 'routes', 'movies.js'), toWrite)

  process.chdir(dir)

  const app2 = execa('node', [desm.join(import.meta.url, '..', '..', 'cli', 'cli.js'), 'start'])
  teardown(() => app2.kill())

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
test('should return error if in the runtime root', async ({ teardown, comment, fail, match }) => {
  const dir = await moveToTmpdir(teardown)
  comment(`working in ${dir}`)

  await cp(join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'runtime'), dir, { recursive: true })

  process.chdir(dir)

  try {
    await execa('node', [desm.join(import.meta.url, '..', 'cli.mjs'), '--name', 'movies', '--runtime', 'somber-chariot'])

    fail()
  } catch (err) {
    match(err.message, 'Could not create a client runtime from the runtime root.')
  }
})

test('graphql client generation (javascript) via the runtime', async ({ teardown, comment, same, match }) => {
  const dir = await moveToTmpdir(teardown)
  comment(`working in ${dir}`)

  await cp(join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'runtime'), dir, { recursive: true })

  await writeFile(join(dir, 'services', 'somber-chariot', '.env'), `
PLT_SERVER_HOSTNAME=127.0.0.1
PORT=3003
PLT_SERVER_LOGGER_LEVEL=info
DATABASE_URL=sqlite://./db.sqlite
`)

  await writeFile(join(dir, 'services', 'languid-nobleman', '.env'), `
PLT_SERVER_HOSTNAME=127.0.0.1
PORT=3004
PLT_SERVER_LOGGER_LEVEL=info
`)

  await writeFile(join(dir, 'services', 'composer', '.env'), `
PLT_SERVER_HOSTNAME=127.0.0.1
PORT=3000
PLT_SERVER_LOGGER_LEVEL=info
`)

  await writeFile(join(dir, 'services', 'sample-service', '.env'), `
PLT_SERVER_HOSTNAME=127.0.0.1
PORT=3005
PLT_SERVER_LOGGER_LEVEL=info
`)

  process.chdir(join(dir, 'services', 'languid-nobleman'))

  // set graphql to true in somber-chariot db app
  const somberChariotConfigFile = join(dir, 'services', 'somber-chariot', 'platformatic.db.json')
  const scConfig = JSON.parse(await readFile(somberChariotConfigFile, 'utf8'))
  scConfig.db.openapi = false
  await writeFile(somberChariotConfigFile, JSON.stringify(scConfig, null, 2))

  await execa('node', [desm.join(import.meta.url, '..', 'cli.mjs'), '--name', 'movies', '--runtime', 'somber-chariot'])

  const read = JSON.parse(await readFile(join(dir, 'services', 'languid-nobleman', 'platformatic.service.json'), 'utf8'))
  match(read, {
    clients: [{
      serviceId: 'somber-chariot',
      type: 'graphql',
      schema: posix.join('movies', 'movies.schema.graphql')
    }]
  })

  const toWrite = `
'use strict'

module.exports = async function (app, opts) {
  app.post('/', async (request, reply) => {
    return await request.movies.graphql({
      query: \`
        mutation createMovie($title: String!) {
          saveMovie(input: {title: $title}) {
            id
            title
          }
        }
      \`,
      variables: {
        title: 'The Matrix'
      }
    })
  })
}
`
  await writeFile(join(dir, 'services', 'languid-nobleman', 'routes', 'movies.js'), toWrite)

  process.chdir(dir)

  const app2 = execa('node', [desm.join(import.meta.url, '..', '..', 'cli', 'cli.js'), 'start'])
  teardown(() => app2.kill())

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
    title: 'The Matrix'
  })
})

test('generate client twice', async ({ teardown, comment, same, match, equal }) => {
  const dir = await moveToTmpdir(teardown)
  comment(`working in ${dir}`)

  await cp(join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'runtime'), dir, { recursive: true })

  await writeFile(join(dir, 'services', 'somber-chariot', '.env'), `
PLT_SERVER_HOSTNAME=127.0.0.1
PORT=3003
PLT_SERVER_LOGGER_LEVEL=info
DATABASE_URL=sqlite://./db.sqlite
`)

  await writeFile(join(dir, 'services', 'languid-nobleman', '.env'), `
PLT_SERVER_HOSTNAME=127.0.0.1
PORT=3004
PLT_SERVER_LOGGER_LEVEL=info
`)

  await writeFile(join(dir, 'services', 'composer', '.env'), `
PLT_SERVER_HOSTNAME=127.0.0.1
PORT=3000
PLT_SERVER_LOGGER_LEVEL=info
`)
  await writeFile(join(dir, 'services', 'sample-service', '.env'), `
PLT_SERVER_HOSTNAME=127.0.0.1
PORT=3005
PLT_SERVER_LOGGER_LEVEL=info
`)
  process.chdir(join(dir, 'services', 'languid-nobleman'))

  await execa('node', [desm.join(import.meta.url, '..', 'cli.mjs'), '--name', 'movies', '--runtime', 'somber-chariot'])
  await execa('node', [desm.join(import.meta.url, '..', 'cli.mjs'), '--name', 'movies', '--runtime', 'somber-chariot'])

  const config = JSON.parse(await readFile(join(dir, 'services', 'languid-nobleman', 'platformatic.service.json'), 'utf8'))

  match(config, {
    clients: [{
      schema: 'movies/movies.openapi.json',
      name: 'movies',
      type: 'openapi',
      serviceId: 'somber-chariot'
    }]
  })
})

test('error if a service does not have openapi enabled', async ({ teardown, comment, match, fail }) => {
  const dir = await moveToTmpdir(teardown)
  comment(`working in ${dir}`)

  await cp(join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'runtime'), dir, { recursive: true })

  await writeFile(join(dir, 'services', 'somber-chariot', '.env'), `
PLT_SERVER_HOSTNAME=127.0.0.1
PORT=3003
PLT_SERVER_LOGGER_LEVEL=info
DATABASE_URL=sqlite://./db.sqlite
`)

  await writeFile(join(dir, 'services', 'languid-nobleman', '.env'), `
PLT_SERVER_HOSTNAME=127.0.0.1
PORT=3004
PLT_SERVER_LOGGER_LEVEL=info
`)

  await writeFile(join(dir, 'services', 'composer', '.env'), `
PLT_SERVER_HOSTNAME=127.0.0.1
PORT=3000
PLT_SERVER_LOGGER_LEVEL=info
`)

  await writeFile(join(dir, 'services', 'sample-service', '.env'), `
PLT_SERVER_HOSTNAME=127.0.0.1
PORT=3005
PLT_SERVER_LOGGER_LEVEL=info
`)

  process.chdir(join(dir, 'services', 'composer'))

  try {
    await execa('node', [desm.join(import.meta.url, '..', 'cli.mjs'), '--name', 'test-client', '--runtime', 'sample-service'])
    fail()
  } catch (err) {
    const split = err.message.split('\n')
    const lastMessage = split.pop()
    match(lastMessage, 'Could not find a valid OpenAPI or GraphQL schema at http://sample-service.plt.local')
  }
})

test('no platformatic.runtime.json', async ({ teardown, comment, match, plan, equal }) => {
  plan(2)
  const dir = await moveToTmpdir(teardown)
  comment(`working in ${dir}`)

  process.chdir(dir)

  const app = execa('node', [desm.join(import.meta.url, '..', 'cli.mjs'), '--name', 'movies', '--runtime', 'somber-chariot'])

  const onExit = once(app, 'exit')

  const stream = app.stdout.pipe(split())

  for await (const line of stream) {
    match(line, 'Could not find a platformatic.runtime.json file in this or any parent directory.')
  }

  const [code] = await onExit
  equal(code, 1)
})
