import { request, moveToTmpdir } from './helper.js'
import { test } from 'tap'
import { join, dirname } from 'path'
import { fileURLToPath } from 'node:url'
import * as desm from 'desm'
import { execa } from 'execa'
import { cp, writeFile } from 'node:fs/promises'
import split from 'split2'

test('openapi client generation (javascript) via the runtime', async ({ teardown, comment, same }) => {
  const dir = await moveToTmpdir(teardown)
  comment(`working in ${dir}`)

  await cp(join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'runtime'), dir, { recursive: true })

  process.chdir(join(dir, 'services', 'languid-nobleman'))

  await execa('node', [desm.join(import.meta.url, '..', 'cli.mjs'), '--name', 'movies', '--runtime', 'somber-chariot'])

  const toWrite = `
'use strict'

module.exports = async function (app, opts) {
  app.post('/', async (request, reply) => {
    const res = await app.movies.createMovie({ title: 'foo' })
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

test('generate client twice', async ({ teardown, comment, same, rejects }) => {
  const dir = await moveToTmpdir(teardown)
  comment(`working in ${dir}`)

  await cp(join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'runtime'), dir, { recursive: true })

  process.chdir(join(dir, 'services', 'languid-nobleman'))

  await execa('node', [desm.join(import.meta.url, '..', 'cli.mjs'), '--name', 'movies', '--runtime', 'somber-chariot'])
  await rejects(execa('node', [desm.join(import.meta.url, '..', 'cli.mjs'), '--name', 'movies', '--runtime', 'somber-chariot']))
})
