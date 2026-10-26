import assert from 'node:assert'
import { test } from 'node:test'
import { platformaticService } from '../../index.js'
import { createFromConfig } from '../helper.js'

test('start readies an application created by init even when it does not listen', async t => {
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
    async function applicationFactory (app, opts) {
      app.register(platformaticService, opts)
      app.addHook('onReady', async () => {
        onReadyCalls++
      })
    }
  )

  // createFromConfig calls init() before start(), as the runtime does
  assert.strictEqual(onReadyCalls, 0)

  await capability.start({ listen: false })
  assert.strictEqual(onReadyCalls, 1, 'the onReady hooks run during start')
  assert.ok(!capability.url, 'the application does not listen')

  await capability.start({ listen: false })
  assert.strictEqual(onReadyCalls, 1, 'a second start does not run the onReady hooks again')

  await capability.start({ listen: true })
  assert.ok(capability.url, 'the application listens')
  assert.strictEqual(onReadyCalls, 1, 'listening after start does not run the onReady hooks again')
})

async function createWithHeadersTimeout (t, onReady) {
  const server = { hostname: '127.0.0.1', port: 0, logger: { level: 'fatal' } }

  // headersTimeout comes from the runtime server configuration, which the application schema does not
  // accept, so it is added after the configuration is validated
  return createFromConfig(
    t,
    { server },
    async function applicationFactory (app, opts) {
      app.register(platformaticService, opts)
      app.addHook('onReady', async () => {
        onReady(app.server)
      })
    },
    { config: { server: { ...server, headersTimeout: 66000 } } }
  )
}

for (const sequence of [[true], [false, true]]) {
  test(`start applies headersTimeout before the onReady hooks run (listen: ${sequence.join(', then ')})`, async t => {
    let headersTimeout
    const capability = await createWithHeadersTimeout(t, server => {
      headersTimeout = server.headersTimeout
    })

    for (const listen of sequence) {
      await capability.start({ listen })
    }

    assert.ok(capability.url, 'the application listens')
    assert.strictEqual(headersTimeout, 66000, 'the onReady hooks see the configured headersTimeout')
  })

  test(`start applies a headersTimeout updated after init (listen: ${sequence.join(', then ')})`, async t => {
    let headersTimeout
    const capability = await createWithHeadersTimeout(t, server => {
      headersTimeout = server.headersTimeout
    })

    await capability.updateContext({ serverConfig: { headersTimeout: 77000 } })
    for (const listen of sequence) {
      await capability.start({ listen })
    }

    assert.strictEqual(headersTimeout, 77000, 'the onReady hooks see the updated headersTimeout')
    assert.strictEqual(capability.getApplication().server.headersTimeout, 77000, 'the server uses it')
  })

  test(`listen applies headersTimeout after the onReady hooks run (listen: ${sequence.join(', then ')})`, async t => {
    const capability = await createWithHeadersTimeout(t, server => {
      server.headersTimeout = 88000
    })

    for (const listen of sequence) {
      await capability.start({ listen })
    }

    assert.strictEqual(
      capability.getApplication().server.headersTimeout,
      66000,
      'the configured headersTimeout replaces the value an onReady hook set on the server'
    )
  })
}

test('listen applies a headersTimeout updated after a start that did not listen', async t => {
  const capability = await createWithHeadersTimeout(t, () => {})

  await capability.start({ listen: false })
  await capability.updateContext({ serverConfig: { headersTimeout: 77000 } })
  await capability.start({ listen: true })

  assert.strictEqual(capability.getApplication().server.headersTimeout, 77000)
})
