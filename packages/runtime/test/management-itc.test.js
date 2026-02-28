import { deepStrictEqual, ok, strictEqual } from 'node:assert'
import { join } from 'node:path'
import { test } from 'node:test'
import { request } from 'undici'
import { createRuntime } from './helpers.js'

const fixturesDir = join(import.meta.dirname, '..', 'fixtures')

test('management ITC - privileged app has management client', async t => {
  const configFile = join(fixturesDir, 'management-itc')
  const runtime = await createRuntime(configFile, null)

  t.after(async () => {
    await runtime.close()
  })

  const url = await runtime.start()

  // Privileged service has management client
  {
    const res = await request(url + '/has-management')
    deepStrictEqual(res.statusCode, 200)
    const body = await res.body.json()
    strictEqual(body.has, true)
  }
})

test('management ITC - unprivileged app does not have management client', async t => {
  const configFile = join(fixturesDir, 'management-itc')
  const runtime = await createRuntime(configFile, null)

  t.after(async () => {
    await runtime.close()
  })

  await runtime.start()

  // Unprivileged service has no management client
  const res = await runtime.inject('unprivileged', { method: 'GET', url: '/has-management' })
  const body = JSON.parse(res.body)
  strictEqual(body.has, false)
})

test('management ITC - getRuntimeStatus', async t => {
  const configFile = join(fixturesDir, 'management-itc')
  const runtime = await createRuntime(configFile, null)

  t.after(async () => {
    await runtime.close()
  })

  const url = await runtime.start()

  const res = await request(url + '/status')
  deepStrictEqual(res.statusCode, 200)
  const body = await res.body.json()
  strictEqual(body.status, 'started')
})

test('management ITC - getRuntimeMetadata', async t => {
  const configFile = join(fixturesDir, 'management-itc')
  const runtime = await createRuntime(configFile, null)

  t.after(async () => {
    await runtime.close()
  })

  const url = await runtime.start()

  const res = await request(url + '/metadata')
  deepStrictEqual(res.statusCode, 200)
  const body = await res.body.json()
  ok(body.pid)
  ok(body.nodeVersion)
  ok(body.platformaticVersion)
})

test('management ITC - getApplicationsIds', async t => {
  const configFile = join(fixturesDir, 'management-itc')
  const runtime = await createRuntime(configFile, null)

  t.after(async () => {
    await runtime.close()
  })

  const url = await runtime.start()

  const res = await request(url + '/applications-ids')
  deepStrictEqual(res.statusCode, 200)
  const body = await res.body.json()
  ok(body.ids.includes('privileged'))
  ok(body.ids.includes('restricted'))
  ok(body.ids.includes('unprivileged'))
})

test('management ITC - getApplications', async t => {
  const configFile = join(fixturesDir, 'management-itc')
  const runtime = await createRuntime(configFile, null)

  t.after(async () => {
    await runtime.close()
  })

  const url = await runtime.start()

  const res = await request(url + '/applications')
  deepStrictEqual(res.statusCode, 200)
  const body = await res.body.json()
  strictEqual(body.entrypoint, 'privileged')
  ok(Array.isArray(body.applications))
  strictEqual(body.applications.length, 3)
})

test('management ITC - getApplicationDetails', async t => {
  const configFile = join(fixturesDir, 'management-itc')
  const runtime = await createRuntime(configFile, null)

  t.after(async () => {
    await runtime.close()
  })

  const url = await runtime.start()

  const res = await request(url + '/applications/unprivileged')
  deepStrictEqual(res.statusCode, 200)
  const body = await res.body.json()
  strictEqual(body.id, 'unprivileged')
  strictEqual(body.status, 'started')
})

test('management ITC - getApplicationDetails with nonexistent id returns error', async t => {
  const configFile = join(fixturesDir, 'management-itc')
  const runtime = await createRuntime(configFile, null)

  t.after(async () => {
    await runtime.close()
  })

  const url = await runtime.start()

  const res = await request(url + '/applications/nonexistent')
  ok(res.statusCode >= 400)
})

test('management ITC - inject to another service', async t => {
  const configFile = join(fixturesDir, 'management-itc')
  const runtime = await createRuntime(configFile, null)

  t.after(async () => {
    await runtime.close()
  })

  const url = await runtime.start()

  const res = await request(url + '/inject', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      id: 'unprivileged',
      method: 'GET',
      url: '/hello'
    })
  })
  deepStrictEqual(res.statusCode, 200)
  const body = await res.body.json()
  strictEqual(body.statusCode, 200)
  const injectedBody = JSON.parse(body.body)
  strictEqual(injectedBody.service, 'unprivileged')
})

test('management ITC - restricted app can call allowed operations', async t => {
  const configFile = join(fixturesDir, 'management-itc')
  const runtime = await createRuntime(configFile, null)

  t.after(async () => {
    await runtime.close()
  })

  await runtime.start()

  // Restricted service has management client
  {
    const res = await runtime.inject('restricted', { method: 'GET', url: '/has-management' })
    const body = JSON.parse(res.body)
    strictEqual(body.has, true)
  }

  // Can call allowed operations
  {
    const res = await runtime.inject('restricted', { method: 'GET', url: '/status' })
    const body = JSON.parse(res.body)
    strictEqual(body.status, 'started')
  }

  {
    const res = await runtime.inject('restricted', { method: 'GET', url: '/applications-ids' })
    const body = JSON.parse(res.body)
    ok(body.ids.includes('privileged'))
  }

  {
    const res = await runtime.inject('restricted', { method: 'GET', url: '/applications/privileged' })
    const body = JSON.parse(res.body)
    strictEqual(body.id, 'privileged')
  }
})

test('management ITC - restricted app cannot call disallowed operations', async t => {
  const configFile = join(fixturesDir, 'management-itc')
  const runtime = await createRuntime(configFile, null)

  t.after(async () => {
    await runtime.close()
  })

  await runtime.start()

  // Cannot call getRuntimeConfig - not in allowed operations
  const res = await runtime.inject('restricted', { method: 'GET', url: '/config' })
  const body = JSON.parse(res.body)
  ok(body.error)
  ok(body.error.includes('not allowed'))
})

test('management ITC - restartApplication', async t => {
  const configFile = join(fixturesDir, 'management-itc')
  const runtime = await createRuntime(configFile, null)

  t.after(async () => {
    await runtime.close()
  })

  const url = await runtime.start()

  // Restart the unprivileged service
  const res = await request(url + '/applications/unprivileged/restart', { method: 'POST' })
  deepStrictEqual(res.statusCode, 200)
  const body = await res.body.json()
  strictEqual(body.ok, true)

  // Verify it's still working after restart
  const detailsRes = await request(url + '/applications/unprivileged')
  deepStrictEqual(detailsRes.statusCode, 200)
  const details = await detailsRes.body.json()
  strictEqual(details.id, 'unprivileged')
  strictEqual(details.status, 'started')
})

test('management ITC - getRuntimeConfig', async t => {
  const configFile = join(fixturesDir, 'management-itc')
  const runtime = await createRuntime(configFile, null)

  t.after(async () => {
    await runtime.close()
  })

  const url = await runtime.start()

  const res = await request(url + '/config')
  deepStrictEqual(res.statusCode, 200)
  const body = await res.body.json()
  ok(body.entrypoint || body.server || body.logger)
})

test('management ITC - getWorkers', async t => {
  const configFile = join(fixturesDir, 'management-itc')
  const runtime = await createRuntime(configFile, null)

  t.after(async () => {
    await runtime.close()
  })

  const url = await runtime.start()

  const res = await request(url + '/workers')
  deepStrictEqual(res.statusCode, 200)
  const body = await res.body.json()
  ok(typeof body === 'object')
})
