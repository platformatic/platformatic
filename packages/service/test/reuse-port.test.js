import { features } from '@platformatic/foundation'
import assert from 'node:assert'
import { test } from 'node:test'
import { request } from 'undici'
import { buildConfig, createFromConfig } from './helper.js'

test(
  'automatically apply reuse port if isProduction is in the context',
  { skip: !features.node.reusePort },
  async t => {
    const app1 = await createFromConfig(
      t,
      buildConfig({
        server: {
          hostname: '127.0.0.1',
          port: 8787,
          logger: { level: 'fatal' }
        }
      }),
      null,
      {
        production: true,
        config: {
          reuseTcpPorts: true
        }
      }
    )

    const app2 = await createFromConfig(
      t,
      buildConfig({
        server: {
          hostname: '127.0.0.1',
          port: 8787,
          logger: { level: 'fatal' }
        }
      }),
      null,
      {
        production: true,
        config: {
          reuseTcpPorts: true
        }
      }
    )

    t.after(async () => {
      await app1.stop()
      await app2.stop()
    })

    await app1.start({ listen: true })
    await app2.start({ listen: true })

    const res = await request(`${app1.url}/`)
    assert.strictEqual(res.statusCode, 200)
    const body = await res.body.json()
    assert.deepStrictEqual(body, { message: 'Welcome to Platformatic! Please visit https://docs.platformatic.dev' })
  }
)
