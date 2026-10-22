import { deepStrictEqual, strictEqual } from 'node:assert'
import { once } from 'node:events'
import { resolve } from 'node:path'
import { test } from 'node:test'
import { request } from 'undici'
import { createRuntime, setFixturesDir } from '../../basic/test/helper.js'

setFixturesDir(resolve(import.meta.dirname, './fixtures'))

async function getJSON (url, path) {
  const { statusCode, body } = await request(url + path)
  strictEqual(statusCode, 200)
  return body.json()
}

async function verifyEcho (url) {
  const { statusCode, headers, body } = await request(url + '/echo', {
    method: 'POST',
    headers: { 'content-type': 'text/plain' },
    body: 'ping'
  })

  strictEqual(statusCode, 201)
  strictEqual(headers['content-type'], 'text/plain')
  strictEqual(headers['x-method'], 'POST')
  strictEqual(await body.text(), 'ping')
}

async function verifyMesh (url) {
  deepStrictEqual(await getJSON(url, '/binding'), { backend: true, url: '/from-binding' })
  deepStrictEqual(await getJSON(url, '/mesh'), { backend: true, url: '/from-mesh' })
}

test('runs a Worker inside the Watt thread', async t => {
  const { runtime, url } = await createRuntime(t, 'node')

  deepStrictEqual(await getJSON(url, '/env'), {
    greeting: 'hello',
    secret: 'dev-secret',
    fromWatt: 'watt',
    sameEnv: true
  })

  await verifyEcho(url)
  await verifyMesh(url)

  {
    const { statusCode, headers, body } = await request(url + '/cookies')
    strictEqual(statusCode, 200)
    deepStrictEqual(headers['set-cookie'], ['a=1', 'b=2'])
    strictEqual(await body.text(), 'ok')
  }

  {
    const { statusCode, body } = await request(url + '/wait-until')
    strictEqual(statusCode, 200)
    strictEqual(await body.text(), 'waited')
  }

  {
    const { statusCode, body } = await request(url + '/error')
    strictEqual(statusCode, 500)
    strictEqual(await body.text(), 'Internal Server Error')
  }

  // Inject via the mesh network
  {
    const res = await runtime.inject('worker', { method: 'GET', url: '/env' })
    strictEqual(res.statusCode, 200)
    strictEqual(JSON.parse(res.body).greeting, 'hello')
  }

  // Cron triggers are exposed as scheduled tasks
  const jobs = runtime.getSchedulerJobs().filter(job => job.applicationId === 'worker')
  strictEqual(jobs.length, 1)
  strictEqual(jobs[0].cron, '0 0 1 1 *')

  const execution = once(runtime, 'application:worker:event:scheduled')
  const result = await runtime.runSchedulerJob(jobs[0].name)
  strictEqual(result.success, true)
  deepStrictEqual((await execution).slice(0, 3), ['0 0 1 1 *', 'number', 'hello'])
})

test('supports class based Workers, TypeScript and Wrangler environments', async t => {
  const { url } = await createRuntime(t, 'class-ts')

  deepStrictEqual(await getJSON(url, '/path'), { stage: 'staging', onlyTopLevel: null, path: '/path' })
})

test('does not require a Wrangler configuration file', async t => {
  const { runtime, url } = await createRuntime(t, 'no-wrangler')

  deepStrictEqual(await getJSON(url, '/'), { greeting: 'hello' })
  deepStrictEqual(await getJSON(url, '/binding'), { backend: true, url: '/from-binding' })

  const jobs = runtime.getSchedulerJobs().filter(job => job.applicationId === 'worker')
  deepStrictEqual(
    jobs.map(job => job.cron),
    ['0 0 1 1 *']
  )
})
