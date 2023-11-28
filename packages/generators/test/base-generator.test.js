'use strict'

const { readFile, rm } = require('node:fs/promises')
const { test, afterEach, describe } = require('node:test')
const assert = require('node:assert')
const { join } = require('node:path')

const { fakeLogger, getTempDir } = require('./helpers')
const { BaseGenerator } = require('../lib/base-generator')
const { convertServiceNameToPrefix } = require('../lib/utils')

afterEach(async () => {
  try {
    await rm(join(__dirname, 'tmp'), { recursive: true })
  } catch (err) {
    // do nothing
  }
})

test('should write file and dirs', async (t) => {
  const dir = await getTempDir()
  const gen = new BaseGenerator({
    logger: fakeLogger,
    module: '@platformatic/service'
  })

  gen.setConfig({
    targetDirectory: dir
  })

  await gen.run()
  // check files are created
  const packageJson = JSON.parse(await readFile(join(dir, 'package.json'), 'utf8'))
  assert.ok(packageJson.scripts)
  assert.ok(packageJson.dependencies)
  assert.ok(packageJson.engines)

  const configFile = JSON.parse(await readFile(join(dir, 'platformatic.json'), 'utf8'))
  assert.deepEqual(configFile, {})
})

test('extended class should generate config', async (t) => {
  // const dir = await getTempDir()
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
    contents: JSON.stringify({ foo: 'bar' }, null, 2)
  })
})

test('setConfig', async (t) => {
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
    staticWorkspaceGitHubActions: false,
    dynamicWorkspaceGitHubActions: false,
    env: {},
    dependencies: {},
    devDependencies: {},
    isRuntimeContext: false,
    serviceName: '',
    envPrefix: '',
    tests: false
  })

  // should not have undefined properties
  Object.entries(bg.config).forEach((kv) => {
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
    staticWorkspaceGitHubActions: false,
    dynamicWorkspaceGitHubActions: false,
    env: {},
    dependencies: {},
    devDependencies: {},
    isRuntimeContext: false,
    serviceName: '',
    envPrefix: '',
    tests: false
  })

  // reset config to defaults
  bg.setConfig()
  assert.deepEqual(bg.config, {
    port: 3042,
    hostname: '0.0.0.0',
    plugin: false,
    typescript: false,
    initGitRepository: false,
    staticWorkspaceGitHubActions: false,
    dynamicWorkspaceGitHubActions: false,
    env: {},
    dependencies: {},
    devDependencies: {},
    isRuntimeContext: false,
    serviceName: '',
    envPrefix: '',
    tests: false
  })
})

test('should append env values', async (t) => {
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
  assert.equal(dotEnvFile.contents, 'FOO=bar\n')
})

test('should return service metadata', async (t) => {
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

test('should generate javascript plugin, routes and tests', async (t) => {
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

  assert.ok(bg.getFileObject('root.test.js', 'test/routes'))
  assert.ok(bg.getFileObject('example.test.js', 'test/plugins'))
})

test('should generate tsConfig file and typescript files', async (t) => {
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
      outDir: 'dist'
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

  assert.ok(bg.getFileObject('root.test.ts', 'test/routes'))
  assert.ok(bg.getFileObject('example.test.ts', 'test/plugins'))
})

test('should add questions in the correct position (before)', async (t) => {
  const question = {
    type: 'input',
    name: 'serviceName',
    message: 'What is the name of the service?'
  }

  const bg = new BaseGenerator({
    module: '@platformatic/service'
  })

  await bg.prepareQuestions()
  const originalQuestionsLength = bg.questions.length
  bg.addQuestion(question, { before: 'typescript' }) // should add as second question

  assert.equal(bg.questions.length, originalQuestionsLength + 1)
  assert.deepEqual(bg.questions[1], {
    type: 'input',
    name: 'serviceName',
    message: 'What is the name of the service?'
  })
})

test('should add questions in the correct position (after)', async (t) => {
  const question = {
    type: 'input',
    name: 'serviceName',
    message: 'What is the name of the service?'
  }

  const bg = new BaseGenerator({
    module: '@platformatic/service'
  })

  await bg.prepareQuestions()
  const originalQuestionsLength = bg.questions.length
  bg.addQuestion(question, { after: 'typescript' }) // should add as third question

  assert.equal(bg.questions.length, originalQuestionsLength + 1)
  assert.deepEqual(bg.questions[2], {
    type: 'input',
    name: 'serviceName',
    message: 'What is the name of the service?'
  })
})

test('should add questions at the end', async (t) => {
  const question = {
    type: 'input',
    name: 'serviceName',
    message: 'What is the name of the service?'
  }

  const bg = new BaseGenerator({
    module: '@platformatic/service'
  })

  await bg.prepare()
  const originalQuestionsLength = bg.questions.length
  bg.addQuestion(question)

  assert.equal(bg.questions.length, originalQuestionsLength + 1)
  assert.deepEqual(bg.questions[originalQuestionsLength], {
    type: 'input',
    name: 'serviceName',
    message: 'What is the name of the service?'
  })
})

test('should remove question', async (t) => {
  const bg = new BaseGenerator({
    module: '@platformatic/service'
  })

  await bg.prepareQuestions()

  bg.removeQuestion('typescript')

  bg.questions.forEach((question) => {
    if (question.name === 'typescript') {
      assert.fail()
    }
  })
})

test('should throw if preapare fails', async (t) => {
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
    assert.equal(err.message, 'Env variable BAR is defined in config file platformatic.json, but not in config.env object.')
  }
})

describe('runtime context', () => {
  test('should set config.envPrefix correctly', async (t) => {
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

  test('should generate correct env file from config.env', async (t) => {
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

  test('should return service metadata', async (t) => {
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
