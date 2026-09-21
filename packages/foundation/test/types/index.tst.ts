import type { JSONSchemaType } from 'ajv'
import type { ParseArgsOptionsConfig } from 'node:util'
import type { Logger } from 'pino'
import { describe, expect, test } from 'tstyche'
import {
  applicationToEnvVariable,
  applications,
  createCLIContext,
  createCliLogger,
  fallbackToTemporaryConfigFile,
  findRuntimeConfigurationFile,
  getRoot,
  loadConfigurationModule,
  logFatalError,
  logo,
  parseArgs,
  validate,
  type ConfigurationModule,
  type ConfigurationOptions
} from '../../index.js'

describe('createCLIContext', () => {
  test('with no arguments', () => {
    const context = createCLIContext()
    expect(context).type.toBe<{
      executableId: string
      executableName: string
      verbose: boolean
      prettyPrint: boolean
    }>()
  })

  test('with all arguments', () => {
    const context = createCLIContext('id', 'name', true, false, { custom: 'value' })
    expect(context).type.toBe<{
      executableId: string
      executableName: string
      verbose: boolean
      prettyPrint: boolean
      custom: string
    }>()
  })

  test('with partial arguments', () => {
    const context = createCLIContext('id', 'name')
    expect(context).type.toBe<{
      executableId: string
      executableName: string
      verbose: boolean
      prettyPrint: boolean
    }>()
  })

  test('with custom options object', () => {
    const options = { port: 3000, host: 'localhost' }
    const context = createCLIContext('id', 'name', true, true, options)
    expect(context).type.toBe<{
      executableId: string
      executableName: string
      verbose: boolean
      prettyPrint: boolean
      port: number
      host: string
    }>()
  })

  test('infers generic type from options', () => {
    const context = createCLIContext('id', 'name', false, false, {
      debug: true,
      timeout: 5000,
      tags: ['app', 'cli']
    })
    expect(context).type.toBe<{
      executableId: string
      executableName: string
      verbose: boolean
      prettyPrint: boolean
      debug: boolean
      timeout: number
      tags: string[]
    }>()
  })

  test('with explicit generic type', () => {
    interface CustomOptions {
      apiUrl: string
      retries: number
    }
    const context = createCLIContext<CustomOptions>(
      'id',
      'name',
      true,
      false,
      { apiUrl: 'https://api.example.com', retries: 3 }
    )
    expect(context).type.toBe<{
      executableId: string
      executableName: string
      verbose: boolean
      prettyPrint: boolean
      apiUrl: string
      retries: number
    }>()
  })

  test('with empty options object', () => {
    const context = createCLIContext('id', 'name', true, true, {})
    expect(context).type.toBe<{
      executableId: string
      executableName: string
      verbose: boolean
      prettyPrint: boolean
    }>()
  })
})

describe('logo', () => {
  test('with no arguments', () => {
    const result = logo()
    expect(result).type.toBe<string>()
  })

  test('with color argument', () => {
    const result = logo(true)
    expect(result).type.toBe<string>()
  })

  test('with color and name arguments', () => {
    const result = logo(false, 'MyApp')
    expect(result).type.toBe<string>()
  })
})

describe('createCliLogger', () => {
  test('returns Logger', () => {
    const logger = createCliLogger('info', false)
    expect(logger).type.toBe<Logger>()
  })

  test('with noPretty true', () => {
    const logger = createCliLogger('debug', true)
    expect(logger).type.toBe<Logger>()
  })
})

describe('logFatalError', () => {
  test('returns false', () => {
    const logger: Logger = {} as Logger
    const result = logFatalError(logger, 'error message')
    expect(result).type.toBe<false>()
  })

  test('with multiple args', () => {
    const logger: Logger = {} as Logger
    const result = logFatalError(logger, 'msg1', 'msg2', { data: 'value' })
    expect(result).type.toBe<false>()
  })
})

describe('parseArgs', () => {
  test('with required arguments', () => {
    const options: ParseArgsOptionsConfig = { flag: { type: 'boolean' } }
    const result = parseArgs(['--flag'], options)
    expect(result).type.toBe<{
      values: Record<string, any>
      positionals: string[]
      unparsed: string[]
      tokens: any[]
    }>()
  })

  test('with stopAtFirstPositional', () => {
    const options: ParseArgsOptionsConfig = { flag: { type: 'boolean' } }
    const result = parseArgs(['--flag', 'pos'], options, true)
    expect(result).type.toBe<{
      values: Record<string, any>
      positionals: string[]
      unparsed: string[]
      tokens: any[]
    }>()
  })

  test('with strict mode', () => {
    const options: ParseArgsOptionsConfig = { flag: { type: 'boolean' } }
    const result = parseArgs(['--flag'], options, false, true)
    expect(result).type.toBe<{
      values: Record<string, any>
      positionals: string[]
      unparsed: string[]
      tokens: any[]
    }>()
  })
})

describe('getRoot', () => {
  test('with no positionals', () => {
    const root = getRoot()
    expect(root).type.toBe<string>()
  })

  test('with empty positionals array', () => {
    const root = getRoot([])
    expect(root).type.toBe<string>()
  })

  test('with positionals', () => {
    const root = getRoot(['./src'])
    expect(root).type.toBe<string>()
  })
})

describe('applicationToEnvVariable', () => {
  test('returns string', () => {
    const envVar = applicationToEnvVariable('myApp')
    expect(envVar).type.toBe<string>()
  })

  test('with special characters', () => {
    const envVar = applicationToEnvVariable('my-app@1.0')
    expect(envVar).type.toBe<string>()
  })
})

describe('findRuntimeConfigurationFile', () => {
  test('returns promise', () => {
    const logger: Logger = {} as Logger
    const result = findRuntimeConfigurationFile(logger, '/root')
    expect(result).type.toBe<Promise<string | false | undefined>>()
  })

  test('with required arguments', async () => {
    const logger: Logger = {} as Logger
    const result = await findRuntimeConfigurationFile(logger, '/root')
    expect(result).type.toBe<string | false | undefined>()
  })

  test('with all arguments', async () => {
    const logger: Logger = {} as Logger
    const result = await findRuntimeConfigurationFile(
      logger,
      '/root',
      'config.json',
      true,
      false,
      true,
      'myApp'
    )
    expect(result).type.toBe<string | false | undefined>()
  })
})

describe('fallbackToTemporaryConfigFile', () => {
  test('returns promise', () => {
    const logger: Logger = {} as Logger
    const result = fallbackToTemporaryConfigFile(logger, '/root', true)
    expect(result).type.toBe<Promise<string | false | undefined>>()
  })

  test('with verifyPackages false', async () => {
    const logger: Logger = {} as Logger
    const result = await fallbackToTemporaryConfigFile(logger, '/root', false)
    expect(result).type.toBe<string | false | undefined>()
  })
})

describe('validate', () => {
  test('with a single object config', () => {
    const schema = {} as JSONSchemaType<any>
    expect(validate(schema, { foo: 'bar' })).type.toBe<void>()
    expect(validate(schema, { foo: 'bar' }, {}, true, '/root')).type.toBe<void>()
  })

  test('with an array config (the exported `applications` schema)', () => {
    // Cast needed purely due to an unrelated ajv `exactOptionalPropertyTypes`
    // strictness gap between `JSONSchemaType<object[]>` and `JSONSchemaType<any>`
    // - orthogonal to the array-vs-object `config` fix under test here.
    const schema = applications as JSONSchemaType<any>
    expect(validate(schema, [{ id: 'api' }])).type.toBe<void>()
    expect(validate(schema, [{ id: 'api' }], {}, true, '/root')).type.toBe<void>()
  })
})

describe('loadConfigurationModule', () => {
  test('with required arguments', async () => {
    const result = await loadConfigurationModule('/root', { module: '@platformatic/service' })
    expect(result).type.toBe<ConfigurationModule>()
    expect(result.loadConfiguration).type.toBe<((configPath: string) => Promise<unknown>) | undefined>()
  })

  test('with an explicit pkg override', async () => {
    const result = await loadConfigurationModule('/root', {}, '@platformatic/basic')
    expect(result).type.toBe<ConfigurationModule>()
  })
})

describe('ConfigurationOptions', () => {
  test('transform is invoked with three arguments', () => {
    const options: ConfigurationOptions = {
      isProduction: true,
      transform: async (config, schema, transformOptions) => {
        expect(config).type.toBe<typeof config>()
        expect(schema).type.toBe<object>()
        expect(transformOptions).type.toBe<ConfigurationOptions>()
        return config
      }
    }

    expect(options.isProduction).type.toBe<boolean | undefined>()
  })

  test('a one-argument transform hook remains assignable', () => {
    const options: ConfigurationOptions = {
      transform: async config => config
    }

    expect(options.transform).type.not.toBe<undefined>()
  })
})
