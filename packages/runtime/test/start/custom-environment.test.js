import { createDirectory } from '@platformatic/foundation'
import { deepStrictEqual, strictEqual } from 'node:assert'
import { cp, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { request } from 'undici'
import { create } from '../../index.js'
import { createRuntime, createTemporaryDirectory, updateConfigFile } from '../helpers.js'

const fixturesDir = join(import.meta.dirname, '..', '..', 'fixtures')

test('can start with a custom environment', async t => {
  const configFile = join(fixturesDir, 'configs', 'monorepo.json')
  const app = await createRuntime(configFile, null, { env: { A_CUSTOM_ENV_VAR: 'foobar' }, ignoreProcessEnv: true })

  t.after(async () => {
    await app.close()
  })

  const { 'serviceApp:0': url } = await app.start()
  const res = await request(url + '/env')

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

test('should load custom env file when envfile is configured on the runtime configuration file', async t => {
  const root = await createTemporaryDirectory(t, 'custom-env')
  await cp(join(fixturesDir, 'env'), root, { recursive: true })
  await createDirectory(join(root, 'node_modules/@platformatic'))
  await symlink(join(import.meta.dirname, '../../../node'), join(root, 'node_modules/@platformatic/node'), 'dir')

  const envFile = join(root, 'custom.env')
  await updateConfigFile(join(root, 'platformatic.json'), config => {
    config.envfile = envFile
  })

  await writeFile(envFile, 'FROM_ENV_FILE=custom', 'utf8')

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

  strictEqual(data.FROM_ENV_FILE, 'custom')
})

test('should prefer the config envfile over the envFile option', async t => {
  const root = await createTemporaryDirectory(t, 'custom-env')
  await cp(join(fixturesDir, 'env'), root, { recursive: true })
  await createDirectory(join(root, 'node_modules/@platformatic'))
  await symlink(join(import.meta.dirname, '../../../node'), join(root, 'node_modules/@platformatic/node'), 'dir')

  const envFile = join(root, 'custom.env')
  const overrideEnvFile = join(root, 'override.env')
  await updateConfigFile(join(root, 'platformatic.json'), config => {
    config.envfile = envFile
  })

  await writeFile(envFile, 'FROM_ENV_FILE=custom', 'utf8')
  await writeFile(overrideEnvFile, 'FROM_ENV_FILE=override', 'utf8')

  const app = await createRuntime(root, null, { envFile: overrideEnvFile, ignoreProcessEnv: true })

  t.after(async () => {
    await app.close()
  })

  await app.start()

  const { payload } = await app.inject('hello', {
    method: 'GET',
    url: '/'
  })
  const data = JSON.parse(payload)

  strictEqual(data.FROM_ENV_FILE, 'custom')
})

test('should prefer the envfile of an application over a discovered .env file', async t => {
  const root = await createTemporaryDirectory(t, 'custom-env')
  await cp(join(fixturesDir, 'env'), root, { recursive: true })
  await createDirectory(join(root, 'node_modules/@platformatic'))
  await symlink(join(import.meta.dirname, '../../../node'), join(root, 'node_modules/@platformatic/node'), 'dir')

  // The .env file of the runtime already defines FROM_ENV_FILE
  await writeFile(join(root, 'services/hello/custom.env'), 'FROM_ENV_FILE=application-envfile', 'utf8')
  await updateConfigFile(join(root, 'platformatic.json'), config => {
    config.server.port = 0
    config.services[0].envfile = 'services/hello/custom.env'
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
  await updateConfigFile(join(root, 'platformatic.json'), config => {
    config.server.port = 0
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

  strictEqual(data.FROM_ENV_FILE, 'application-env-file')
})

test('should prefer the .env file of an application over the envfile of the runtime', async t => {
  const root = await createTemporaryDirectory(t, 'custom-env')
  await cp(join(fixturesDir, 'env'), root, { recursive: true })
  await createDirectory(join(root, 'node_modules/@platformatic'))
  await symlink(join(import.meta.dirname, '../../../node'), join(root, 'node_modules/@platformatic/node'), 'dir')

  await writeFile(join(root, 'custom.env'), 'FROM_ENV_FILE=runtime-envfile', 'utf8')
  await writeFile(join(root, 'services/hello/.env'), 'FROM_ENV_FILE=application-env-file', 'utf8')
  await updateConfigFile(join(root, 'platformatic.json'), config => {
    config.server.port = 0
    config.envfile = 'custom.env'
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

  strictEqual(data.FROM_ENV_FILE, 'application-env-file')
})

test('should prefer real environment variables over the .env file of an application', async t => {
  const root = await createTemporaryDirectory(t, 'custom-env')
  await cp(join(fixturesDir, 'env'), root, { recursive: true })
  await createDirectory(join(root, 'node_modules/@platformatic'))
  await symlink(join(import.meta.dirname, '../../../node'), join(root, 'node_modules/@platformatic/node'), 'dir')

  await writeFile(join(root, 'services/hello/.env'), 'FROM_ENV_FILE=application-env-file', 'utf8')
  await updateConfigFile(join(root, 'platformatic.json'), config => {
    config.server.port = 0
  })

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

test('should not require a context when the configuration file defines envfile', async t => {
  const root = await createTemporaryDirectory(t, 'custom-env')
  await cp(join(fixturesDir, 'env'), root, { recursive: true })
  await createDirectory(join(root, 'node_modules/@platformatic'))
  await symlink(join(import.meta.dirname, '../../../node'), join(root, 'node_modules/@platformatic/node'), 'dir')

  const envFile = join(root, 'custom.env')
  await updateConfigFile(join(root, 'platformatic.json'), config => {
    config.server.port = 0
    config.envfile = envFile
    config.logger = { level: 'fatal' }
  })

  await writeFile(envFile, 'FROM_ENV_FILE=custom', 'utf8')

  // create is invoked without any context at all
  const app = await create(root)

  t.after(async () => {
    await app.close()
  })

  await app.start()

  const { payload } = await app.inject('hello', {
    method: 'GET',
    url: '/'
  })
  const data = JSON.parse(payload)

  strictEqual(data.FROM_ENV_FILE, 'custom')
})
