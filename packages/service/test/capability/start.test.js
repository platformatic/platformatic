import assert from 'node:assert'
import { test } from 'node:test'
import { platformaticService } from '../../index.js'
import { createFromConfig } from '../helper.js'

/*
  The capability always readies its application when it starts, applies headersTimeout before the
  onReady hooks run, and listens only when the server configuration has a port.
*/

function createApplicationFactory (onReady) {
  return async function applicationFactory (app, opts) {
    app.register(platformaticService, opts)
    app.addHook('onReady', async () => {
      onReady(app.server)
    })
  }
}

test('start readies an application created by init even when it does not listen', async t => {
  let onReadyCalls = 0

  const capability = await createFromConfig(
    t,
    {
      // No port: the application is not exposed
      server: {
        hostname: '127.0.0.1',
        logger: { level: 'fatal' }
      }
    },
    createApplicationFactory(() => {
      onReadyCalls++
    })
  )

  // createFromConfig calls init() before start(), as the runtime does
  assert.strictEqual(onReadyCalls, 0)

  await capability.start()
  assert.strictEqual(onReadyCalls, 1, 'the onReady hooks run during start')
  assert.ok(!capability.url, 'the application does not listen')

  await capability.start()
  assert.strictEqual(onReadyCalls, 1, 'a second start does not run the onReady hooks again')
  assert.ok(!capability.url, 'the application still does not listen')

  const response = await capability.getApplication().inject({ method: 'GET', url: '/' })
  assert.strictEqual(response.statusCode, 200, 'the application serves injected requests')
})

test('start readies and listens an application which has a port', async t => {
  let onReadyCalls = 0

  const capability = await createFromConfig(
    t,
    {
      server: {
        hostname: '127.0.0.1',
        port: 0,
        logger: { level: 'fatal' }
      }
    },
    createApplicationFactory(() => {
      onReadyCalls++
    })
  )

  assert.strictEqual(onReadyCalls, 0)

  const url = await capability.start()
  assert.strictEqual(onReadyCalls, 1, 'the onReady hooks run once, during start')
  assert.ok(url, 'start returns the url')
  assert.strictEqual(capability.url, url, 'the application listens')

  await capability.start()
  assert.strictEqual(onReadyCalls, 1, 'a second start does not run the onReady hooks again')
  assert.strictEqual(capability.url, url, 'a second start does not listen again')
})

async function createWithHeadersTimeout (t, onReady, { listen = true } = {}) {
  const server = { hostname: '127.0.0.1', logger: { level: 'fatal' } }

  if (listen) {
    server.port = 0
  }

  // headersTimeout comes from the runtime server configuration, which the application schema does not
  // accept, so it is added after the configuration is validated
  return createFromConfig(t, { server }, createApplicationFactory(onReady), {
    config: { server: { ...server, headersTimeout: 66000 } }
  })
}

for (const listen of [true, false]) {
  const label = listen ? 'listening' : 'not listening'

  test(`start applies headersTimeout before the onReady hooks run (${label})`, async t => {
    let headersTimeout
    const capability = await createWithHeadersTimeout(
      t,
      server => {
        headersTimeout = server.headersTimeout
      },
      { listen }
    )

    await capability.start()

    assert.strictEqual(Boolean(capability.url), listen)
    assert.strictEqual(headersTimeout, 66000, 'the onReady hooks see the configured headersTimeout')
  })

  test(`start applies a headersTimeout updated after init (${label})`, async t => {
    let headersTimeout
    const capability = await createWithHeadersTimeout(
      t,
      server => {
        headersTimeout = server.headersTimeout
      },
      { listen }
    )

    await capability.updateContext({ serverConfig: { headersTimeout: 77000 } })
    await capability.start()

    assert.strictEqual(headersTimeout, 77000, 'the onReady hooks see the updated headersTimeout')
    assert.strictEqual(capability.getApplication().server.headersTimeout, 77000, 'the server uses it')
  })
}

test('listening applies headersTimeout after the onReady hooks run', async t => {
  const capability = await createWithHeadersTimeout(t, server => {
    server.headersTimeout = 88000
  })

  await capability.start()

  assert.strictEqual(
    capability.getApplication().server.headersTimeout,
    66000,
    'the configured headersTimeout replaces the value an onReady hook set on the server'
  )
})
