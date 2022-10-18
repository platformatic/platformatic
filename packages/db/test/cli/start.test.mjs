import { connectAndResetDB, start } from './helper.mjs'
import { test } from 'tap'
import { join } from 'desm'
import { request } from 'undici'

test('autostart', async ({ equal, same, match, teardown }) => {
  const db = await connectAndResetDB()
  teardown(() => db.dispose())

  await db.query(db.sql`CREATE TABLE pages (
    id SERIAL PRIMARY KEY,
    title VARCHAR(42)
  );`)

  const { child, url } = await start('-c', join(import.meta.url, '..', 'fixtures', 'simple.json'))

  let id
  {
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
    id = body.data.savePage.id
  }

  {
    const res = await request(`${url}/graphql`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
              query {
                getPageById(id: ${id}) {
                  id
                  title
                }
              }
            `
      })
    })
    equal(res.statusCode, 200, 'pages status code')
    same(await res.body.json(), {
      data: {
        getPageById: {
          id,
          title: 'Hello'
        }
      }
    }, 'pages response')
  }

  {
    const res = await request(`${url}/graphql`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
              mutation {
                savePage(input: { id: ${id}, title: "Hello World" }) {
                  id
                  title
                }
              }
            `
      })
    })
    equal(res.statusCode, 200, 'savePage status code')
    same(await res.body.json(), {
      data: {
        savePage: {
          id,
          title: 'Hello World'
        }
      }
    }, 'savePage response')
  }

  {
    const res = await request(`${url}/graphql`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
              query {
                getPageById(id: ${id}) {
                  id
                  title
                }
              }
            `
      })
    })
    equal(res.statusCode, 200, 'pages status code')
    same(await res.body.json(), {
      data: {
        getPageById: {
          id,
          title: 'Hello World'
        }
      }
    }, 'pages response')
  }

  child.kill('SIGINT')
})

test('start command', async ({ equal, same, match, teardown }) => {
  const db = await connectAndResetDB()
  teardown(() => db.dispose())

  await db.query(db.sql`CREATE TABLE pages (
    id SERIAL PRIMARY KEY,
    title VARCHAR(42)
  );`)

  const { child, url } = await start('start', '-c', join(import.meta.url, '..', 'fixtures', 'simple.json'))

  let id
  {
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
    id = body.data.savePage.id
  }

  {
    const res = await request(`${url}/graphql`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
              query {
                getPageById(id: ${id}) {
                  id
                  title
                }
              }
            `
      })
    })
    equal(res.statusCode, 200, 'pages status code')
    same(await res.body.json(), {
      data: {
        getPageById: {
          id,
          title: 'Hello'
        }
      }
    }, 'pages response')
  }

  {
    const res = await request(`${url}/graphql`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
              mutation {
                savePage(input: { id: ${id}, title: "Hello World" }) {
                  id
                  title
                }
              }
            `
      })
    })
    equal(res.statusCode, 200, 'savePage status code')
    same(await res.body.json(), {
      data: {
        savePage: {
          id,
          title: 'Hello World'
        }
      }
    }, 'savePage response')
  }

  {
    const res = await request(`${url}/graphql`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
              query {
                getPageById(id: ${id}) {
                  id
                  title
                }
              }
            `
      })
    })
    equal(res.statusCode, 200, 'pages status code')
    same(await res.body.json(), {
      data: {
        getPageById: {
          id,
          title: 'Hello World'
        }
      }
    }, 'pages response')
  }

  child.kill('SIGINT')
})

test('default logger', async ({ equal, same, match, teardown }) => {
  const db = await connectAndResetDB()
  teardown(() => db.dispose())

  await db.query(db.sql`CREATE TABLE pages (
    id SERIAL PRIMARY KEY,
    title VARCHAR(42)
  );`)

  const { child, url } = await start('-c', join(import.meta.url, '..', 'fixtures', 'no-server-logger.json'))
  match(url, /http:\/\/127.0.0.1:[0-9]+/)
  child.kill('SIGINT')
})

test('start with hotreload disabled', async ({ equal, same, match, teardown }) => {
  const db = await connectAndResetDB()
  teardown(() => db.dispose())

  await db.query(db.sql`CREATE TABLE pages (
    id SERIAL PRIMARY KEY,
    title VARCHAR(42)
  );`)

  const { child, url } = await start('-c', join(import.meta.url, '..', 'fixtures', 'no-hotreload.json'))
  match(url, /http:\/\/127.0.0.1:[0-9]+/)
  child.kill('SIGINT')
})
