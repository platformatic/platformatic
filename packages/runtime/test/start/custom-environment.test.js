import { createDirectory } from '@platformatic/foundation'
import { deepStrictEqual, strictEqual } from 'node:assert'
import { cp, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, relative } from 'node:path'
import { test } from 'node:test'
import { request } from 'undici'
import { create, loadConfiguration, Runtime } from '../../index.js'
import { createRuntime, createTemporaryDirectory, updateConfigFile } from '../helpers.js'

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
    config.server.port = 0
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
    config.server.port = 0
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

// The application of this fixture answers with the value its configuration resolved for {PLT_ENV_FILE_VALUE}
// and with the value of that variable in its environment. Each copy gets a .env file at its root, above the
// application: loaded without an env file, the configuration of the application finds it by looking upwards.
async function prepareEnvFileApplications (t, files = {}) {
  const root = await createTemporaryDirectory(t, 'env-file-applications')
  await cp(join(fixturesDir, 'env-file-applications'), root, { recursive: true })
  await createDirectory(join(root, 'node_modules/@platformatic'))
  await symlink(join(import.meta.dirname, '../../../service'), join(root, 'node_modules/@platformatic/service'), 'dir')

  await writeFile(join(root, '.env'), 'PLT_ENV_FILE_VALUE=from-root-env', 'utf8')
  await writeFile(join(root, 'empty.env'), '', 'utf8')
  await writeFile(join(root, 'given.env'), 'PLT_ENV_FILE_VALUE=from-given-env', 'utf8')

  for (const [file, contents] of Object.entries(files)) {
    await createDirectory(dirname(join(root, file)))
    await writeFile(join(root, file), contents, 'utf8')
  }

  // The variables must only come from the files above, so the ones of the test process are removed and restored
  for (const key of ['PLT_ENV_FILE_VALUE', 'PLT_ENV_FILE_SUFFIX']) {
    const original = process.env[key]
    delete process.env[key]

    t.after(() => {
      if (typeof original === 'string') {
        process.env[key] = original
      }
    })
  }

  return root
}

async function getEnvFileValue (t, app, id = 'echo') {
  t.after(async () => {
    await app.close()
  })

  await app.start()
  return injectEnvFileValue(app, id)
}

async function injectEnvFileValue (app, id) {
  const { statusCode, payload } = await app.inject(id, { method: 'GET', url: '/' })
  strictEqual(statusCode, 200)
  return JSON.parse(payload)
}

// Moves the configuration of the application to services/echo/config/watt.json
async function moveApplicationConfigurationToSubfolder (root) {
  const config = JSON.parse(await readFile(join(root, 'services/echo/watt.json'), 'utf8'))
  config.plugins.paths[0].path = '../plugin.js'

  await createDirectory(join(root, 'services/echo/config'))
  await writeFile(join(root, 'services/echo/config/watt.json'), JSON.stringify(config, null, 2), 'utf8')
  await rm(join(root, 'services/echo/watt.json'))

  await updateConfigFile(join(root, 'watt.json'), config => {
    config.applications[0].config = 'config/watt.json'
  })
}

test('should load the configuration of an application with the env file of the runtime', async t => {
  const root = await prepareEnvFileApplications(t)
  const app = await createRuntime(root, null, { envFile: join(root, 'empty.env') })

  deepStrictEqual(await getEnvFileValue(t, app), { configuration: '', environment: null })
})

test('should load the configuration of an application with a relative env file of the runtime', async t => {
  const root = await prepareEnvFileApplications(t)
  const app = await createRuntime(root, null, { envFile: 'empty.env' })

  deepStrictEqual(await getEnvFileValue(t, app), { configuration: '', environment: null })
})

test('should resolve the configuration of an application from the values of the env file of the runtime', async t => {
  const root = await prepareEnvFileApplications(t)
  const app = await createRuntime(root, null, { envFile: join(root, 'given.env') })

  deepStrictEqual(await getEnvFileValue(t, app), { configuration: 'from-given-env', environment: 'from-given-env' })
})

test('should load the configuration of an application with a discovered .env file when the runtime has no env file', async t => {
  // The value is only in a .env file between the runtime root and the application: the runtime does not read it
  // and neither does the worker, so only the search of the configuration of the application can find it.
  const root = await prepareEnvFileApplications(t, {
    '.env': '',
    'services/.env': 'PLT_ENV_FILE_VALUE=from-services-env'
  })
  const app = await createRuntime(root)

  deepStrictEqual(await getEnvFileValue(t, app), { configuration: 'from-services-env', environment: null })
})

test('should prefer the envfile of an application over the env file of the runtime', async t => {
  const root = await prepareEnvFileApplications(t, {
    'services/echo/application.env': 'PLT_ENV_FILE_VALUE=from-application-envfile'
  })
  await updateConfigFile(join(root, 'watt.json'), config => {
    config.applications[0].envfile = 'services/echo/application.env'
  })

  const app = await createRuntime(root, null, { envFile: join(root, 'given.env') })

  deepStrictEqual(await getEnvFileValue(t, app), {
    configuration: 'from-application-envfile',
    environment: 'from-application-envfile'
  })
})

test('should prefer the .env file in the folder of an application over the env file of the runtime', async t => {
  const root = await prepareEnvFileApplications(t, {
    'services/echo/.env': 'PLT_ENV_FILE_VALUE=from-application-dotenv'
  })

  const app = await createRuntime(root, null, { envFile: join(root, 'given.env') })

  deepStrictEqual(await getEnvFileValue(t, app), {
    configuration: 'from-application-dotenv',
    environment: 'from-application-dotenv'
  })
})

test('should not read the .env file in the folder of an application which declares an envfile', async t => {
  // The worker gives such an application the variables of its envfile only, never the ones of the .env file
  // next to it: its configuration must not take a value from that .env file either.
  const root = await prepareEnvFileApplications(t, {
    'services/echo/application.env': '',
    'services/echo/.env': 'PLT_ENV_FILE_VALUE=from-application-dotenv'
  })
  await updateConfigFile(join(root, 'watt.json'), config => {
    config.applications[0].envfile = 'services/echo/application.env'
  })

  const app = await createRuntime(root, null, { envFile: join(root, 'empty.env') })

  deepStrictEqual(await getEnvFileValue(t, app), { configuration: '', environment: null })
})

test('should not read the .env file next to the configuration of an application in a subfolder', async t => {
  // The search starts from the folder of the configuration file, while the worker reads the .env file of the
  // application folder: a .env file next to config/watt.json only ever reached the configuration.
  const root = await prepareEnvFileApplications(t, {
    'services/echo/config/.env': 'PLT_ENV_FILE_VALUE=from-config-dotenv'
  })
  await moveApplicationConfigurationToSubfolder(root)

  const app = await createRuntime(root, null, { envFile: join(root, 'empty.env') })

  deepStrictEqual(await getEnvFileValue(t, app), { configuration: '', environment: null })
})

test('should read the .env file next to the configuration of an application in a subfolder when the runtime has no env file', async t => {
  // The .env file of the root is emptied: the runtime would read it and put its value in the worker environment,
  // which wins over any file, so only the .env file next to config/watt.json can provide the value.
  const root = await prepareEnvFileApplications(t, {
    '.env': '',
    'services/echo/config/.env': 'PLT_ENV_FILE_VALUE=from-config-dotenv'
  })
  await moveApplicationConfigurationToSubfolder(root)

  const app = await createRuntime(root)

  deepStrictEqual(await getEnvFileValue(t, app), { configuration: 'from-config-dotenv', environment: null })
})

test('should select the capability of an application with the env file of the runtime', async t => {
  // The first load of the configuration of the application only yields its module, but a placeholder in $schema
  // changes which module that is: a .env file found above the application would select a package that does not exist.
  const root = await prepareEnvFileApplications(t, {
    'services/.env': 'PLT_ENV_FILE_SUFFIX=-from-services-env'
  })
  await updateConfigFile(join(root, 'services/echo/watt.json'), config => {
    config.$schema = 'https://schemas.platformatic.dev/@platformatic/service{PLT_ENV_FILE_SUFFIX}/3.0.0.json'
  })

  const app = await createRuntime(root, null, { envFile: join(root, 'given.env') })

  deepStrictEqual(await getEnvFileValue(t, app), { configuration: 'from-given-env', environment: 'from-given-env' })
})

test('should load the configuration of an application with the envfile of the runtime configuration file', async t => {
  const root = await prepareEnvFileApplications(t)
  await updateConfigFile(join(root, 'watt.json'), config => {
    config.envfile = 'empty.env'
  })

  // create is invoked without any context at all
  const app = await create(root)

  deepStrictEqual(await getEnvFileValue(t, app), { configuration: '', environment: null })
})

test('should load the configuration of an application with the envfile of a runtime configuration loaded apart from the runtime', async t => {
  const root = await prepareEnvFileApplications(t)
  await updateConfigFile(join(root, 'watt.json'), config => {
    config.envfile = 'empty.env'
  })

  const config = await loadConfiguration(root)
  const app = new Runtime(config)

  deepStrictEqual(await getEnvFileValue(t, app), { configuration: '', environment: null })
})

test('should load the configuration of an application with the env file of a runtime configuration loaded apart from the runtime', async t => {
  const root = await prepareEnvFileApplications(t)

  const config = await loadConfiguration(root, null, { envFile: 'empty.env' })
  const app = new Runtime(config)

  deepStrictEqual(await getEnvFileValue(t, app), { configuration: '', environment: null })
})

test('should load the configuration of an application with the env file of the runtime when its root is relative', async t => {
  const root = await prepareEnvFileApplications(t)
  const config = JSON.parse(await readFile(join(root, 'watt.json'), 'utf8'))
  const app = await createRuntime(relative(process.cwd(), root), config, { envFile: 'empty.env' })

  deepStrictEqual(await getEnvFileValue(t, app), { configuration: '', environment: null })
})

test('should load the configuration of a single application with the env file of the runtime', async t => {
  const root = await prepareEnvFileApplications(t)
  const app = await createRuntime(join(root, 'services/echo'), null, { envFile: join(root, 'empty.env') })

  deepStrictEqual(await getEnvFileValue(t, app, 'main'), { configuration: '', environment: null })
})

test('should restart an application after the env file of the runtime is removed', async t => {
  const root = await prepareEnvFileApplications(t)
  const app = await createRuntime(root, null, { envFile: join(root, 'empty.env') })

  deepStrictEqual(await getEnvFileValue(t, app), { configuration: '', environment: null })

  // The new worker must neither need the file again nor fall back to the .env file of the root
  await rm(join(root, 'empty.env'))
  await app.restartApplication('echo')

  deepStrictEqual(await injectEnvFileValue(app, 'echo'), { configuration: '', environment: null })
})

test('should restart an application with the values of the env file of the runtime after the file is removed', async t => {
  const root = await prepareEnvFileApplications(t)
  const app = await createRuntime(root, null, { envFile: join(root, 'given.env') })

  deepStrictEqual(await getEnvFileValue(t, app), { configuration: 'from-given-env', environment: 'from-given-env' })

  // The new worker must neither need the file again nor fall back to the .env file of the root
  await rm(join(root, 'given.env'))
  await app.restartApplication('echo')

  deepStrictEqual(await injectEnvFileValue(app, 'echo'), {
    configuration: 'from-given-env',
    environment: 'from-given-env'
  })
})
