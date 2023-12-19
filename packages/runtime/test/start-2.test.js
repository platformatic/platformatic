'use strict'
const assert = require('node:assert')
const { join } = require('node:path')
const { test } = require('node:test')
const { request } = require('undici')
const { loadConfig } = require('@platformatic/config')
const { buildServer, platformaticRuntime } = require('..')
const fixturesDir = join(__dirname, '..', 'fixtures')

const why = require('why-is-node-running')
setTimeout(() => {
  console.log('-----------------start-2 - start')
  why()
  console.log('-----------------start-2 - end')
}, 40000).unref()

test('can start applications programmatically from object', async (t) => {
  console.log('start-2 1 started')
  const configFile = join(fixturesDir, 'configs', 'monorepo.json')
  console.log('start-2 1.1')
  const config = await loadConfig({}, ['-c', configFile], platformaticRuntime)
  console.log('start-2 1.2')
  const app = await buildServer(config.configManager.current)
  console.log('start-2 1.3')
  const entryUrl = await app.start()
  console.log('start-2 1.4')

  t.after(async () => {
    console.log('close start-2.1')
    await app.close()
    console.log('close start-2.2')
  })

  console.log('start-2 1.5')
  const res = await request(entryUrl)
  console.log('start-2 1.6')

  assert.strictEqual(res.statusCode, 200)
  console.log('start-2 1.7')
  assert.deepStrictEqual(await res.body.json(), { hello: 'hello123' })
  console.log('start-2 1 finished')
})

test('can start applications programmatically from string', async (t) => {
  console.log('start-2 2 started')
  const configFile = join(fixturesDir, 'configs', 'monorepo.json')
  console.log('start-2 2.1')
  const app = await buildServer(configFile)
  console.log('start-2 2.2')
  const entryUrl = await app.start()
  console.log('start-2 2.3')

  t.after(async () => {
    console.log('close start-2.1')
    await app.close()
    console.log('close start-2.2')
  })

  {
    console.log('start-2 2.4')
    // Basic URL on the entrypoint.
    const res = await request(entryUrl)
    console.log('start-2 2.5')

    assert.strictEqual(res.statusCode, 200)
    console.log('start-2 2.6')
    assert.deepStrictEqual(await res.body.json(), { hello: 'hello123' })
    console.log('start-2 2.7')
  }

  {
    console.log('start-2 2.8')
    // URL on the entrypoint that uses internal message passing.
    const res = await request(entryUrl + '/upstream')
    console.log('start-2 2.9')

    assert.strictEqual(res.statusCode, 200)
    console.log('start-2 2.10')
    assert.deepStrictEqual(await res.body.json(), { hello: 'world' })
    console.log('start-2 2 2.11')
  }
})

test('composer', async (t) => {
  console.log('start-2 3 started')
  const configFile = join(fixturesDir, 'configs', 'monorepo-composer.json')
  console.log('start-2 3.1')
  const config = await loadConfig({}, ['-c', configFile], platformaticRuntime)
  console.log('start-2 3.2')
  const app = await buildServer(config.configManager.current)
  console.log('start-2 3.3')
  const entryUrl = await app.start()
  console.log('start-2 3.4')

  t.after(async () => {
    console.log('close start-2 3.1')
    await app.close()
    console.log('close start-2 3.2')
  })

  {
    console.log('start-2 3.5')
    const res = await request(entryUrl)
    console.log('start-2 3.6')

    assert.strictEqual(res.statusCode, 200)
    console.log('start-2 3.7')
    assert.deepStrictEqual(await res.body.json(), { message: 'Welcome to Platformatic! Please visit https://docs.platformatic.dev' })
    console.log('start-2 3.8')
  }

  {
    console.log('start-2 3.9')
    const res = await request(entryUrl + '/service-app/')
    console.log('start-2 3.10')

    assert.strictEqual(res.statusCode, 200)
    console.log('start-2 3.11')
    assert.deepStrictEqual(await res.body.json(), { hello: 'hello123' })
    console.log('start-2 3.12')
  }
})

test('can restart the runtime apps', async (t) => {
  console.log('start-2 4 started')
  const configFile = join(fixturesDir, 'configs', 'monorepo.json')
  console.log('start-2 4.1')
  const app = await buildServer(configFile)
  console.log('start-2 4.2')
  const entryUrl = await app.start()
  console.log('start-2 4.3')

  t.after(async () => {
    console.log('close start-2 4.1')
    await app.close()
    console.log('close start-2 4.2')
  })

  {
    console.log('start-2 4.4')
    const res = await request(entryUrl + '/upstream')
    console.log('start-2 4.5')

    assert.strictEqual(res.statusCode, 200)
    console.log('start-2 4.6')
    assert.deepStrictEqual(await res.body.json(), { hello: 'world' })
    console.log('start-2 4.7')
  }

  console.log('start-2 4.8')
  await app.restart()
  console.log('start-2 4.9')

  {
    console.log('start-2 4.10')
    const res = await request(entryUrl + '/upstream')
    console.log('start-2 4.11')

    assert.strictEqual(res.statusCode, 200)
    console.log('start-2 4.12')
    assert.deepStrictEqual(await res.body.json(), { hello: 'world' })
  }
  console.log('start-2 4 finished')
})
