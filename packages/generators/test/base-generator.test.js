'use strict'

const { readFile, cp } = require('node:fs/promises')
const { test, after, afterEach, describe } = require('node:test')
const assert = require('node:assert')
const { join } = require('node:path')

const { fakeLogger, getTempDir, moveToTmpdir, mockNpmJsRequestForPkgs, mockAgent } = require('./helpers')
const { BaseGenerator } = require('../lib/base-generator')
const { convertServiceNameToPrefix } = require('../lib/utils')
const { safeRemove } = require('@platformatic/utils')

afterEach(async () => {
  try {
    await safeRemove(join(__dirname, 'tmp'))
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
    serviceName: 'test-service'
  })

  await gen.run()
  // check files are created
  const packageJson = JSON.parse(await readFile(join(dir, 'package.json'), 'utf8'))
  assert.ok(packageJson.scripts)
  assert.ok(packageJson.dependencies)
  assert.equal(packageJson.dependencies.platformatic, undefined)
  assert.ok(packageJson.engines)

  assert.equal(packageJson.name, 'test-service')

  const configFile = JSON.parse(await readFile(join(dir, 'platformatic.json'), 'utf8'))
  assert.deepEqual(configFile, {})

  const gitignore = await readFile(join(dir, '.gitignore'), 'utf8')
  assert.ok(gitignore.length > 0) // file is created and not empty
})

test('extended class should generate config', async t => {
  class ServiceClass extends BaseGenerator {
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

  const svc = new ServiceClass({
    logger: fakeLogger
  })

  await svc.prepare()

  const configFile = svc.files[1]
  assert.deepEqual(configFile, {
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

  assert.deepEqual(bg.config, {
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
    serviceName: '',
    envPrefix: '',
    tests: false,
    isUpdating: false
  })

  // should not have undefined properties
  Object.entries(bg.config).forEach(kv => {
    assert.notStrictEqual(undefined, kv[1])
  })

  // partial config with defaults
  bg.setConfig({
    port: 3084
  })

  assert.deepEqual(bg.config, {
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
    serviceName: '',
    envPrefix: '',
    tests: false,
    isUpdating: false
  })

  // reset config to defaults
  bg.setConfig()
  assert.deepEqual(bg.config, {
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
    serviceName: '',
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

  assert.deepEqual(bg.config, {
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
    serviceName: '',
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
  assert.equal(dotEnvFile.contents.trim(), 'FOO=bar')

  const dotEnvSampleFile = bg.getFileObject('.env.sample')
  assert.equal(dotEnvSampleFile.contents.trim(), 'FOO=')
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
  assert.equal(dotEnvFile.contents.trim(), 'FOO=bar\nBAR=baz')

  const dotEnvSampleFile = bg.getFileObject('.env.sample')
  assert.equal(dotEnvSampleFile.contents.trim(), 'BAR=baz\nFOO=')
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
  assert.deepStrictEqual(bg.questions, [
    {
      type: 'input',
      name: 'targetDirectory',
      message: 'Where would you like to create your project?'
    },
    {
      type: 'list',
      name: 'typescript',
      message: 'Do you want to use TypeScript?',
      default: false,
      choices: [
        { name: 'yes', value: true },
        { name: 'no', value: false }
      ]
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
  assert.deepStrictEqual(bg.questions, [
    {
      type: 'list',
      name: 'typescript',
      message: 'Do you want to use TypeScript?',
      default: false,
      choices: [
        { name: 'yes', value: true },
        { name: 'no', value: false }
      ]
    },
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
  assert.deepStrictEqual(bg.questions, [])
})

test('should return service metadata', async t => {
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
  assert.deepEqual(metadata, {
    targetDirectory: '/foo/bar',
    env: {
      FOO: 'bar'
    }
  })
})

test('should generate javascript plugin, routes and tests', async t => {
  const bg = new BaseGenerator({
    module: '@platformatic/service'
  })
  bg.setConfig({
    plugin: true,
    tests: true
  })
  await bg.prepare()
  assert.ok(bg.getFileObject('example.js', 'plugins'))
  assert.ok(bg.getFileObject('root.js', 'routes'))

  assert.ok(bg.getFileObject('root.test.js', join('test', 'routes')))
  assert.ok(bg.getFileObject('example.test.js', join('test', 'plugins')))
})

test('should generate tsConfig file and typescript files', async t => {
  const bg = new BaseGenerator({
    module: '@platformatic/service'
  })
  bg.setConfig({
    typescript: true,
    plugin: true,
    tests: true
  })
  const template = {
    compilerOptions: {
      module: 'commonjs',
      esModuleInterop: true,
      target: 'es2020',
      sourceMap: true,
      pretty: true,
      noEmitOnError: true,
      incremental: true,
      strict: true,
      outDir: 'dist',
      skipLibCheck: true
    },
    watchOptions: {
      watchFile: 'fixedPollingInterval',
      watchDirectory: 'fixedPollingInterval',
      fallbackPolling: 'dynamicPriority',
      synchronousWatchDirectory: true,
      excludeDirectories: ['**/node_modules', 'dist']
    }
  }
  await bg.prepare()
  const tsConfigFile = bg.getFileObject('tsconfig.json')
  assert.deepEqual(JSON.parse(tsConfigFile.contents), template)

  assert.ok(bg.getFileObject('example.ts', 'plugins'))
  assert.ok(bg.getFileObject('root.ts', 'routes'))

  assert.ok(bg.getFileObject('root.test.ts', join('test', 'routes')))
  assert.ok(bg.getFileObject('example.test.ts', join('test', 'plugins')))
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
    assert.fail()
  } catch (err) {
    assert.equal(err.code, 'PLT_GEN_PREPARE_ERROR')
    assert.equal(err.message, 'Error while generating the files: beforePrepare error.')
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
    assert.fail()
  } catch (err) {
    assert.equal(err.code, 'PLT_GEN_MISSING_ENV_VAR')
    assert.equal(
      err.message,
      'Env variable BAR is defined in config file platformatic.json, but not in config.env object.'
    )
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

  assert.equal(bg.packages.length, 1)
  assert.deepEqual(bg.packages[0], packageDefinition)
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
      serviceName: 'my-service'
    })
    await svc.addPackage(packageDefinitions[0])
    await svc.prepare()

    const platformaticConfigFile = svc.getFileObject('platformatic.json')
    const contents = JSON.parse(platformaticConfigFile.contents)

    assert.deepEqual(contents.plugins, {
      packages: [
        {
          name: '@fastify/compress',
          options: {
            threshold: 1,
            foobar: '{PLT_MY_SERVICE_FST_PLUGIN_STATIC_FOOBAR}'
          }
        }
      ]
    })

    assert.equal(svc.config.env.PLT_MY_SERVICE_FST_PLUGIN_STATIC_FOOBAR, 123)

    const packageJsonFile = svc.getFileObject('package.json')
    const packageJson = JSON.parse(packageJsonFile.contents)
    assert.equal(packageJson.dependencies['@fastify/compress'], 'latest')
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

    assert.deepEqual(contents.plugins, {
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

    assert.deepEqual(contents.plugins, {
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
      serviceName: 'my-service'
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

    assert.deepEqual(contents.plugins, {
      packages: [
        {
          name: '@fastify/static',
          options: {
            root: join('{PLT_ROOT}', '{PLT_MY_SERVICE_FST_PLUGIN_STATIC_ROOT}')
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
      serviceName: 'my-service'
    })
    await svc.addPackage(packageDefinitions[0])
    await svc.prepare()

    const packageJsonFile = svc.getFileObject('package.json')
    const packageJson = JSON.parse(packageJsonFile.contents)
    assert.equal(packageJson.dependencies.foobar, '1.42.0')
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
      serviceName: 'my-service'
    })
    await svc.addPackage(packageDefinitions[0])
    await svc.prepare()

    const packageJsonFile = svc.getFileObject('package.json')
    const packageJson = JSON.parse(packageJsonFile.contents)
    assert.equal(packageJson.dependencies.foobar, 'latest')
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
      serviceName: 'my-service'
    })
    await svc.addPackage(packageDefinitions[0])
    await svc.prepare()

    const packageJsonFile = svc.getFileObject('package.json')
    const packageJson = JSON.parse(packageJsonFile.contents)
    assert.equal(packageJson.dependencies[packageName], 'latest')
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
      serviceName: 'my-service'
    })
    await svc.addPackage(packageDefinitions[0])
    await svc.prepare()

    const packageJsonFile = svc.getFileObject('package.json')
    const packageJson = JSON.parse(packageJsonFile.contents)
    assert.equal(packageJson.dependencies.foobar, 'latest')
  }
})
test('should load data from directory', async t => {
  const runtimeDirectory = join(__dirname, 'fixtures', 'sample-runtime')
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
  assert.deepEqual(data, expected)
})

test('on update should just touch the packages configuration', async t => {
  mockNpmJsRequestForPkgs(['@fastify/foo-plugin'])
  const runtimeDirectory = join(__dirname, 'fixtures', 'sample-runtime', 'services', 'rival')
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

  assert.equal(bg.files.length, 1)
  assert.equal(bg.files[0].file, 'platformatic.json')
  assert.equal(bg.files[0].path, '')

  const configFileContents = JSON.parse(bg.files[0].contents)
  assert.deepEqual(configFileContents.plugins.packages, [
    {
      name: '@fastify/foo-plugin',
      options: {
        name: '{FST_PLUGIN_FOO_FOOBAR}'
      }
    }
  ])
  assert.deepEqual(bg.config.dependencies, {
    '@fastify/foo-plugin': '1.42.0'
  })
})

test('on update should just touch the packages configuration', async t => {
  mockNpmJsRequestForPkgs(['@fastify/foo-plugin'])
  const runtimeDirectory = join(__dirname, 'fixtures', 'sample-runtime', 'services', 'no-plugin')
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

  assert.equal(bg.files.length, 1)
  assert.equal(bg.files[0].file, 'platformatic.json')
  assert.equal(bg.files[0].path, '')

  const configFileContents = JSON.parse(bg.files[0].contents)
  assert.equal(configFileContents.plugins, undefined)
  assert.deepEqual(bg.config.dependencies, {
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
      serviceName: 'sample-service'
    })

    assert.equal(bg.config.envPrefix, 'SAMPLE_SERVICE')

    bg.setConfig({
      isRuntimeContext: true,
      serviceName: 'sample-service',
      envPrefix: 'ANOTHER_PREFIX',
      env: {
        FOO: 'bar',
        BAZ: 'baz'
      }
    })

    assert.equal(bg.config.envPrefix, 'ANOTHER_PREFIX')
    assert.deepEqual(bg.config.env, {
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
      serviceName: 'sample-service',
      envPrefix: 'ANOTHER_PREFIX',
      env: {
        FOO: 'bar',
        BAZ: 'baz'
      }
    })

    const meta = await bg.prepare()

    assert.deepEqual(meta.env, {
      PLT_ANOTHER_PREFIX_FOO: 'bar',
      PLT_ANOTHER_PREFIX_BAZ: 'baz'
    })
  })

  test('should return service metadata', async t => {
    const bg = new BaseGenerator({
      module: '@platformatic/service'
    })
    // partial config with defaults
    bg.setConfig({
      targetDirectory: '/foo/bar',
      isRuntimeContext: true,
      serviceName: 'my-service',
      env: {
        FOO: 'bar'
      }
    })

    const metadata = await bg.prepare()
    assert.deepEqual(metadata, {
      targetDirectory: '/foo/bar',
      env: {
        PLT_MY_SERVICE_FOO: 'bar'
      }
    })
  })

  test('should generate service name if not provided', async () => {
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

    assert.equal(bg.config.envPrefix, convertServiceNameToPrefix(bg.config.serviceName))
    const envPrefix = bg.config.envPrefix
    assert.deepEqual(metadata, {
      targetDirectory: '/foo/bar',
      env: {
        [`PLT_${envPrefix}_FOO`]: 'bar'
      }
    })
  })
})
