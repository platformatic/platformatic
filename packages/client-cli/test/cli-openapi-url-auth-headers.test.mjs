import { request, moveToTmpdir } from './helper.js'
import { test, after } from 'node:test'
import { ok, equal } from 'node:assert'
import { buildServer } from '@platformatic/runtime'
import { join } from 'path'
import * as desm from 'desm'
import { execa } from 'execa'
import { promises as fs } from 'fs'
import split from 'split2'

test('url-auth-headers with wrong values', async (t) => {
  const app = await buildServer(desm.join(import.meta.url, 'fixtures', 'url-auth-headers', 'platformatic.service.json'))
  await app.start()

  const dir = await moveToTmpdir(after)
  t.diagnostic(`working in ${dir}`)

  let errName, errMessage
  try {
    await execa('node', [desm.join(import.meta.url, '..', 'cli.mjs'), app.url + '/docs', '--name', 'authUrlHeaders', '--url-auth-headers', 'this-is-wrong'])
  } catch ({ name, message }) {
    errName = name
    errMessage = message
  }

  equal(errName, 'Error')
  ok(errMessage.includes('Command failed'))

  t.after(async () => { await app.close() })
})

test('url-auth-headers option with valid values', async (t) => {
  const app = await buildServer(desm.join(import.meta.url, 'fixtures', 'url-auth-headers', 'platformatic.service.json'))
  await app.start()

  const dir = await moveToTmpdir(after)
  t.diagnostic(`working in ${dir}`)

  await execa('node', [desm.join(import.meta.url, '..', 'cli.mjs'), app.url + '/docs', '--name', 'authUrlHeaders', '--url-auth-headers', '{"authorization":"42"}'])

  const toWrite = `
'use strict'

const Fastify = require('fastify')
const authUrlHeaders = require('./authUrlHeaders')
const app = Fastify({ logger: true })

app.register(authUrlHeaders, { url: '${app.url}' })
app.post('/', async (request, reply) => {
  const res = await request.authUrlHeaders.getHello()
  return res
})
app.listen({ port: 0 })
`
  await fs.writeFile(join(dir, 'index.js'), toWrite)
  const app2 = execa('node', ['index.js'])
  t.after(() => app2.kill())
  t.after(async () => { await app.close() })

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

  const res = await request(url, { method: 'POST' })
  const body = await res.body.json()
  equal(body.foo, 'bar')
})
