import { ok, strictEqual } from 'node:assert'
import { mkdtemp, rmdir, unlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { test } from 'node:test'
import { MockAgent, setGlobalDispatcher } from 'undici'
import {
  applicationToEnvVariable,
  createCliLogger,
  fallbackToTemporaryConfigFile,
  findRuntimeConfigurationFile,
  getExecutableId,
  getExecutableName,
  getRoot,
  isVerbose,
  logFatalError,
  logo,
  parseArgs,
  setExecutableId,
  setExecutableName,
  setPrettyPrint,
  setVerbose,
  usePrettyPrint
} from '../lib/cli.js'

const mockAgent = new MockAgent()
setGlobalDispatcher(mockAgent)
mockAgent.disableNetConnect()

test('isVerbose - should return false by default', () => {
  // Reset to default state
  setVerbose(false)
  strictEqual(isVerbose(), false)
})

test('usePrettyPrint - should return true by default', () => {
  // Reset to default state
  setPrettyPrint(true)
  strictEqual(usePrettyPrint(), true)
})

test('getExecutableId - should return empty string by default', () => {
  // Reset to default state
  setExecutableId('')
  strictEqual(getExecutableId(), '')
})

test('getExecutableName - should return empty string by default', () => {
  // Reset to default state
  setExecutableName('')
  strictEqual(getExecutableName(), '')
})

test('setVerbose - should set verbose state', () => {
  setVerbose(true)
  strictEqual(isVerbose(), true)

  setVerbose(false)
  strictEqual(isVerbose(), false)
})

test('setPrettyPrint - should set pretty print state', () => {
  setPrettyPrint(true)
  strictEqual(usePrettyPrint(), true)

  setPrettyPrint(false)
  strictEqual(usePrettyPrint(), false)
})

test('setExecutableId - should set executable ID', () => {
  setExecutableId('test-id')
  strictEqual(getExecutableId(), 'test-id')

  setExecutableId('another-id')
  strictEqual(getExecutableId(), 'another-id')

  // Reset
  setExecutableId('')
})

test('setExecutableName - should set executable name', () => {
  setExecutableName('test-name')
  strictEqual(getExecutableName(), 'test-name')

  setExecutableName('another-name')
  strictEqual(getExecutableName(), 'another-name')

  // Reset
  setExecutableName('')
})

test('logo - should return logo without color when color is false', () => {
  setExecutableName('TestApp')

  const logoText = logo(false)
  ok(logoText.includes('Welcome to TestApp!'))
  ok(logoText.includes('&'))
  ok(logoText.includes('/'))

  // Reset
  setExecutableName('')
})

test('createCliLogger - should create logger with specified level', () => {
  const logger = createCliLogger('info')
  ok(logger)
  ok(typeof logger.info === 'function')
  ok(typeof logger.error === 'function')
  ok(typeof logger.warn === 'function')
  ok(typeof logger.debug === 'function')
  ok(typeof logger.done === 'function')
})

test('createCliLogger - should create logger with debug level', () => {
  const logger = createCliLogger('debug')
  ok(logger)
  ok(typeof logger.debug === 'function')
})

test('createCliLogger - should create logger with error level', () => {
  const logger = createCliLogger('error')
  ok(logger)
  ok(typeof logger.error === 'function')
})

test('createCliLogger - should have custom done level', () => {
  const logger = createCliLogger('info')
  ok(typeof logger.done === 'function')
})

test('logFatalError - should set process exit code to 1 and return false', () => {
  const originalExitCode = process.exitCode

  const logger = createCliLogger('error')
  const result = logFatalError(logger, 'Test error message')

  strictEqual(process.exitCode, 1)
  strictEqual(result, false)

  // Reset
  process.exitCode = originalExitCode
})

test('logFatalError - should call logger.fatal with provided arguments', () => {
  const originalExitCode = process.exitCode
  let fatalCalled = false
  let fatalArgs = []

  const mockLogger = {
    fatal: (...args) => {
      fatalCalled = true
      fatalArgs = args
    }
  }

  const result = logFatalError(mockLogger, 'Error message', { extra: 'data' })

  strictEqual(process.exitCode, 1)
  strictEqual(result, false)
  ok(fatalCalled)
  strictEqual(fatalArgs[0], 'Error message')
  strictEqual(fatalArgs[1].extra, 'data')

  // Reset
  process.exitCode = originalExitCode
})

test('parseArgs - should parse basic arguments', () => {
  const args = ['--verbose', '--config', 'test.json']
  const options = {
    verbose: { type: 'boolean' },
    config: { type: 'string' }
  }

  const result = parseArgs(args, options)

  strictEqual(result.values.verbose, true)
  strictEqual(result.values.config, 'test.json')
  strictEqual(result.positionals.length, 0)
  strictEqual(result.unparsed.length, 0)
})

test('parseArgs - should parse with positional arguments', () => {
  const args = ['--verbose', 'command', '--extra']
  const options = {
    verbose: { type: 'boolean' }
  }

  const result = parseArgs(args, options)

  strictEqual(result.values.verbose, true)
  strictEqual(result.unparsed.length, 2)
  strictEqual(result.unparsed[0], 'command')
  strictEqual(result.unparsed[1], '--extra')
})

test('parseArgs - should parse without stopping at first positional', () => {
  const args = ['--verbose', 'command', '--config', 'test.json']
  const options = {
    verbose: { type: 'boolean' },
    config: { type: 'string' }
  }

  const result = parseArgs(args, options, false)

  strictEqual(result.values.verbose, true)
  strictEqual(result.values.config, 'test.json')
  strictEqual(result.positionals.length, 1)
  strictEqual(result.positionals[0], 'command')
  strictEqual(result.unparsed.length, 0)
})

test('parseArgs - should handle empty args', () => {
  const args = []
  const options = {}

  const result = parseArgs(args, options)

  strictEqual(Object.keys(result.values).length, 0)
  strictEqual(result.positionals.length, 0)
  strictEqual(result.unparsed.length, 0)
})

test('parseArgs - should handle negative values with equals sign', () => {
  const args = ['--port=-1']
  const options = {
    port: { type: 'string' }
  }

  const result = parseArgs(args, options)

  strictEqual(result.values.port, '-1')
})

test('parseArgs - should return tokens', () => {
  const args = ['--verbose', '--config', 'test.json']
  const options = {
    verbose: { type: 'boolean' },
    config: { type: 'string' }
  }

  const result = parseArgs(args, options)

  ok(Array.isArray(result.tokens))
  ok(result.tokens.length > 0)
})

test('getRoot - should return current working directory when no positionals', () => {
  const result = getRoot()
  strictEqual(result, process.cwd())
})

test('getRoot - should return current working directory when positionals array is empty', () => {
  const result = getRoot([])
  strictEqual(result, process.cwd())
})

test('getRoot - should resolve path from first positional argument', () => {
  const positionals = ['test-dir']
  const result = getRoot(positionals)
  strictEqual(result, join(process.cwd(), 'test-dir'))
})

test('getRoot - should resolve relative path from first positional argument', () => {
  const positionals = ['../test-dir']
  const result = getRoot(positionals)
  strictEqual(result, resolve(process.cwd(), '../test-dir'))
})

test('getRoot - should handle absolute path in first positional argument', () => {
  const absolutePath = resolve('/absolute/path') // Use resolve to have this test pass on Windows
  const positionals = [absolutePath]
  const result = getRoot(positionals)
  strictEqual(result, absolutePath)
})

test('getRoot - should ignore additional positional arguments', () => {
  const positionals = ['test-dir', 'ignored', 'also-ignored']
  const result = getRoot(positionals)
  strictEqual(result, join(process.cwd(), 'test-dir'))
})

test('applicationToEnvVariable - should convert simple application name', () => {
  const result = applicationToEnvVariable('application1')
  strictEqual(result, 'PLT_APPLICATION_APPLICATION1_PATH')
})

test('applicationToEnvVariable - should convert application name with hyphens', () => {
  const result = applicationToEnvVariable('my-application')
  strictEqual(result, 'PLT_APPLICATION_MY_APPLICATION_PATH')
})

test('applicationToEnvVariable - should convert application name with dots', () => {
  const result = applicationToEnvVariable('my.application')
  strictEqual(result, 'PLT_APPLICATION_MY_APPLICATION_PATH')
})

test('applicationToEnvVariable - should convert application name with spaces', () => {
  const result = applicationToEnvVariable('my application')
  strictEqual(result, 'PLT_APPLICATION_MY_APPLICATION_PATH')
})

test('applicationToEnvVariable - should convert application name with special characters', () => {
  const result = applicationToEnvVariable('my@application#123')
  strictEqual(result, 'PLT_APPLICATION_MY_APPLICATION_123_PATH')
})

test('applicationToEnvVariable - should handle lowercase to uppercase conversion', () => {
  const result = applicationToEnvVariable('lowercase')
  strictEqual(result, 'PLT_APPLICATION_LOWERCASE_PATH')
})

test('applicationToEnvVariable - should handle mixed case', () => {
  const result = applicationToEnvVariable('MixedCase')
  strictEqual(result, 'PLT_APPLICATION_MIXEDCASE_PATH')
})

test('applicationToEnvVariable - should handle numbers', () => {
  const result = applicationToEnvVariable('application123')
  strictEqual(result, 'PLT_APPLICATION_APPLICATION123_PATH')
})

test('applicationToEnvVariable - should handle empty string', () => {
  const result = applicationToEnvVariable('')
  strictEqual(result, 'PLT_APPLICATION__PATH')
})

test('findRuntimeConfigurationFile - should find runtime config file', async () => {
  const tmpDir = await mkdtemp(join(tmpdir(), 'plt-test-'))
  const configFile = join(tmpDir, 'platformatic.json')

  await writeFile(
    configFile,
    JSON.stringify({
      $schema: 'https://platformatic.dev/schemas/@platformatic/runtime/2.0.0.json'
    })
  )

  const mockLogger = createCliLogger('info')
  const result = await findRuntimeConfigurationFile(mockLogger, tmpDir)

  strictEqual(result, configFile)

  await unlink(configFile)
  await rmdir(tmpDir)
})

test('findRuntimeConfigurationFile - should find specific config file', async () => {
  const tmpDir = await mkdtemp(join(tmpdir(), 'plt-test-'))
  const configFile = join(tmpDir, 'custom.json')

  await writeFile(
    configFile,
    JSON.stringify({
      $schema: 'https://platformatic.dev/schemas/@platformatic/runtime/2.0.0.json'
    })
  )

  const mockLogger = createCliLogger('info')
  const result = await findRuntimeConfigurationFile(mockLogger, tmpDir, 'custom.json')

  strictEqual(result, configFile)

  await unlink(configFile)
  await rmdir(tmpDir)
})

test('findRuntimeConfigurationFile - should return null when config not found and no fallback', async () => {
  const tmpDir = await mkdtemp(join(tmpdir(), 'plt-test-'))

  const mockLogger = createCliLogger('info')
  const result = await findRuntimeConfigurationFile(mockLogger, tmpDir, undefined, false, false)

  strictEqual(result, null)

  await rmdir(tmpDir)
})

test('findRuntimeConfigurationFile - should return null when throwOnError is false', async () => {
  const tmpDir = await mkdtemp(join(tmpdir(), 'plt-test-'))

  const mockLogger = createCliLogger('info')
  const result = await findRuntimeConfigurationFile(mockLogger, tmpDir, undefined, false, false)

  strictEqual(result, null)

  await rmdir(tmpDir)
})

test('findRuntimeConfigurationFile - should log fatal error when config not found', async () => {
  const tmpDir = await mkdtemp(join(tmpdir(), 'plt-test-'))
  const originalExitCode = process.exitCode

  let fatalCalled = false
  const mockLogger = {
    fatal: () => {
      fatalCalled = true
    }
  }

  setExecutableName('test')
  const result = await findRuntimeConfigurationFile(mockLogger, tmpDir, undefined, false, true)

  strictEqual(result, false)
  strictEqual(process.exitCode, 1)
  ok(fatalCalled)

  // Reset
  process.exitCode = originalExitCode
  setExecutableName('')
  await rmdir(tmpDir)
})

test('findRuntimeConfigurationFile - should fallback to temporary config when allowed', async () => {
  const tmpDir = await mkdtemp(join(tmpdir(), 'plt-test-'))

  // Create a JS file to trigger fallback logic
  await writeFile(join(tmpDir, 'index.js'), 'console.log("test")')

  let warnCalled = false
  const mockLogger = {
    warn: () => {
      warnCalled = true
    }
  }

  const result = await findRuntimeConfigurationFile(mockLogger, tmpDir, undefined, true, false, false)

  strictEqual(result, join(tmpDir, 'watt.json'))
  ok(warnCalled)

  // Clean up
  await unlink(join(tmpDir, 'index.js'))
  await unlink(join(tmpDir, 'watt.json'))
  await rmdir(tmpDir)
})

test('fallbackToTemporaryConfigFile - should return undefined when no JavaScript files', async () => {
  const tmpDir = await mkdtemp(join(tmpdir(), 'plt-test-'))

  // Create a non-JS file
  await writeFile(join(tmpDir, 'README.txt'), 'test')

  const mockLogger = createCliLogger('info')
  const result = await fallbackToTemporaryConfigFile(mockLogger, tmpDir, false)

  strictEqual(result, undefined)

  await unlink(join(tmpDir, 'README.txt'))
  await rmdir(tmpDir)
})

test('fallbackToTemporaryConfigFile - should create watt.json when JS files exist', async () => {
  const tmpDir = await mkdtemp(join(tmpdir(), 'plt-test-'))

  // Create package.json and JS file
  await writeFile(join(tmpDir, 'package.json'), JSON.stringify({}))
  await writeFile(join(tmpDir, 'index.js'), 'console.log("test")')

  let warnCalled = false
  const mockLogger = {
    warn: () => {
      warnCalled = true
    }
  }

  const result = await fallbackToTemporaryConfigFile(mockLogger, tmpDir, false)

  strictEqual(result, join(tmpDir, 'watt.json'))
  ok(warnCalled)

  // Clean up
  await unlink(join(tmpDir, 'package.json'))
  await unlink(join(tmpDir, 'index.js'))
  await unlink(join(tmpDir, 'watt.json'))
  await rmdir(tmpDir)
})

test('fallbackToTemporaryConfigFile - should handle module verification failure', async () => {
  const tmpDir = await mkdtemp(join(tmpdir(), 'plt-test-'))
  const originalExitCode = process.exitCode

  // Create JS file but no package.json with required dependency
  await writeFile(join(tmpDir, 'index.js'), 'console.log("test")')

  let warnCalled = false
  let fatalCalled = false
  const mockLogger = {
    warn: () => {
      warnCalled = true
    },
    fatal: () => {
      fatalCalled = true
    }
  }

  const result = await fallbackToTemporaryConfigFile(mockLogger, tmpDir, true)

  strictEqual(result, false)
  strictEqual(process.exitCode, 1)
  ok(warnCalled)
  ok(fatalCalled)

  // Reset
  process.exitCode = originalExitCode

  // Clean up
  await unlink(join(tmpDir, 'index.js'))
  await unlink(join(tmpDir, 'watt.json')).catch(() => {}) // may not exist
  await rmdir(tmpDir)
})

test('fallbackToTemporaryConfigFile - should skip verification when verifyPackages is false', async () => {
  const tmpDir = await mkdtemp(join(tmpdir(), 'plt-test-'))

  // Create JS file
  await writeFile(join(tmpDir, 'index.js'), 'console.log("test")')

  let warnCalled = false
  const mockLogger = {
    warn: () => {
      warnCalled = true
    }
  }

  const result = await fallbackToTemporaryConfigFile(mockLogger, tmpDir, false)

  strictEqual(result, join(tmpDir, 'watt.json'))
  ok(warnCalled)

  // Clean up
  await unlink(join(tmpDir, 'index.js'))
  await unlink(join(tmpDir, 'watt.json'))
  await rmdir(tmpDir)
})
