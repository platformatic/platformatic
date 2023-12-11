'use strict'

const os = require('node:os')
const assert = require('assert')
const { test } = require('node:test')
const { join } = require('node:path')
const { writeFile } = require('node:fs/promises')
const { request } = require('undici')
const { buildServer } = require('..')

// set up the undici Agent
require('./helper')

test('load and reload ESM', async (t) => {
  const file = join(os.tmpdir(), `some-plugin-${process.pid}.mjs`)

  await writeFile(file, `
    export default async function (app) {
    }`
  )

  const app = await buildServer({
    server: {
      hostname: '127.0.0.1',
      port: 0
    },
    plugins: {
      paths: [file]
    }
  })

  t.after(async () => {
    await app.close()
  })
  await app.start()

  {
    const res = await request(`${app.url}/`)
    assert.strictEqual(res.statusCode, 200, 'status code')
    const data = await res.body.json()
    assert.deepStrictEqual(data, { message: 'Welcome to Platformatic! Please visit https://docs.platformatic.dev' })
  }

  await writeFile(file, `
    export default async function (app) {
      app.get('/', () => "hello world" )
    }`)

  await app.restart()

  {
    const res = await request(`${app.url}/`)
    assert.strictEqual(res.statusCode, 200, 'add status code')
    // The plugin is in Node's module cache, so the new value is not seen.
    assert.deepStrictEqual(await res.body.json(), { message: 'Welcome to Platformatic! Please visit https://docs.platformatic.dev' })
  }
})
