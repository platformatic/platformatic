import { safeRemove } from '@platformatic/foundation'
import { deepEqual, deepStrictEqual, equal, fail, notStrictEqual, ok } from 'node:assert'
import { cp, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { after, afterEach, describe, test } from 'node:test'
import { BaseGenerator } from '../lib/base-generator.js'
import { convertApplicationNameToPrefix } from '../lib/utils.js'
import { fakeLogger, getTempDir, mockAgent, mockNpmJsRequestForPkgs, moveToTmpdir } from './helpers.js'

afterEach(async () => {
  try {
    await safeRemove(join(import.meta.dirname, 'tmp'))
  } catch (err) {
    // do nothing
  }
})

test('should write file and dirs', async t => {
  const dir = await getTempDir()
  const gen = new BaseGenerator({
    logger: fakeLogger,
    module: '@platformatic/service'
  })

  gen.setConfig({
    targetDirectory: dir,
    applicationName: 'test-application'
  })

  await gen.run()
  // check files are created
  const packageJson = JSON.parse(await readFile(join(dir, 'package.json'), 'utf8'))
  ok(packageJson.scripts)
  ok(packageJson.dependencies)
  equal(packageJson.dependencies.platformatic, undefined)
  ok(packageJson.engines)

  equal(packageJson.name, 'test-application')

  const configFile = JSON.parse(await readFile(join(dir, 'platformatic.json'), 'utf8'))
  deepEqual(configFile, {})

  const gitignore = await readFile(join(dir, '.gitignore'), 'utf8')
  ok(gitignore.length > 0) // file is created and not empty
})

test('extended class should generate config', async t => {
  class ApplicationClass extends BaseGenerator {
    constructor (opts) {
      super({
        ...opts,
        module: '@platformatic/service'
      })
    }

    async _getConfigFileContents () {
      // Implement when extending this class
      return {
        foo: 'bar'
      }
    }
  }

  const svc = new ApplicationClass({
    logger: fakeLogger
  })

  await svc.prepare()

  const configFile = svc.files[1]
  deepEqual(configFile, {
    path: '',
    file: 'platformatic.json',
    contents: JSON.stringify({ foo: 'bar' }, null, 2),
    options: {},
    tags: []
  })
})

test('setConfig', async t => {
  const bg = new BaseGenerator({
    module: '@platformatic/service'
  })

  // should init the default config
  await bg.prepare()

  deepEqual(bg.config, {
    port: 3042,
    hostname: '0.0.0.0',
    plugin: false,
    typescript: false,
    initGitRepository: false,
    env: {},
    defaultEnv: {},
    dependencies: {},
    devDependencies: {},
    isRuntimeContext: false,
    applicationName: '',
    envPrefix: '',
    tests: false,
    isUpdating: false
  })

  // should not have undefined properties
  Object.entries(bg.config).forEach(kv => {
    notStrictEqual(undefined, kv[1])
  })

  // partial config with defaults
  bg.setConfig({
    port: 3084
  })

  deepEqual(bg.config, {
    port: 3084, // this is the only custom value
    hostname: '0.0.0.0',
    plugin: false,
    typescript: false,
    initGitRepository: false,
    env: {},
    defaultEnv: {},
    dependencies: {},
    devDependencies: {},
    isRuntimeContext: false,
    applicationName: '',
    envPrefix: '',
    tests: false,
    isUpdating: false
  })

  // reset config to defaults
  bg.setConfig()
  deepEqual(bg.config, {
    port: 3042,
    hostname: '0.0.0.0',
    plugin: false,
    typescript: false,
    initGitRepository: false,
    env: {},
    defaultEnv: {},
    dependencies: {},
    devDependencies: {},
    isRuntimeContext: false,
    applicationName: '',
    envPrefix: '',
    tests: false,
    isUpdating: false
  })

  // update only some fields
  bg.setConfig({
    hostname: '123.123.123.123',
    port: 3000
  })

  bg.setConfig({
    port: 1234
  })

  deepEqual(bg.config, {
    port: 1234,
    hostname: '123.123.123.123',
    plugin: false,
    typescript: false,
    initGitRepository: false,
    env: {},
    defaultEnv: {},
    dependencies: {},
    devDependencies: {},
    isRuntimeContext: false,
    applicationName: '',
    envPrefix: '',
    tests: false,
    isUpdating: false
  })
})

test('should append env values', async t => {
  const bg = new BaseGenerator({
    module: '@platformatic/service'
  })
  // partial config with defaults
  bg.setConfig({
    env: {
      FOO: 'bar'
    }
  })

  await bg.prepare()
  const dotEnvFile = bg.getFileObject('.env')
  equal(dotEnvFile.contents.trim(), 'FOO=bar')

  const dotEnvSampleFile = bg.getFileObject('.env.sample')
  equal(dotEnvSampleFile.contents.trim(), 'FOO=')
})

test('should add a default env var to the .env.sample config', async t => {
  const bg = new BaseGenerator({
    module: '@platformatic/service'
  })
  // partial config with defaults
  bg.setConfig({
    env: {
      FOO: 'bar'
    }
  })

  bg.addEnvVars(
    {
      BAR: 'baz'
    },
    { overwrite: false, default: true }
  )

  await bg.prepare()
  const dotEnvFile = bg.getFileObject('.env')
  equal(dotEnvFile.contents.trim(), 'FOO=bar\nBAR=baz')

  const dotEnvSampleFile = bg.getFileObject('.env.sample')
  equal(dotEnvSampleFile.contents.trim(), 'BAR=baz\nFOO=')
})

test('should prepare the questions', async t => {
  const bg = new BaseGenerator({
    module: '@platformatic/service'
  })
  // partial config with defaults
  bg.setConfig({
    env: {
      FOO: 'bar'
    }
  })

  await bg.prepareQuestions()
  deepStrictEqual(bg.questions, [
    {
      type: 'input',
      name: 'targetDirectory',
      message: 'Where would you like to create your project?'
    },
    {
      type: 'input',
      name: 'port',
      message: 'What port do you want to use?'
    }
  ])
})

test('should prepare the questions with a targetDirectory', async t => {
  const bg = new BaseGenerator({
    module: '@platformatic/service'
  })
  // partial config with defaults
  bg.setConfig({
    targetDirectory: './foo',
    env: {
      FOO: 'bar'
    }
  })

  await bg.prepareQuestions()
  deepStrictEqual(bg.questions, [
    {
      type: 'input',
      name: 'port',
      message: 'What port do you want to use?'
    }
  ])
})

test('should prepare the questions in runtime context', async t => {
  const bg = new BaseGenerator({
    module: '@platformatic/service'
  })
  // partial config with defaults
  bg.setConfig({
    isRuntimeContext: true,
    env: {
      FOO: 'bar'
    }
  })

  await bg.prepareQuestions()
  deepStrictEqual(bg.questions, [])
})

test('should return application metadata', async t => {
  const bg = new BaseGenerator({
    module: '@platformatic/service'
  })
  // partial config with defaults
  bg.setConfig({
    targetDirectory: '/foo/bar',
    env: {
      FOO: 'bar'
    }
  })

  const metadata = await bg.prepare()
  deepEqual(metadata, {
    targetDirectory: '/foo/bar',
    env: {
      FOO: 'bar'
    }
  })
})

test('should throw if prepare fails', async t => {
  const bg = new BaseGenerator({
    module: '@platformatic/service'
  })

  bg._beforePrepare = async () => {
    throw new Error('beforePrepare error')
  }
  try {
    await bg.prepare()
    fail()
  } catch (err) {
    equal(err.code, 'PLT_GEN_PREPARE_ERROR')
    equal(err.message, 'Error while generating the files: beforePrepare error.')
  }
})

test('should throw if there is a missing env variable', async () => {
  const bg = new BaseGenerator({
    module: '@platformatic/service'
  })

  bg._getConfigFileContents = async () => {
    return {
      FOO: '{FOO}',
      BAR: '{BAR}'
    }
  }

  bg.setConfig({
    env: {
      FOO: 'foobar'
    }
  })

  try {
    await bg.prepare()
    fail()
  } catch (err) {
    equal(err.code, 'PLT_GEN_MISSING_ENV_VAR')
    equal(err.message, 'Env variable BAR is defined in config file platformatic.json, but not in config.env object.')
  }
})

test('should add package', async () => {
  const bg = new BaseGenerator({
    module: '@platformatic/service'
  })

  const packageDefinition = {
    name: '@my/package',
    options: [
      {
        path: 'foobar',
        type: 'string',
        value: 'foobar'
      }
    ]
  }
  await bg.addPackage(packageDefinition)

  equal(bg.packages.length, 1)
  deepEqual(bg.packages[0], packageDefinition)
})

test('support packages', async t => {
  {
    const svc = new BaseGenerator({
      module: '@platformatic/service'
    })
    const packageDefinitions = [
      {
        name: '@fastify/compress',
        options: [
          {
            path: 'threshold',
            value: '1',
            type: 'number'
          },
          {
            path: 'foobar',
            value: '123',
            type: 'number',
            name: 'FST_PLUGIN_STATIC_FOOBAR'
          }
        ]
      }
    ]
    svc.setConfig({
      isRuntimeContext: true,
      applicationName: 'my-application'
    })
    await svc.addPackage(packageDefinitions[0])
    await svc.prepare()

    const platformaticConfigFile = svc.getFileObject('platformatic.json')
    const contents = JSON.parse(platformaticConfigFile.contents)

    deepEqual(contents.plugins, {
      packages: [
        {
          name: '@fastify/compress',
          options: {
            threshold: 1,
            foobar: '{PLT_MY_APPLICATION_FST_PLUGIN_STATIC_FOOBAR}'
          }
        }
      ]
    })

    equal(svc.config.env.PLT_MY_APPLICATION_FST_PLUGIN_STATIC_FOOBAR, 123)

    const packageJsonFile = svc.getFileObject('package.json')
    const packageJson = JSON.parse(packageJsonFile.contents)
    equal(packageJson.dependencies['@fastify/compress'], 'latest')
  }

  {
    // with standard platformatic plugin
    const svc = new BaseGenerator({
      module: '@platformatic/service'
    })
    svc.setConfig({
      plugin: true
    })
    const packageDefinitions = [
      {
        name: '@fastify/compress',
        options: [
          {
            path: 'threshold',
            value: '1',
            type: 'number'
          }
        ]
      }
    ]
    await svc.addPackage(packageDefinitions[0])
    await svc.prepare()

    const platformaticConfigFile = svc.getFileObject('platformatic.json')
    const contents = JSON.parse(platformaticConfigFile.contents)

    deepEqual(contents.plugins, {
      packages: [
        {
          name: '@fastify/compress',
          options: {
            threshold: 1
          }
        }
      ]
    })
  }

  {
    // with relative path type but no name
    const svc = new BaseGenerator({
      module: '@platformatic/service'
    })
    svc.setConfig({
      isRuntimeContext: true,
      plugin: true
    })
    const packageDefinitions = [
      {
        name: '@fastify/static',
        options: [
          {
            path: 'root',
            value: 'public',
            type: 'path'
          }
        ]
      }
    ]
    await svc.addPackage(packageDefinitions[0])
    await svc.prepare()

    const platformaticConfigFile = svc.getFileObject('platformatic.json')
    const contents = JSON.parse(platformaticConfigFile.contents)

    deepEqual(contents.plugins, {
      packages: [
        {
          name: '@fastify/static',
          options: {
            root: join('{PLT_ROOT}', 'public')
          }
        }
      ]
    })
  }

  {
    // with relative path type and name
    const svc = new BaseGenerator({
      module: '@platformatic/service'
    })
    svc.setConfig({
      isRuntimeContext: true,
      plugin: true,
      applicationName: 'my-application'
    })
    const packageDefinitions = [
      {
        name: '@fastify/static',
        options: [
          {
            path: 'root',
            value: 'public',
            type: 'path',
            name: 'FST_PLUGIN_STATIC_ROOT'
          }
        ]
      }
    ]
    await svc.addPackage(packageDefinitions[0])
    await svc.prepare()

    const platformaticConfigFile = svc.getFileObject('platformatic.json')
    const contents = JSON.parse(platformaticConfigFile.contents)

    deepEqual(contents.plugins, {
      packages: [
        {
          name: '@fastify/static',
          options: {
            root: join('{PLT_ROOT}', '{PLT_MY_APPLICATION_FST_PLUGIN_STATIC_ROOT}')
          }
        }
      ]
    })
  }

  {
    mockNpmJsRequestForPkgs(['foobar'])
    // should get the version from npm
    // mockAgent
    //   .get('https://registry.npmjs.org')
    //   .intercept({
    //     method: 'GET',
    //     path: '/foobar'
    //   })
    //   .reply(200, {
    //     'dist-tags': {
    //       latest: '1.42.0'
    //     }
    //   })

    const svc = new BaseGenerator({
      module: '@platformatic/service'
    })
    const packageDefinitions = [
      {
        name: 'foobar',
        options: []
      }
    ]
    svc.setConfig({
      isRuntimeContext: true,
      applicationName: 'my-application'
    })
    await svc.addPackage(packageDefinitions[0])
    await svc.prepare()

    const packageJsonFile = svc.getFileObject('package.json')
    const packageJson = JSON.parse(packageJsonFile.contents)
    equal(packageJson.dependencies.foobar, '1.42.0')
  }

  {
    // should default to `latest` if getting the version from npm fails
    mockAgent
      .get('https://registry.npmjs.org')
      .intercept({
        method: 'GET',
        path: '/foobar'
      })
      .reply(500, {
        message: 'Internal Server Error'
      })

    const svc = new BaseGenerator({
      module: '@platformatic/service'
    })
    const packageDefinitions = [
      {
        name: 'foobar',
        options: []
      }
    ]
    svc.setConfig({
      isRuntimeContext: true,
      applicationName: 'my-application'
    })
    await svc.addPackage(packageDefinitions[0])
    await svc.prepare()

    const packageJsonFile = svc.getFileObject('package.json')
    const packageJson = JSON.parse(packageJsonFile.contents)
    equal(packageJson.dependencies.foobar, 'latest')
  }

  {
    // should set latest on timeout
    mockAgent
      .get('https://registry.npmjs.org')
      .intercept({
        method: 'GET',
        path: '/foobarxxx'
      })
      .reply(200, {
        'dist-tags': {
          latest: '1.42.0'
        }
      })
      .delay(3000)

    const svc = new BaseGenerator({
      module: '@platformatic/service'
    })
    const packageName = 'foobarxxx'
    const packageDefinitions = [
      {
        name: packageName,
        options: []
      }
    ]
    svc.setConfig({
      isRuntimeContext: true,
      applicationName: 'my-application'
    })
    await svc.addPackage(packageDefinitions[0])
    await svc.prepare()

    const packageJsonFile = svc.getFileObject('package.json')
    const packageJson = JSON.parse(packageJsonFile.contents)
    equal(packageJson.dependencies[packageName], 'latest')
  }

  {
    // should default to `latest` if getting the version from npm fails
    mockAgent
      .get('https://registry.npmjs.org')
      .intercept({
        method: 'GET',
        path: '/foobar'
      })
      .reply(500, {
        message: 'Internal Server Error'
      })

    const svc = new BaseGenerator({
      module: '@platformatic/service'
    })
    const packageDefinitions = [
      {
        name: 'foobar',
        options: []
      }
    ]
    svc.setConfig({
      isRuntimeContext: true,
      applicationName: 'my-application'
    })
    await svc.addPackage(packageDefinitions[0])
    await svc.prepare()

    const packageJsonFile = svc.getFileObject('package.json')
    const packageJson = JSON.parse(packageJsonFile.contents)
    equal(packageJson.dependencies.foobar, 'latest')
  }
})
test('should load data from directory', async t => {
  const runtimeDirectory = join(import.meta.dirname, 'fixtures', 'sample-runtime')
  const bg = new BaseGenerator({
    module: '@platformatic/service'
  })
  const data = await bg.loadFromDir('rival', runtimeDirectory)
  const expected = {
    name: 'rival',
    template: '@platformatic/service',
    fields: [],
    plugins: [
      {
        name: '@fastify/oauth2',
        options: [
          {
            path: 'name',
            type: 'string',
            value: 'googleOAuth2',
            name: 'FST_PLUGIN_OAUTH2_NAME'
          },
          {
            path: 'credentials.client.id',
            type: 'string',
            value: 'sample_client_id',
            name: 'FST_PLUGIN_OAUTH2_CREDENTIALS_CLIENT_ID'
          },
          {
            path: 'credentials.client.secret',
            type: 'string',
            value: 'sample_client_secret',
            name: 'FST_PLUGIN_OAUTH2_CREDENTIALS_CLIENT_SECRET'
          },
          {
            path: 'startRedirectPath',
            type: 'string',
            value: '/login/google',
            name: 'FST_PLUGIN_OAUTH2_REDIRECT_PATH'
          },
          {
            path: 'callbackUri',
            type: 'string',
            value: 'http://localhost:3000/login/google/callback',
            name: 'FST_PLUGIN_OAUTH2_CALLBACK_URI'
          }
        ]
      }
    ]
  }
  deepEqual(data, expected)
})

test('on update should just touch the packages configuration', async t => {
  mockNpmJsRequestForPkgs(['@fastify/foo-plugin'])
  const runtimeDirectory = join(import.meta.dirname, 'fixtures', 'sample-runtime', 'services', 'rival')
  const dir = await moveToTmpdir(after)
  await cp(runtimeDirectory, dir, { recursive: true })

  const bg = new BaseGenerator({
    module: '@platformatic/service',
    targetDirectory: dir
  })
  bg.setConfig({
    isUpdating: true
  })
  await bg.addPackage({
    name: '@fastify/foo-plugin',
    options: [
      {
        path: 'name',
        type: 'string',
        value: 'foobar',
        name: 'FST_PLUGIN_FOO_FOOBAR'
      }
    ]
  })
  await bg.prepare()

  equal(bg.files.length, 1)
  equal(bg.files[0].file, 'platformatic.json')
  equal(bg.files[0].path, '')

  const configFileContents = JSON.parse(bg.files[0].contents)
  deepEqual(configFileContents.plugins.packages, [
    {
      name: '@fastify/foo-plugin',
      options: {
        name: '{FST_PLUGIN_FOO_FOOBAR}'
      }
    }
  ])
  deepEqual(bg.config.dependencies, {
    '@fastify/foo-plugin': '1.42.0'
  })
})

test('on update should just touch the packages configuration', async t => {
  mockNpmJsRequestForPkgs(['@fastify/foo-plugin'])
  const runtimeDirectory = join(import.meta.dirname, 'fixtures', 'sample-runtime', 'services', 'no-plugin')
  const dir = await moveToTmpdir(after)
  await cp(runtimeDirectory, dir, { recursive: true })

  const bg = new BaseGenerator({
    module: '@platformatic/service',
    targetDirectory: dir
  })
  bg.setConfig({
    isUpdating: true
  })
  await bg.addPackage({
    name: '@fastify/foo-plugin',
    options: [
      {
        path: 'name',
        type: 'string',
        value: 'foobar',
        name: 'FST_PLUGIN_FOO_FOOBAR'
      }
    ]
  })
  await bg.prepare()

  equal(bg.files.length, 1)
  equal(bg.files[0].file, 'platformatic.json')
  equal(bg.files[0].path, '')

  const configFileContents = JSON.parse(bg.files[0].contents)
  equal(configFileContents.plugins, undefined)
  deepEqual(bg.config.dependencies, {
    '@fastify/foo-plugin': '1.42.0'
  })
})

describe('runtime context', () => {
  test('should set config.envPrefix correctly', async t => {
    const bg = new BaseGenerator({
      module: '@platformatic/service'
    })

    bg.setConfig({
      isRuntimeContext: true,
      applicationName: 'sample-application'
    })

    equal(bg.config.envPrefix, 'SAMPLE_APPLICATION')

    bg.setConfig({
      isRuntimeContext: true,
      applicationName: 'sample-application',
      envPrefix: 'ANOTHER_PREFIX',
      env: {
        FOO: 'bar',
        BAZ: 'baz'
      }
    })

    equal(bg.config.envPrefix, 'ANOTHER_PREFIX')
    deepEqual(bg.config.env, {
      PLT_ANOTHER_PREFIX_FOO: 'bar',
      PLT_ANOTHER_PREFIX_BAZ: 'baz'
    })
  })

  test('should generate correct env file from config.env', async t => {
    const bg = new BaseGenerator({
      module: '@platformatic/service'
    })

    bg.setConfig({
      isRuntimeContext: true,
      applicationName: 'sample-application',
      envPrefix: 'ANOTHER_PREFIX',
      env: {
        FOO: 'bar',
        BAZ: 'baz'
      }
    })

    const meta = await bg.prepare()

    deepEqual(meta.env, {
      PLT_ANOTHER_PREFIX_FOO: 'bar',
      PLT_ANOTHER_PREFIX_BAZ: 'baz'
    })
  })

  test('should return application metadata', async t => {
    const bg = new BaseGenerator({
      module: '@platformatic/service'
    })
    // partial config with defaults
    bg.setConfig({
      targetDirectory: '/foo/bar',
      isRuntimeContext: true,
      applicationName: 'my-application',
      env: {
        FOO: 'bar'
      }
    })

    const metadata = await bg.prepare()
    deepEqual(metadata, {
      targetDirectory: '/foo/bar',
      env: {
        PLT_MY_APPLICATION_FOO: 'bar'
      }
    })
  })

  test('should generate application name if not provided', async () => {
    const bg = new BaseGenerator({
      module: '@platformatic/service'
    })
    bg.setConfig({
      targetDirectory: '/foo/bar',
      isRuntimeContext: true,
      env: {
        FOO: 'bar'
      }
    })

    const metadata = await bg.prepare()

    equal(bg.config.envPrefix, convertApplicationNameToPrefix(bg.config.applicationName))
    const envPrefix = bg.config.envPrefix
    deepEqual(metadata, {
      targetDirectory: '/foo/bar',
      env: {
        [`PLT_${envPrefix}_FOO`]: 'bar'
      }
    })
  })
})
