import { cliPath, connectAndResetDB } from './helper.js'
import { test } from 'tap'
import { join } from 'desm'
import { request } from 'undici'
import { execa } from 'execa'
import split from 'split2'
import { once } from 'events'

function parse (line) {
  try {
    return JSON.parse(line)
  } catch {
    console.log(line)
    return null
  }
}

test('env white list', async ({ equal, same, match, teardown }) => {
  const db = await connectAndResetDB()
  teardown(() => db.dispose())

  await db.query(db.sql`CREATE TABLE pages (
    id SERIAL PRIMARY KEY,
    title VARCHAR(42)
  );`)
  const child = execa('node', [
    cliPath,
    'start',
    '--config',
    join(import.meta.url, '..', 'fixtures', 'env-whitelist.json'),
    '--allow-env',
    'DATABASE_URL,HOSTNAME'
  ], {
    env: {
      DATABASE_URL: 'postgres://postgres:postgres@127.0.0.1/postgres',
      HOSTNAME: '127.0.0.1'
    }
  })
  child.stderr.pipe(process.stderr)
  const output = child.stdout.pipe(split(parse))
  const [{ url }] = await once(output, 'data')

  {
    // should connect to db and query it.
    const res = await request(`${url}/graphql`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
              mutation {
                savePage(input: { title: "Hello" }) {
                  id
                  title
                }
              }
            `
      })
    })
    equal(res.statusCode, 200, 'savePage status code')
    const body = await res.body.json()
    match(body, {
      data: {
        savePage: {
          title: 'Hello'
        }
      }
    }, 'savePage response')
  }

  child.kill('SIGINT')
})

test('env white list default values', async ({ equal, same, match, teardown }) => {
  const db = await connectAndResetDB()
  teardown(() => db.dispose())

  await db.query(db.sql`CREATE TABLE pages (
    id SERIAL PRIMARY KEY,
    title VARCHAR(42)
  );`)
  const child = execa('node', [
    cliPath,
    'start',
    '--config',
    join(import.meta.url, '..', 'fixtures', 'env-whitelist-default.json')
  ], {
    env: {
      DATABASE_URL: 'postgres://postgres:postgres@127.0.0.1/postgres',
      PORT: 10555
    }
  })
  const output = child.stdout.pipe(split(parse))
  const [{ url }] = await once(output, 'data')
  equal(url, 'http://127.0.0.1:10555')
  {
    // should connect to db and query it.
    const res = await request(`${url}/graphql`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
              mutation {
                savePage(input: { title: "Hello" }) {
                  id
                  title
                }
              }
            `
      })
    })
    equal(res.statusCode, 200, 'savePage status code')
    const body = await res.body.json()
    match(body, {
      data: {
        savePage: {
          title: 'Hello'
        }
      }
    }, 'savePage response')
  }

  child.kill('SIGINT')
})

test('env white list schema', async ({ matchSnapshot, teardown }) => {
  const db = await connectAndResetDB()
  teardown(() => db.dispose())

  await db.query(db.sql`CREATE TABLE pages (
    id SERIAL PRIMARY KEY,
    title VARCHAR(42)
  );`)
  const { stdout } = await execa('node', [
    cliPath,
    'schema',
    'graphql',
    '--config',
    join(import.meta.url, '..', 'fixtures', 'env-whitelist.json'),
    '--allow-env',
    'DATABASE_URL,HOSTNAME'
  ], {
    env: {
      DATABASE_URL: 'postgres://postgres:postgres@127.0.0.1/postgres',
      HOSTNAME: '127.0.0.1'
    }
  })
  matchSnapshot(stdout)
})
