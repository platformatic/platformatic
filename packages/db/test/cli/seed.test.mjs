import { cliPath, cleanSQLite } from './helper.mjs'
import { test } from 'tap'
import { request } from 'undici'
import { execa } from 'execa'
import stripAnsi from 'strip-ansi'
import split from 'split2'
import path from 'path'
import { urlDirname } from '../../lib/utils'

const dbLocation = path.resolve(path.join(urlDirname(import.meta.url), '..', 'fixtures', 'sqlite', 'db'))

test('seed and start', async ({ comment, equal, match, teardown }) => {
  await cleanSQLite(dbLocation)

  comment('migrating and seeding')
  const cwd = path.join(urlDirname(import.meta.url), '..', 'fixtures', 'sqlite')
  const seed = path.join(urlDirname(import.meta.url), '..', 'fixtures', 'sqlite', 'seed.js')
  comment(`dbl ${dbLocation}`)
  comment(`cwd ${cwd}`)
  const { stdout } = await execa('node', [cliPath, 'seed', seed], {
    cwd
  })

  {
    const sanitized = stripAnsi(stdout)
    match(sanitized, /001\.do\.sql/)
    match(sanitized, /seeding from .*seed\.js/)
    match(sanitized, /seeding complete/)
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
              query {
                graphs {
                  id
                  name
                }
              }
            `
      })
    })
    equal(res.statusCode, 200, 'graphs status code')
    const body = await res.body.json()
    match(body, {
      data: {
        graphs: [{
          id: 1,
          name: 'Hello'
        }, {
          id: 2,
          name: 'Hello 2'
        }]
      }
    }, 'graphs response')
  }
})

test('missing config file', async ({ equal, match }) => {
  try {
    await execa('node', [cliPath, 'seed'])
  } catch (err) {
    equal(err.exitCode, 1)
    match(err.stderr, 'Missing config file')
  }
})

test('missing seed file', async ({ equal, match }) => {
  const cwd = path.join(urlDirname(import.meta.url), '..', 'fixtures', 'sqlite')
  try {
    await execa('node', [cliPath, 'seed'], {
      cwd
    })
  } catch (err) {
    equal(err.exitCode, 1)
    match(err.stdout, 'Missing seed file')
  }
})

test('seed and start from cwd', async ({ comment, equal, match, teardown }) => {
  await cleanSQLite(dbLocation)

  comment('migrating and seeding')
  const cwd = path.join(urlDirname(import.meta.url), '..', 'fixtures', 'sqlite')
  const currentCWD = process.cwd()
  teardown(() => process.chdir(currentCWD))
  process.chdir(cwd)
  comment(`dbl ${dbLocation}`)
  comment(`cwd ${cwd}`)
  const { stdout } = await execa('node', [cliPath, 'seed', 'seed.js'], {
    cwd
  })

  {
    const sanitized = stripAnsi(stdout)
    match(sanitized, /001\.do\.sql/)
    match(sanitized, /seeding from .*seed\.js/)
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
              query {
                graphs {
                  id
                  name
                }
              }
            `
      })
    })
    equal(res.statusCode, 200, 'graphs status code')
    const body = await res.body.json()
    match(body, {
      data: {
        graphs: [{
          id: 1,
          name: 'Hello'
        }, {
          id: 2,
          name: 'Hello 2'
        }]
      }
    }, 'graphs response')
  }
})
