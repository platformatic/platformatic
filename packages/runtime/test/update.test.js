import { createDirectory, createEnvFileTool } from '@platformatic/foundation'
import { Generator as ServiceGenerator } from '@platformatic/service'
import assert from 'node:assert'
import { cp, readFile, stat, symlink, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import test, { after } from 'node:test'
import { MockAgent, setGlobalDispatcher } from 'undici'
import { RuntimeGenerator } from '../lib/generator.js'
import { moveToTmpdir } from './helpers.js'

const mockAgent = new MockAgent()
setGlobalDispatcher(mockAgent)
mockAgent.disableNetConnect()

async function setupTemporaryDirectory (fixture) {
  const dir = await moveToTmpdir(after)

  await cp(fixture, dir, { recursive: true })
  await createDirectory(resolve(dir, 'node_modules/@platformatic'))
  await symlink(resolve(import.meta.dirname, '../../service'), join(dir, 'node_modules/@platformatic/service'), 'dir')
  await symlink(resolve(import.meta.dirname, '../../db'), join(dir, 'node_modules/@platformatic/db'), 'dir')

  return dir
}

function mockNpmJsRequestForPkgs (pkgs) {
  for (const pkg of pkgs) {
    mockAgent
      .get('https://registry.npmjs.org')
      .intercept({
        method: 'GET',
        path: `/${pkg}`
      })
      .reply(200, {
        'dist-tags': {
          latest: '1.42.0'
        }
      })
  }
}

test('should remove an application', async t => {
  const fixture = join(import.meta.dirname, '..', 'fixtures', 'sample-runtime-with-2-services')
  const dir = await setupTemporaryDirectory(fixture)

  const rg = new RuntimeGenerator({ targetDirectory: dir, applicationsFolder: 'services' })
  await rg.loadFromDir(dir)
  assert.equal(rg.applications.length, 2)
  assert.equal(rg.applications[0].name, 'foobar')
  assert.equal(rg.applications[1].name, 'rival')
  const updatedFoobar = {
    name: 'foobar',
    template: '@platformatic/service',
    fields: [],
    plugins: []
  }
  await rg.update({
    applications: [updatedFoobar] // the original application was removed
  })
  // the runtime .env should be updated
  const runtimeDotEnv = createEnvFileTool({
    path: join(dir, '.env')
  })

  await runtimeDotEnv.load()

  // no env values related to 'rival' application are in the env file anymore
  runtimeDotEnv.getKeys().forEach(k => assert.ok(!k.startsWith('PLT_RIVAL')))

  // the other plugin values should be there
  assert.equal(runtimeDotEnv.getValue('PLT_FOOBAR_TYPESCRIPT'), 'true')
  // the only dependency has been removed
  const runtimePackageJson = JSON.parse(await readFile(join(dir, 'package.json'), 'utf-8'))
  assert.ok(!runtimePackageJson.dependencies['@fastify/oauth2'])

  // the directory has been deleted
  try {
    await stat(join(dir, 'services', 'rival'))
    assert.fail()
  } catch (err) {
    assert.equal(err.code, 'ENOENT')
  }
})

test('should add a new application with new env variables', async t => {
  mockNpmJsRequestForPkgs(['@fastify/oauth2', '@fastify/foo-plugin'])

  const fixture = join(import.meta.dirname, '..', 'fixtures', 'sample-runtime')
  const dir = await setupTemporaryDirectory(fixture)

  const rg = new RuntimeGenerator({ targetDirectory: dir, applicationsFolder: 'services' })
  await rg.loadFromDir(dir)
  assert.equal(rg.applications.length, 1)
  assert.equal(rg.applications[0].name, 'rival')
  const sg = new ServiceGenerator()
  const applicationData = await sg.loadFromDir('rival', dir)

  const newApplication = {
    name: 'foobar',
    template: '@platformatic/service',
    fields: [],
    plugins: [
      {
        name: '@fastify/foo-plugin',
        options: [
          {
            name: 'FST_PLUGIN_FOO_TEST_VALUE',
            path: 'testValue',
            type: 'string',
            value: 'foobar'
          },
          {
            name: 'FST_PLUGIN_FOO_CREDENTIALS_NAME',
            path: 'credentials.name',
            type: 'string',
            value: 'johndoe'
          }
        ]
      }
    ]
  }
  await rg.update({
    applications: [applicationData, newApplication], // the original application was removed
    entrypoint: 'foobar' // update the entrypoint with the new application
  })

  // the new application has been generated
  const applicationConfigFile = JSON.parse(
    await readFile(join(dir, 'services', 'foobar', 'platformatic.json'), 'utf-8')
  )
  assert.deepEqual(applicationConfigFile.plugins.packages[0], {
    name: '@fastify/foo-plugin',
    options: {
      testValue: '{PLT_FOOBAR_FST_PLUGIN_FOO_TEST_VALUE}',
      credentials: {
        name: '{PLT_FOOBAR_FST_PLUGIN_FOO_CREDENTIALS_NAME}'
      }
    }
  })
  // the runtime .env should be updated
  const runtimeDotEnv = createEnvFileTool({
    path: join(dir, '.env')
  })

  await runtimeDotEnv.load()

  assert.equal(runtimeDotEnv.getValue('PLT_FOOBAR_FST_PLUGIN_FOO_TEST_VALUE'), 'foobar')
  assert.equal(runtimeDotEnv.getValue('PLT_FOOBAR_FST_PLUGIN_FOO_CREDENTIALS_NAME'), 'johndoe')

  const runtimePackageJson = JSON.parse(await readFile(join(dir, 'package.json'), 'utf-8'))
  assert.ok(runtimePackageJson.dependencies['@fastify/oauth2'])
  assert.ok(runtimePackageJson.dependencies['@fastify/foo-plugin'])

  // the entrypoint should be updated
  assert.equal(rg.entryPoint.name, 'foobar')

  const runtimePlatformaticJson = JSON.parse(await readFile(join(dir, 'platformatic.json'), 'utf-8'))
  assert.equal(runtimePlatformaticJson.entrypoint, 'foobar')
})

test("should update existing application's plugin options", async t => {
  mockNpmJsRequestForPkgs(['@fastify/oauth2'])

  const fixture = join(import.meta.dirname, '..', 'fixtures', 'sample-runtime')
  const dir = await setupTemporaryDirectory(fixture)

  const rg = new RuntimeGenerator({ targetDirectory: dir, applicationsFolder: 'services' })
  await rg.loadFromDir(dir)
  const oldApplicationConfigFile = JSON.parse(
    await readFile(join(dir, 'services', 'rival', 'platformatic.json'), 'utf-8')
  )
  // load previous application config file
  const updatedApplication = {
    name: 'rival',
    template: '@platformatic/service',
    fields: [],
    plugins: [
      {
        name: '@fastify/oauth2',
        options: [
          {
            name: 'FST_PLUGIN_OAUTH2_NAME',
            path: 'name',
            type: 'string',
            value: 'new_oauth2_name'
          },
          {
            name: 'FST_PLUGIN_OAUTH2_CREDENTIALS_CLIENT_ID',
            path: 'credentials.client.id',
            type: 'string',
            value: 'sample_client_id_updated'
          },
          {
            name: 'FST_PLUGIN_OAUTH2_CREDENTIALS_CLIENT_SECRET',
            path: 'credentials.client.secret',
            type: 'string',
            value: 'sample_client_secret_updated'
          },
          {
            name: 'FST_PLUGIN_OAUTH2_REDIRECT_PATH',
            path: 'startRedirectPath',
            type: 'string',
            value: '/login/google'
          },
          {
            name: 'FST_PLUGIN_OAUTH2_CALLBACK_URI',
            path: 'callbackUri',
            type: 'string',
            value: 'http://localhost:3000/login/google/callback'
          }
        ]
      }
    ]
  }
  await rg.update({
    applications: [updatedApplication] // the original application was removed
  })

  // the config file should be left unchanged
  const newApplicationConfigFile = JSON.parse(
    await readFile(join(dir, 'services', 'rival', 'platformatic.json'), 'utf-8')
  )
  assert.deepEqual(oldApplicationConfigFile, newApplicationConfigFile)

  // the runtime .env should be updated
  const runtimeDotEnv = createEnvFileTool({
    path: join(dir, '.env')
  })

  await runtimeDotEnv.load()

  assert.equal(runtimeDotEnv.getValue('PLT_RIVAL_FST_PLUGIN_OAUTH2_NAME'), 'new_oauth2_name')
  assert.equal(runtimeDotEnv.getValue('PLT_RIVAL_FST_PLUGIN_OAUTH2_CREDENTIALS_CLIENT_ID'), 'sample_client_id_updated')
  assert.equal(
    runtimeDotEnv.getValue('PLT_RIVAL_FST_PLUGIN_OAUTH2_CREDENTIALS_CLIENT_SECRET'),
    'sample_client_secret_updated'
  )
  assert.equal(runtimeDotEnv.getValue('PLT_RIVAL_FST_PLUGIN_OAUTH2_REDIRECT_PATH'), '/login/google')
  assert.equal(
    runtimeDotEnv.getValue('PLT_RIVAL_FST_PLUGIN_OAUTH2_CALLBACK_URI'),
    'http://localhost:3000/login/google/callback'
  )
})

test("should add new application's plugin and options", async t => {
  mockNpmJsRequestForPkgs(['@fastify/passport', '@fastify/oauth2'])

  const fixture = join(import.meta.dirname, '..', 'fixtures', 'sample-runtime')
  const dir = await setupTemporaryDirectory(fixture)

  const rg = new RuntimeGenerator({ targetDirectory: dir, applicationsFolder: 'services' })
  // create a sample file that will be checked after
  const sampleRouteFilePath = join(dir, 'services', 'rival', 'routes', 'sample.js')
  const samplerouteFileContents = "console.log('hello world')"
  await writeFile(sampleRouteFilePath, samplerouteFileContents)
  await rg.loadFromDir(dir)
  const oldApplicationConfigFile = JSON.parse(
    await readFile(join(dir, 'services', 'rival', 'platformatic.json'), 'utf-8')
  )
  // load previous application config file
  const updatedApplication = {
    name: 'rival',
    template: '@platformatic/service',
    fields: [],
    plugins: [
      {
        name: '@fastify/passport',
        options: [
          {
            name: 'FST_PLUGIN_PASSPORT_COUNTRY',
            path: 'country',
            type: 'string',
            value: 'italy'
          }
        ]
      },
      {
        name: '@fastify/oauth2',
        options: [
          {
            name: 'FST_PLUGIN_OAUTH2_NEW_OPTION',
            path: 'new.option',
            type: 'string',
            value: 'new_options_value'
          },
          {
            name: 'FST_PLUGIN_OAUTH2_NAME',
            path: 'name',
            type: 'string',
            value: 'new_oauth2_name'
          },
          {
            name: 'FST_PLUGIN_OAUTH2_CREDENTIALS_CLIENT_ID',
            path: 'credentials.client.id',
            type: 'string',
            value: 'sample_client_id_updated'
          },
          {
            name: 'FST_PLUGIN_OAUTH2_CREDENTIALS_CLIENT_SECRET',
            path: 'credentials.client.secret',
            type: 'string',
            value: 'sample_client_secret_updated'
          },
          {
            name: 'FST_PLUGIN_OAUTH2_REDIRECT_PATH',
            path: 'startRedirectPath',
            type: 'string',
            value: '/login/google'
          },
          {
            name: 'FST_PLUGIN_OAUTH2_CALLBACK_URI',
            path: 'callbackUri',
            type: 'string',
            value: 'http://localhost:3000/login/google/callback'
          }
        ]
      }
    ]
  }
  await rg.update({
    applications: [updatedApplication] // the original application was removed
  })

  // the config file should be updated with the new plugin
  const newApplicationConfigFile = JSON.parse(
    await readFile(join(dir, 'services', 'rival', 'platformatic.json'), 'utf-8')
  )
  assert.notDeepEqual(oldApplicationConfigFile, newApplicationConfigFile)
  // all properties except "packages" should be the same
  const equalRootProperties = ['$schema', 'application', 'watch']
  const equalPluginsProperties = ['paths']
  for (const prop in equalRootProperties) {
    assert.deepEqual(oldApplicationConfigFile[prop], newApplicationConfigFile[prop])
  }
  for (const prop in equalPluginsProperties) {
    assert.deepEqual(oldApplicationConfigFile.plugins[prop], newApplicationConfigFile.plugins[prop])
  }

  // new configuration has 2 packages
  assert.equal(newApplicationConfigFile.plugins.packages.length, 2)
  assert.deepEqual(newApplicationConfigFile.plugins.packages[0], {
    name: '@fastify/passport',
    options: { country: '{PLT_RIVAL_FST_PLUGIN_PASSPORT_COUNTRY}' }
  })

  // the first package has been updated with a new option
  assert.deepEqual(newApplicationConfigFile.plugins.packages[1].options.new, {
    option: '{PLT_RIVAL_FST_PLUGIN_OAUTH2_NEW_OPTION}'
  })
  // the runtime .env should be updated
  const runtimeDotEnv = createEnvFileTool({
    path: join(dir, '.env')
  })

  await runtimeDotEnv.load()
  assert.equal(runtimeDotEnv.getValue('PLT_RIVAL_FST_PLUGIN_PASSPORT_COUNTRY'), 'italy')
  assert.equal(runtimeDotEnv.getValue('PLT_RIVAL_FST_PLUGIN_OAUTH2_NEW_OPTION'), 'new_options_value')
  // ensure the sample file is still there
  assert.equal(await readFile(sampleRouteFilePath, 'utf-8'), samplerouteFileContents)

  // there should be a new dependency in package.json
  const runtimePackageJson = JSON.parse(await readFile(join(dir, 'package.json'), 'utf-8'))

  assert.ok(runtimePackageJson.dependencies['@fastify/passport'])
  assert.ok(runtimePackageJson.dependencies['@fastify/oauth2'])
})

test('should remove a plugin from an existing application', async t => {
  mockNpmJsRequestForPkgs(['@fastify/passport'])

  const fixture = join(import.meta.dirname, '..', 'fixtures', 'sample-runtime')
  const dir = await setupTemporaryDirectory(fixture)

  const rg = new RuntimeGenerator({ targetDirectory: dir, applicationsFolder: 'services' })
  await rg.loadFromDir(dir)
  const oldApplicationConfigFile = JSON.parse(
    await readFile(join(dir, 'services', 'rival', 'platformatic.json'), 'utf-8')
  )
  // load previous application config file
  const updatedApplication = {
    name: 'rival',
    template: '@platformatic/service',
    fields: [],
    plugins: [
      {
        name: '@fastify/passport',
        options: [
          {
            name: 'FST_PLUGIN_PASSPORT_COUNTRY',
            path: 'country',
            type: 'string',
            value: 'italy'
          }
        ]
      }
    ]
  }
  await rg.update({
    applications: [updatedApplication] // the original application was removed
  })

  // the config file should be left unchanged
  const newApplicationConfigFile = JSON.parse(
    await readFile(join(dir, 'services', 'rival', 'platformatic.json'), 'utf-8')
  )
  assert.notDeepEqual(oldApplicationConfigFile, newApplicationConfigFile)

  // the runtime .env should be updated
  const runtimeDotEnv = createEnvFileTool({
    path: join(dir, '.env')
  })

  await runtimeDotEnv.load()

  // new value
  assert.equal(runtimeDotEnv.getValue('PLT_RIVAL_FST_PLUGIN_PASSPORT_COUNTRY'), 'italy')
  // removed values
  assert.equal(runtimeDotEnv.getValue('PLT_RIVAL_FST_PLUGIN_OAUTH2_NAME'), null)
  assert.equal(runtimeDotEnv.getValue('PLT_RIVAL_FST_PLUGIN_OAUTH2_CREDENTIALS_CLIENT_ID'), null)
  assert.equal(runtimeDotEnv.getValue('PLT_RIVAL_FST_PLUGIN_OAUTH2_CREDENTIALS_CLIENT_SECRET'), null)
  assert.equal(runtimeDotEnv.getValue('PLT_RIVAL_FST_PLUGIN_OAUTH2_REDIRECT_PATH'), null)
  assert.equal(runtimeDotEnv.getValue('PLT_RIVAL_FST_PLUGIN_OAUTH2_CALLBACK_URI'), null)

  const runtimePackageJson = JSON.parse(await readFile(join(dir, 'package.json'), 'utf-8'))

  assert.ok(runtimePackageJson.dependencies['@fastify/passport'])
  assert.ok(!runtimePackageJson.dependencies['@fastify/oauth2'])
})

test('should remove a plugin from an application and add the same on the other', async t => {
  mockNpmJsRequestForPkgs(['@fastify/oauth2', '@fastify/foo-plugin'])

  const fixture = join(import.meta.dirname, '..', 'fixtures', 'sample-runtime')
  const dir = await setupTemporaryDirectory(fixture)

  const rg = new RuntimeGenerator({ targetDirectory: dir, applicationsFolder: 'services' })
  await rg.loadFromDir(dir)
  assert.equal(rg.applications.length, 1)
  assert.equal(rg.applications[0].name, 'rival')
  const updatedApplication = {
    name: 'rival',
    template: '@platformatic/service',
    fields: [],
    plugins: [
      {
        name: '@fastify/passport',
        options: [
          {
            name: 'FST_PLUGIN_PASSPORT_COUNTRY',
            path: 'country',
            type: 'string',
            value: 'italy'
          }
        ]
      }
    ]
  }
  const newApplication = {
    name: 'foobar',
    template: '@platformatic/db',
    fields: [],
    plugins: [
      {
        name: '@fastify/foo-plugin',
        options: [
          {
            name: 'FST_PLUGIN_FOO_TEST_VALUE',
            path: 'testValue',
            type: 'string',
            value: 'foobar'
          },
          {
            name: 'FST_PLUGIN_FOO_CREDENTIALS_NAME',
            path: 'credentials.name',
            type: 'string',
            value: 'johndoe'
          }
        ]
      },
      {
        name: '@fastify/oauth2',
        options: [
          {
            name: 'FST_PLUGIN_OAUTH2_NAME',
            path: 'name',
            type: 'string',
            value: 'new_oauth2_name'
          }
        ]
      }
    ]
  }
  await rg.update({
    applications: [updatedApplication, newApplication] // the original application was removed
  })

  // the new application has been generated
  const applicationConfigFile = JSON.parse(
    await readFile(join(dir, 'services', 'foobar', 'platformatic.json'), 'utf-8')
  )
  assert.deepEqual(applicationConfigFile.plugins.packages[0], {
    name: '@fastify/foo-plugin',
    options: {
      testValue: '{PLT_FOOBAR_FST_PLUGIN_FOO_TEST_VALUE}',
      credentials: {
        name: '{PLT_FOOBAR_FST_PLUGIN_FOO_CREDENTIALS_NAME}'
      }
    }
  })

  // the runtime .env should be updated
  const runtimeDotEnv = createEnvFileTool({
    path: join(dir, '.env')
  })

  await runtimeDotEnv.load()

  assert.equal(runtimeDotEnv.getValue('PLT_FOOBAR_FST_PLUGIN_FOO_TEST_VALUE'), 'foobar')
  assert.equal(runtimeDotEnv.getValue('PLT_FOOBAR_FST_PLUGIN_FOO_CREDENTIALS_NAME'), 'johndoe')
  assert.equal(runtimeDotEnv.getValue('PLT_FOOBAR_FST_PLUGIN_OAUTH2_NAME'), 'new_oauth2_name')

  const runtimePackageJson = JSON.parse(await readFile(join(dir, 'package.json'), 'utf-8'))
  assert.ok(runtimePackageJson.dependencies['@fastify/oauth2'])
  assert.ok(runtimePackageJson.dependencies['@fastify/foo-plugin'])
  assert.ok(runtimePackageJson.dependencies['@fastify/passport'])
})

test('should handle new fields on new application', async t => {
  mockNpmJsRequestForPkgs(['@fastify/oauth2', '@fastify/foo-plugin'])

  const fixture = join(import.meta.dirname, '..', 'fixtures', 'sample-runtime')
  const dir = await setupTemporaryDirectory(fixture)

  const rg = new RuntimeGenerator({ targetDirectory: dir, applicationsFolder: 'services' })
  await rg.loadFromDir(dir)
  assert.equal(rg.applications.length, 1)
  assert.equal(rg.applications[0].name, 'rival')
  const updatedApplication = {
    name: 'rival',
    template: '@platformatic/service',
    fields: [],
    plugins: [
      {
        name: '@fastify/passport',
        options: [
          {
            name: 'FST_PLUGIN_PASSPORT_COUNTRY',
            path: 'country',
            type: 'string',
            value: 'italy'
          }
        ]
      }
    ]
  }
  const newApplication = {
    name: 'foobar',
    template: '@platformatic/db',
    fields: [
      {
        var: 'DATABASE_URL',
        value: 'sqlite://./db.sqlite',
        configValue: 'connectionString',
        type: 'string'
      },
      {
        var: 'PLT_APPLY_MIGRATIONS',
        value: 'true',
        type: 'boolean'
      }
    ],
    plugins: []
  }
  await rg.update({
    applications: [updatedApplication, newApplication] // the original application was removed
  })

  // the new application has been generated
  const applicationConfigFile = JSON.parse(
    await readFile(join(dir, 'services', 'foobar', 'platformatic.json'), 'utf-8')
  )
  assert.equal(applicationConfigFile.plugins.packages, undefined)

  // the runtime .env should be updated
  const runtimeDotEnv = createEnvFileTool({
    path: join(dir, '.env')
  })

  await runtimeDotEnv.load()

  assert.equal(runtimeDotEnv.getValue('PLT_FOOBAR_DATABASE_URL'), 'sqlite://./db.sqlite')
  assert.equal(runtimeDotEnv.getValue('PLT_FOOBAR_APPLY_MIGRATIONS'), 'true')

  const runtimePackageJson = JSON.parse(await readFile(join(dir, 'package.json'), 'utf-8'))
  assert.ok(runtimePackageJson.dependencies['@fastify/passport'])
})
