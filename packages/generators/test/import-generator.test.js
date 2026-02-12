import { safeRemove } from '@platformatic/foundation'
import { deepStrictEqual, ok } from 'node:assert'
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { test } from 'node:test'
import { ImportGenerator } from '../lib/import-generator.js'
import { fakeLogger, getTempDir } from './helpers.js'

function createGenerator (runtime, opts) {
  return new ImportGenerator({
    logger: fakeLogger,
    applicationName: 'test-application',
    module: '@platformatic/service',
    version: '1.0.0',
    parent: runtime,
    ...opts
  })
}
function createMockedRuntimeGenerator (opts) {
  const runtime = {
    getRuntimeConfigFileObject () {
      return { contents: '{}' }
    },
    getRuntimeEnvFileObject () {
      return { contents: '{}' }
    },
    updateRuntimeConfig (config) {
      runtime.config = config
    },
    updateRuntimeEnv (env) {
      runtime.env = env
    },
    applicationsFolder: 'web',
    config: {},
    env: '',
    ...opts
  }

  return runtime
}

async function createTemporaryDirectory (t) {
  const dir = await getTempDir()
  t.after(() => safeRemove(dir))
  return dir
}

test('should create ImportGenerator instance', async t => {
  const runtime = createMockedRuntimeGenerator()
  const gen = createGenerator(runtime)

  deepStrictEqual(gen.config.applicationName, 'test-application')
  deepStrictEqual(gen.config.module, '@platformatic/service')
  deepStrictEqual(gen.config.version, '1.0.0')
  deepStrictEqual(gen.config.applicationPathEnvName, 'PLT_APPLICATION_TEST_APPLICATION_PATH')
  deepStrictEqual(gen.runtime, runtime)
})

test('should sanitize application name for environment variable', async t => {
  const runtime = createMockedRuntimeGenerator()

  {
    const gen = createGenerator(runtime, { applicationName: 'test-application-123' })
    deepStrictEqual(gen.config.applicationPathEnvName, 'PLT_APPLICATION_TEST_APPLICATION_123_PATH')
  }

  {
    const gen = createGenerator(runtime, { applicationName: 'test@application.name' })
    deepStrictEqual(gen.config.applicationPathEnvName, 'PLT_APPLICATION_TEST_APPLICATION_NAME_PATH')
  }
})

test('should prepare questions for user input', async t => {
  const runtime = createMockedRuntimeGenerator()
  const gen = createGenerator(runtime)

  await gen.prepareQuestions()
  deepStrictEqual(gen.questions.length, 4)

  const pathQuestion = gen.questions.at(-2)
  deepStrictEqual(pathQuestion.type, 'input')
  deepStrictEqual(pathQuestion.name, 'applicationPath')
  deepStrictEqual(pathQuestion.message, 'Where is your application located?')

  const operationQuestion = gen.questions.at(-1)
  deepStrictEqual(operationQuestion.type, 'list')
  deepStrictEqual(operationQuestion.name, 'operation')
  deepStrictEqual(operationQuestion.message, 'Do you want to import or copy your application?')
  deepStrictEqual(operationQuestion.default, 'import')
  deepStrictEqual(operationQuestion.choices.length, 2)
})

test('should validate application path', async t => {
  const runtime = createMockedRuntimeGenerator()
  const gen = createGenerator(runtime)

  await gen.prepareQuestions()
  const pathQuestion = gen.questions.at(-2)

  {
    const result = await pathQuestion.validate('')
    deepStrictEqual(result, 'Please enter a path')
  }

  {
    const dir = await createTemporaryDirectory(t)
    const result = await pathQuestion.validate(dir)
    deepStrictEqual(result, true)
  }

  {
    const result = await pathQuestion.validate('/nonexistent/path')
    deepStrictEqual(result, 'Please enter a valid path')
  }

  {
    const result = await pathQuestion.validate(import.meta.filename)
    deepStrictEqual(result, 'Please enter a valid path')
  }
})

test('copy - should copy application', async t => {
  const sourceDir = await createTemporaryDirectory(t)
  const targetDir = await createTemporaryDirectory(t)

  // Create test files in source directory
  await writeFile(join(sourceDir, 'package.json'), JSON.stringify({ name: 'test-app' }))
  await writeFile(join(sourceDir, 'index.js'), 'console.log("hello")')
  await writeFile(join(sourceDir, '.env'), 'A=B')
  await mkdir(join(sourceDir, 'src'))
  await mkdir(join(sourceDir, 'node_modules'))
  await writeFile(join(sourceDir, 'src', 'fake.js'), 'module.exports = {}')
  await writeFile(join(sourceDir, 'src', 'app.js'), 'module.exports = {}')
  await writeFile(join(sourceDir, 'src', '.env'), 'C=D')
  await writeFile(join(sourceDir, 'node_modules', 'fake.js'), 'module.exports = {}')
  await writeFile(join(sourceDir, 'pnpm-lock.yaml'), '---')
  await writeFile(join(sourceDir, 'package-lock.json'), '{}')
  await writeFile(join(sourceDir, 'yarn.lock'), '{}')

  const runtime = createMockedRuntimeGenerator()
  const gen = createGenerator(runtime, { targetDirectory: targetDir })
  gen.setConfig({ applicationPath: sourceDir, operation: 'copy' })

  await gen._beforeWriteFiles(runtime)
  await gen.writeFiles()

  // Check that files were copied
  const packageJson = JSON.parse(await readFile(join(targetDir, 'package.json'), 'utf-8'))
  deepStrictEqual(packageJson.name, 'test-app')
  deepStrictEqual(packageJson.dependencies['@platformatic/service'], '^1.0.0')

  const indexJs = await readFile(join(targetDir, 'index.js'), 'utf-8')
  deepStrictEqual(indexJs, 'console.log("hello")')

  const envFile = await readFile(join(targetDir, '.env'), 'utf-8')
  deepStrictEqual(envFile, 'A=B')

  const appJs = await readFile(join(targetDir, 'src', 'app.js'), 'utf-8')
  deepStrictEqual(appJs, 'module.exports = {}')

  const srcEnvFile = await readFile(join(targetDir, 'src/.env'), 'utf-8')
  deepStrictEqual(srcEnvFile, 'C=D')

  ok(!existsSync(join(targetDir, 'node_modules', 'fake.js')))
  ok(!existsSync(join(targetDir, 'pnpm-lock.yaml')))
  ok(!existsSync(join(targetDir, 'package-lock.json')))
  ok(!existsSync(join(targetDir, 'yarn.lock')))
})

test('copy - should generate config file for platformatic module', async t => {
  const sourceDir = await createTemporaryDirectory(t)
  const targetDir = await createTemporaryDirectory(t)

  const runtime = createMockedRuntimeGenerator()
  const gen = createGenerator(runtime, { targetDirectory: targetDir })
  gen.setConfig({ applicationPath: sourceDir, operation: 'copy' })

  await gen._beforeWriteFiles(runtime)
  await gen.writeFiles()

  const configContent = await readFile(join(targetDir, 'platformatic.json'), 'utf-8')
  const config = JSON.parse(configContent)
  deepStrictEqual(config.$schema, 'https://schemas.platformatic.dev/@platformatic/service/1.0.0.json')
})

test('copy - should generate config file for non-platformatic module', async t => {
  const sourceDir = await createTemporaryDirectory(t)
  const targetDir = await createTemporaryDirectory(t)

  const runtime = createMockedRuntimeGenerator()
  const gen = createGenerator(runtime, { module: 'custom-module', targetDirectory: targetDir })
  gen.setConfig({ applicationPath: sourceDir, operation: 'copy' })

  await gen._beforeWriteFiles(runtime)
  await gen.writeFiles()

  const configContent = await readFile(join(targetDir, 'platformatic.json'), 'utf-8')
  const config = JSON.parse(configContent)
  deepStrictEqual(config.module, 'custom-module')
})

test('copy - should not overwrite existing config file', async t => {
  const sourceDir = await createTemporaryDirectory(t)
  const targetDir = await createTemporaryDirectory(t)

  // Create existing config file
  const originalConfig = { existing: 'config' }
  await writeFile(join(sourceDir, 'platformatic.json'), JSON.stringify(originalConfig))

  const runtime = createMockedRuntimeGenerator()
  const gen = createGenerator(runtime, { targetDirectory: targetDir })
  gen.setConfig({ applicationPath: sourceDir, operation: 'copy' })

  await gen._beforeWriteFiles(runtime)
  await gen.writeFiles()

  // Check that original config was preserved
  const configContent = await readFile(join(targetDir, 'platformatic.json'), 'utf-8')
  const config = JSON.parse(configContent)
  deepStrictEqual(config, originalConfig)
})

test('copy - should update package.json dependencies correctly', async t => {
  const sourceDir = await createTemporaryDirectory(t)
  const targetDir = await createTemporaryDirectory(t)

  // Create package.json with existing dependencies
  const originalPackageJson = {
    name: 'test-app',
    dependencies: { lodash: '^4.0.0' },
    devDependencies: { '@platformatic/service': '^0.5.0' }
  }

  await writeFile(
    join(sourceDir, 'package.json'),
    JSON.stringify({
      name: 'test-app',
      dependencies: { lodash: '^4.0.0' },
      devDependencies: { '@platformatic/service': '^0.5.0' }
    })
  )

  const runtime = createMockedRuntimeGenerator()
  const gen = createGenerator(runtime, { targetDirectory: targetDir })
  gen.setConfig({ applicationPath: sourceDir, operation: 'copy' })

  await gen._beforeWriteFiles(runtime)
  await gen.writeFiles()

  const packageJson = JSON.parse(await readFile(join(targetDir, 'package.json'), 'utf-8'))

  // Check that dependency was updated
  deepStrictEqual(packageJson.dependencies['@platformatic/service'], '^1.0.0')
  deepStrictEqual(packageJson.dependencies.lodash, '^4.0.0')

  // Check that devDependency was removed
  deepStrictEqual(packageJson.devDependencies['@platformatic/service'], undefined)

  // Check that original package.json was preserved
  deepStrictEqual(JSON.parse(await readFile(join(sourceDir, 'package.json'), 'utf-8')), originalPackageJson)
})

test('copy - should create package.json if it does not exist', async t => {
  const sourceDir = await createTemporaryDirectory(t)
  const targetDir = await createTemporaryDirectory(t)

  const runtime = createMockedRuntimeGenerator()
  const gen = createGenerator(runtime, { targetDirectory: targetDir })
  gen.setConfig({ applicationPath: sourceDir, operation: 'copy' })

  await gen._beforeWriteFiles(runtime)
  await gen.writeFiles()

  const packageJson = JSON.parse(await readFile(join(targetDir, 'package.json'), 'utf-8'))
  deepStrictEqual(packageJson.dependencies['@platformatic/service'], '^1.0.0')
})

test('import - should import application', async t => {
  const sourceDir = await createTemporaryDirectory(t)

  // Create test package.json in source directory
  await writeFile(
    join(sourceDir, 'package.json'),
    JSON.stringify({
      name: 'test-app',
      dependencies: { lodash: '^4.0.0' }
    })
  )

  await spawnSync('git', ['init', '.'], { cwd: sourceDir })
  await spawnSync('git', ['remote', 'add', 'upstream', 'git@github.com:hello/world.git'], { cwd: sourceDir })

  const runtime = createMockedRuntimeGenerator()

  const gen = createGenerator(runtime, { targetDirectory: '/foo' })
  gen.setConfig({ applicationPath: sourceDir, operation: 'import' })

  const result = await gen.prepare()
  deepStrictEqual(result.targetDirectory, '/foo')
  deepStrictEqual(result.env, {})

  await gen._beforeWriteFiles(runtime)

  // Check that runtime config was updated
  ok(Array.isArray(runtime.config.web))
  deepStrictEqual(runtime.config.web[0].id, 'test-application')
  deepStrictEqual(runtime.config.web[0].path, '{PLT_APPLICATION_TEST_APPLICATION_PATH}')
  deepStrictEqual(runtime.config.web[0].url, 'git@github.com:hello/world.git')

  // Check that runtime env was updated
  ok(runtime.env.includes('PLT_APPLICATION_TEST_APPLICATION_PATH=' + sourceDir))
})

test('import - should handle runtime with existing applications', async t => {
  const sourceDir = await createTemporaryDirectory(t)
  const targetDir = await createTemporaryDirectory(t)

  const runtime = createMockedRuntimeGenerator({
    applicationsBasePath: '/nonexistent/applications',
    getRuntimeConfigFileObject () {
      return {
        contents: JSON.stringify({
          web: [{ id: 'existing-application', path: '/existing/path' }]
        })
      }
    },
    getRuntimeEnvFileObject () {
      return { contents: 'EXISTING_VAR=value' }
    }
  })

  const gen = createGenerator(runtime, { targetDirectory: targetDir })
  gen.setConfig({ applicationPath: sourceDir, operation: 'import' })

  await gen._beforeWriteFiles(runtime)
  await gen._afterWriteFiles(runtime)

  deepStrictEqual(runtime.config.web.length, 2)
  deepStrictEqual(runtime.config.web[0].id, 'existing-application')
  deepStrictEqual(runtime.config.web[1].id, 'test-application')
  ok(runtime.env.includes('EXISTING_VAR=value'))
  ok(runtime.env.includes('PLT_APPLICATION_TEST_APPLICATION_PATH=' + sourceDir))
})

test('import - should not duplicate applications in runtime config', async t => {
  const sourceDir = await createTemporaryDirectory(t)
  const targetDir = await createTemporaryDirectory(t)

  const runtime = createMockedRuntimeGenerator({
    getRuntimeConfigFileObject () {
      return {
        contents: JSON.stringify({
          applications: [{ id: 'test-application', path: '/existing/path' }]
        })
      }
    },
    getRuntimeEnvFileObject () {
      return { contents: '' }
    }
  })

  const gen = createGenerator(runtime, { targetDirectory: targetDir })
  gen.setConfig({ applicationPath: sourceDir, operation: 'import' })

  await gen._beforeWriteFiles(runtime)

  deepStrictEqual(runtime.config.applications.length, 1)
  deepStrictEqual(runtime.config.applications[0].id, 'test-application')
})

test('import - should use different applications keys', async t => {
  const sourceDir = await createTemporaryDirectory(t)
  const targetDir = await createTemporaryDirectory(t)

  const runtime = createMockedRuntimeGenerator({
    getRuntimeConfigFileObject () {
      return {
        contents: JSON.stringify({
          applications: []
        })
      }
    },
    getRuntimeEnvFileObject () {
      return { contents: '' }
    }
  })

  const gen = createGenerator(runtime, { targetDirectory: targetDir })
  gen.setConfig({ applicationPath: sourceDir, operation: 'import' })

  await gen._beforeWriteFiles(runtime)

  ok(Array.isArray(runtime.config.applications))
  deepStrictEqual(runtime.config.applications[0].id, 'test-application')
})

test('import - when importing folders already in the project root, should not create useless file and should update the right files', async t => {
  const targetDir = await createTemporaryDirectory(t)
  const sourceDir = join(targetDir, 'my-app')

  const runtime = createMockedRuntimeGenerator({
    getRuntimeConfigFileObject () {
      return {
        contents: JSON.stringify({
          applications: [{ id: 'test-application', path: '/existing/path' }]
        })
      }
    },
    getRuntimeEnvFileObject () {
      return { contents: '' }
    }
  })

  const gen = createGenerator(runtime, { targetDirectory: targetDir })
  gen.setConfig({ applicationPath: sourceDir, operation: 'import' })

  await gen._beforeWriteFiles(runtime)

  deepStrictEqual(gen.files, [
    {
      path: '',
      file: join(targetDir, 'my-app', 'platformatic.json'),
      contents: '{\n' + '  "$schema": "https://schemas.platformatic.dev/@platformatic/service/1.0.0.json"\n' + '}',
      options: {},
      tags: []
    },
    {
      path: '',
      file: join(targetDir, 'my-app', 'package.json'),
      contents: '{\n  "version": "0.1.0",\n  "dependencies": {\n    "@platformatic/service": "^1.0.0"\n  }\n}',
      options: {},
      tags: []
    }
  ])
})
