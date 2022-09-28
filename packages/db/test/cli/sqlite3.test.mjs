import { cliPath, cleanSQLite } from './helper.mjs'
import { test } from 'tap'
import { request } from 'undici'
import { execa } from 'execa'
import stripAnsi from 'strip-ansi'
import { access } from 'fs/promises'
import split from 'split2'
import path from 'path'
import { urlDirname } from '../../lib/utils.js'

const dbLocation = path.resolve(path.join(urlDirname(import.meta.url), '..', 'fixtures', 'sqlite', 'db'))

test('migrate and start', async ({ comment, equal, match, teardown }) => {
  await cleanSQLite(dbLocation)

  comment('migrating')
  const cwd = path.join(urlDirname(import.meta.url), '..', 'fixtures', 'sqlite')
  comment(`dbl ${dbLocation}`)
  comment(`cwd ${cwd}`)
  const { stdout } = await execa('node', [cliPath, 'migrate'], {
    cwd
  })

  {
    const sanitized = stripAnsi(stdout)
    match(sanitized, /001\.do\.sql/)
  }

  comment('starting')

  const child = execa('node', [cliPath, 'start'], {
    cwd
  })
  // child.stderr.pipe(process.stderr)
  const splitter = split()
  child.stdout.pipe(splitter)
  let url
  for await (const data of splitter) {
    try {
      const parsed = JSON.parse(data)
      if (parsed.url) {
        url = parsed.url
        break
      }
    } catch (err) {
      // do nothing as the line is not JSON
    }
  }
  teardown(() => child.kill('SIGINT'))

  {
    const res = await request(`${url}/graphql`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
              mutation {
                saveGraph(input: { name: "Hello" }) {
                  id
                  name
                }
              }
            `
      })
    })
    equal(res.statusCode, 200, 'saveGraph status code')
    const body = await res.body.json()
    match(body, {
      data: {
        saveGraph: {
          id: 1,
          name: 'Hello'
        }
      }
    }, 'saveGraph response')
  }
})

test('no cwd', async ({ comment, equal, match, teardown }) => {
  await cleanSQLite(dbLocation)
  comment('migrating')

  const config = path.join(urlDirname(import.meta.url), '..', 'fixtures', 'sqlite', 'platformatic.db.json')
  comment(`dbl ${dbLocation}`)
  comment(`cfg ${config}`)
  const { stdout } = await execa('node', [cliPath, 'migrate', '-c', config])

  {
    const sanitized = stripAnsi(stdout)
    match(sanitized, '001.do.sql')
  }

  await access(dbLocation)

  comment('starting')

  const child = execa('node', [cliPath, 'start', '-c', config])
  child.stderr.pipe(process.stderr)
  const splitter = split()
  child.stdout.pipe(splitter)
  let url
  for await (const data of splitter) {
    try {
      const parsed = JSON.parse(data)
      if (parsed.url) {
        url = parsed.url
        break
      }
    } catch (err) {
      // do nothing as the line is not JSON
    }
  }
  teardown(() => child.kill('SIGINT'))

  {
    const res = await request(`${url}/graphql`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
              mutation {
                saveGraph(input: { name: "Hello" }) {
                  id
                  name
                }
              }
            `
      })
    })
    equal(res.statusCode, 200, 'saveGraph status code')
    const body = await res.body.json()
    match(body, {
      data: {
        saveGraph: {
          id: 1,
          name: 'Hello'
        }
      }
    }, 'saveGraph response')
  }
})
