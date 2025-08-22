import { deepStrictEqual, strictEqual } from 'node:assert'
import { join } from 'node:path'
import { test } from 'node:test'
import { request } from 'undici'
import { loadConfiguration, Runtime, transform } from '../../index.js'
import { getTempDir } from '../helpers.js'

const fixturesDir = join(import.meta.dirname, '..', '..', 'fixtures')

test('can start applications programmatically from object', async t => {
  const root = await getTempDir()
  const configFile = join(fixturesDir, 'configs', 'monorepo.json')
  const config = await loadConfiguration(configFile, null, {
    async transform (config, ...args) {
      config = await transform(config, ...args)

      config.logger ??= {}
      config.logger.transport ??= {
        target: 'pino/file',
        options: { destination: join(root, 'logs.txt') }
      }

      return config
    }
  })
  const app = new Runtime(config)

  const entryUrl = await app.start()

  t.after(async () => {
    process.exitCode = 0
    await app.close()
  })

  const res = await request(entryUrl)

  strictEqual(res.statusCode, 200)
  deepStrictEqual(await res.body.json(), { hello: 'hello123' })
})
