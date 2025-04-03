import assert from 'node:assert'
import { resolve } from 'node:path'
import { test } from 'node:test'
import { request } from 'undici'
import { createProductionRuntime, createRuntime, setFixturesDir } from '../../basic/test/helper.js'

setFixturesDir(resolve(import.meta.dirname, './fixtures'))

// test('services are started with multiple workers even for the entrypoint when Node.js supports reusePort', async t => {
//   await verifyReusePort(t, 'standalone', async res => {
//     const text = await res.body.text()

//     deepStrictEqual(res.statusCode, 200)
//     ok(/Hello from (v(<!-- -->)?\d+)(\s*(t(<!-- -->)?\d+))?/i.test(text))
//   })
// })

test('metrics are collected', async t => {
  const { url } = await createRuntime(t, 'metrics')

  console.log(url)

  {
    const res = await request(url + '/')
    const body = await res.body.text()
    console.log(body)
  }

  {
    const res = await request('http://localhost:9090/metrics')
    const body = await res.body.text()
    console.log(body)
  }
})

// createProductionRuntime, createRuntime
