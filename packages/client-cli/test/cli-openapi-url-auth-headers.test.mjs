import { create } from '@platformatic/runtime'
import { execa } from 'execa'
import { promises as fs } from 'fs'
import { equal, ok } from 'node:assert'
import { after, test } from 'node:test'
import { join } from 'path'
import split from 'split2'
import { moveToTmpdir, request } from './helper.js'

test('url-auth-headers with wrong values', async t => {
  const app = await create(join(import.meta.dirname, 'fixtures', 'url-auth-headers', 'platformatic.service.json'))
  const url = await app.start()

  await moveToTmpdir(after)

  let errMessage
  try {
    await execa('node', [
      join(import.meta.dirname, '..', 'cli.mjs'),
      url + '/docs',
      '--name',
      'authUrlHeaders',
      '--url-auth-headers',
      'this-is-wrong'
    ])
  } catch ({ message }) {
    errMessage = message
  }

  ok(errMessage.includes('Command failed'))

  t.after(async () => {
    await app.close()
  })
})

test('url-auth-headers option with valid values', async t => {
  const app = await create(join(import.meta.dirname, 'fixtures', 'url-auth-headers', 'platformatic.service.json'))
  const runtimeUrl = await app.start()

  const dir = await moveToTmpdir(after)

  await execa('node', [
    join(import.meta.dirname, '..', 'cli.mjs'),
    runtimeUrl + '/docs',
    '--name',
    'authUrlHeaders',
    '--url-auth-headers',
    '{"authorization":"42"}',
    '--full',
    'false'
  ])

  const toWrite = `
import Fastify from 'fastify'
import authUrlHeaders from './authUrlHeaders/authUrlHeaders.js'

const app = Fastify({ logger: true })

const client = await authUrlHeaders({ url: '${runtimeUrl}' })
app.post('/', async (request, reply) => {
  const res = await client.getHello()
  return res
})
app.listen({ port: 0 })
`
  await fs.writeFile(join(dir, 'index.js'), toWrite)
  const app2 = execa('node', ['index.js'])
  app2.catch(() => {})
  t.after(() => app2.kill())
  t.after(async () => {
    await app.close()
  })

  const stream = app2.stdout.pipe(split(JSON.parse))

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

  const res = await request(url, { method: 'POST' })
  const body = await res.body.json()
  equal(body.foo, 'bar')
})
