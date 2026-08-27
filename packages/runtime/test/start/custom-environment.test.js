import { createDirectory } from '@platformatic/foundation'
import { deepStrictEqual, rejects, strictEqual } from 'node:assert'
import { cp, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { request } from 'undici'
import { configurationFileIn, createRuntime, createTemporaryDirectory, updateConfigFile } from '../helpers.js'

const fixturesDir = join(import.meta.dirname, '..', '..', 'fixtures')

test('can start with a custom environment', async t => {
  const configFile = join(fixturesDir, 'configs', 'monorepo', 'watt.config.mjs')
  const app = await createRuntime(configFile, null, { env: { A_CUSTOM_ENV_VAR: 'foobar' }, ignoreProcessEnv: true })

  t.after(async () => {
    await app.close()
  })

  const { 'serviceApp:0': url } = await app.start()
  const res = await request(url + '/env')

  strictEqual(res.statusCode, 200)

  /*
    ignoreProcessEnv closes the environment, so what a worker sees is what the runtime put there:
    the caller's variable and one PLT_<ID>_URL per application, its own included. v3's PLT_DEV,
    PLT_ENVIRONMENT and PLT_ROOT are removed in v4 -- an application branches on its own variables,
    or the decision moves into configuration where the typed context is.
  */
  deepStrictEqual(await res.body.json(), {
    A_CUSTOM_ENV_VAR: 'foobar',
    PLT_SERVICEAPP_URL: 'http://serviceApp.plt.local',
    PLT_WITH_LOGGER_URL: 'http://with-logger.plt.local',
    PLT_MULTI_PLUGIN_SERVICE_URL: 'http://multi-plugin-service.plt.local',
    PLT_DB_APP_URL: 'http://db-app.plt.local'
  })
  process.exitCode = 0
})

test('should pass global .env data to workers', async t => {
  const configFile = join(fixturesDir, 'env', 'watt.config.mjs')
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
  const tmpDir = await mkdtemp(join(tmpdir(), 'plt-test-'))
  const customEnvFile = join(tmpDir, 'custom.env')

  // Set the FROM_ENV_FILE to a custom value to verify it's loaded from custom.env, not .env
  await writeFile(customEnvFile, 'FROM_ENV_FILE=from_custom_file', 'utf8')

  const configFile = join(fixturesDir, 'env', 'watt.config.mjs')
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

test('should prefer the envfile of an application over a discovered .env file', async t => {
  const root = await createTemporaryDirectory(t, 'custom-env')
  await cp(join(fixturesDir, 'env'), root, { recursive: true })
  await createDirectory(join(root, 'node_modules/@platformatic'))
  await symlink(join(import.meta.dirname, '../../../node'), join(root, 'node_modules/@platformatic/node'), 'dir')

  // The .env file of the runtime already defines FROM_ENV_FILE. The path is app-relative in
  // v4; v3 resolved it against the runtime root.
  await writeFile(join(root, 'services/hello/custom.env'), 'FROM_ENV_FILE=application-envfile', 'utf8')
  await updateConfigFile(configurationFileIn(root), config => {
    config.applications[0].envfile = 'custom.env'
  })

  const app = await createRuntime(root)

  t.after(async () => {
    await app.close()
  })

  await app.start()

  const { payload } = await app.inject('hello', {
    method: 'GET',
    url: '/'
  })
  const data = JSON.parse(payload)

  strictEqual(data.FROM_ENV_FILE, 'application-envfile')
})

test('should prefer the .env file of an application over a discovered .env file', async t => {
  const root = await createTemporaryDirectory(t, 'custom-env')
  await cp(join(fixturesDir, 'env'), root, { recursive: true })
  await createDirectory(join(root, 'node_modules/@platformatic'))
  await symlink(join(import.meta.dirname, '../../../node'), join(root, 'node_modules/@platformatic/node'), 'dir')

  // The .env file of the runtime already defines FROM_ENV_FILE
  await writeFile(join(root, 'services/hello/.env'), 'FROM_ENV_FILE=application-env-file', 'utf8')
  const app = await createRuntime(root)

  t.after(async () => {
    await app.close()
  })

  await app.start()

  const { payload } = await app.inject('hello', {
    method: 'GET',
    url: '/'
  })
  const data = JSON.parse(payload)

  strictEqual(data.FROM_ENV_FILE, 'application-env-file')
})

test('should prefer real environment variables over the .env file of an application', async t => {
  const root = await createTemporaryDirectory(t, 'custom-env')
  await cp(join(fixturesDir, 'env'), root, { recursive: true })
  await createDirectory(join(root, 'node_modules/@platformatic'))
  await symlink(join(import.meta.dirname, '../../../node'), join(root, 'node_modules/@platformatic/node'), 'dir')

  await writeFile(join(root, 'services/hello/.env'), 'FROM_ENV_FILE=application-env-file', 'utf8')
  process.env.FROM_ENV_FILE = 'process-env'

  const app = await createRuntime(root)

  t.after(async () => {
    delete process.env.FROM_ENV_FILE
    await app.close()
  })

  await app.start()

  const { payload } = await app.inject('hello', {
    method: 'GET',
    url: '/'
  })
  const data = JSON.parse(payload)

  strictEqual(data.FROM_ENV_FILE, 'process-env')
})

test('refuses a root envfile, which v4 does not implement', async t => {
  const root = await createTemporaryDirectory(t, 'custom-env')
  await cp(join(fixturesDir, 'env'), root, { recursive: true })

  await updateConfigFile(configurationFileIn(root), config => {
    config.envfile = 'custom.env'
  })

  /*
    Accepting the key and ignoring it is what v3 validation would have done here, and it is the one
    outcome a project migrating cannot detect: the file simply never loads. An entry may still
    declare an envfile -- it is only the root-level key that is gone.
  */
  await rejects(() => createRuntime(root), /must NOT have the additional property 'envfile'/)
})
