import { deepStrictEqual, strictEqual } from 'node:assert'
import { join } from 'node:path'
import { test } from 'node:test'
import { request } from 'undici'
import { createRuntime } from '../helpers.js'

const fixturesDir = join(import.meta.dirname, '..', '..', 'fixtures')

test('can start with a custom environment', async t => {
  const configFile = join(fixturesDir, 'configs', 'monorepo.json')
  const app = await createRuntime(configFile, null, { env: { A_CUSTOM_ENV_VAR: 'foobar' }, ignoreProcessEnv: true })

  t.after(async () => {
    await app.close()
  })

  const entryUrl = await app.start()
  const res = await request(entryUrl + '/env')

  strictEqual(res.statusCode, 200)
  deepStrictEqual(await res.body.json(), {
    A_CUSTOM_ENV_VAR: 'foobar',
    PLT_ENVIRONMENT: 'development',
    PLT_DEV: 'true',
    PLT_ROOT: join(fixturesDir, 'configs')
  })
  process.exitCode = 0
})

test('should pass global .env data to workers', async t => {
  const configFile = join(fixturesDir, 'env', 'platformatic.json')
  const app = await createRuntime(configFile)

  t.after(async () => {
    await app.close()
  })

  await app.start()

  const { payload } = await app.inject('hello', {
    method: 'GET',
    url: '/'
  })
  const data = JSON.parse(payload)

  deepStrictEqual(data, {
    FROM_ENV_FILE: 'true',
    FROM_MAIN_CONFIG_FILE: 'true',
    FROM_SERVICE_CONFIG_FILE: 'true',
    OVERRIDE_TEST: 'service-override'
  })
})

test('should load custom env file when envFile option is provided', async t => {
  const { mkdtemp, writeFile, rm } = await import('node:fs/promises')
  const { tmpdir } = await import('node:os')

  const tmpDir = await mkdtemp(join(tmpdir(), 'plt-test-'))
  const customEnvFile = join(tmpDir, 'custom.env')

  // Set the FROM_ENV_FILE to a custom value to verify it's loaded from custom.env, not .env
  await writeFile(customEnvFile, 'FROM_ENV_FILE=from_custom_file', 'utf8')

  const configFile = join(fixturesDir, 'env', 'platformatic.json')
  const app = await createRuntime(configFile, null, { envFile: customEnvFile, ignoreProcessEnv: true })

  t.after(async () => {
    await app.close()
    await rm(tmpDir, { recursive: true, force: true })
  })

  await app.start()

  const { payload } = await app.inject('hello', {
    method: 'GET',
    url: '/'
  })
  const data = JSON.parse(payload)

  // Should have custom env file var instead of default .env var
  strictEqual(data.FROM_ENV_FILE, 'from_custom_file') // Custom value, not 'true' from default .env
  strictEqual(data.FROM_MAIN_CONFIG_FILE, 'true')
  strictEqual(data.FROM_SERVICE_CONFIG_FILE, 'true')
  strictEqual(data.OVERRIDE_TEST, 'service-override')
})
