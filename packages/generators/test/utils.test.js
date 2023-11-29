'use strict'

const { test, describe } = require('node:test')
const assert = require('node:assert')
const { stripVersion, convertServiceNameToPrefix, addPrefixToEnv, envObjectToString, extractEnvVariablesFromText, getPackageConfigurationObject } = require('../lib/utils')

describe('utils', () => {
  describe('stripVersion', async () => {
    test('should return the same string if not semver', async (t) => {
      assert.equal('no-version', stripVersion('no-version'))
    })

    test('should match semver', async (t) => {
      assert.equal('1.2.3', stripVersion('v1.2.3'))
      assert.equal('1.2.3', stripVersion('~1.2.3'))
      assert.equal('1.2.3', stripVersion('^1.2.3'))
    })
  })

  describe('convertServiceNameToPrefix', () => {
    test('should convert service name to env prefix', async (t) => {
      const expectations = {
        'my-service': 'MY_SERVICE',
        a: 'A',
        MY_SERVICE: 'MY_SERVICE',
        asderas123: 'ASDERAS123'
      }

      Object.entries(expectations).forEach((exp) => {
        const converted = convertServiceNameToPrefix(exp[0])
        assert.equal(exp[1], converted)
      })
    })
  })

  describe('addPrefixToEnv', () => {
    test('Should convert env and add prefix, if neede', async (t) => {
      const testEnv = {
        FOO: 'bar',
        PLT_MY_SERVICE_NAME: 'service',
        DATABASE_URL: 'foobar'
      }

      assert.deepEqual(addPrefixToEnv(testEnv, 'MY_SERVICE'), {
        PLT_MY_SERVICE_FOO: 'bar',
        PLT_MY_SERVICE_NAME: 'service',
        PLT_MY_SERVICE_DATABASE_URL: 'foobar'
      })
    })
  })

  describe('envObjectToString', () => {
    test('should convert env object to string', async () => {
      const env = {
        FOO: 'bar',
        DATABASE_URL: 'sqlite://./db.sqlite'
      }

      assert.equal(envObjectToString(env), 'FOO=bar\nDATABASE_URL=sqlite://./db.sqlite')
    })
  })

  describe('extractEnvVariablesFromText', () => {
    test('should extract env vars from text', async () => {
      const text = `
      This is a sample text where an {ENV_VAR} should be detected
      
      DATABASE_URL={DATABASE_URL}
      `
      const env = extractEnvVariablesFromText(text)
      assert.deepEqual(env, ['ENV_VAR', 'DATABASE_URL'])
    })

    test('should not extract {} as empty env var', async () => {
      const text = `This is a sample text where an {ENV_VAR} should be detected
        but this {} should not be parsed
      `
      const env = extractEnvVariablesFromText(text)
      assert.deepEqual(env, ['ENV_VAR'])
    })

    test('should return empty array if no env vars are detected', async () => {
      const text = 'This is a sample text without any env var. This {} should not be parsed'
      const env = extractEnvVariablesFromText(text)
      assert.deepEqual(env, [])
    })
  })

  describe('getPackageConfigurationObject', async () => {
    const input = [
      {
        path: 'prefix',
        value: '/foo',
        type: 'string'
      },
      {
        path: 'foo.fooOption1',
        value: 'value1',
        type: 'string'
      },
      {
        path: 'foo.fooOption2',
        value: 'value2',
        type: 'string'
      },
      {
        path: 'foobar',
        value: '123',
        type: 'number'
      },
      {
        path: 'boolean.truthy',
        value: 'true',
        type: 'boolean'
      },
      {
        path: 'boolean.falsey',
        value: 'false',
        type: 'boolean'
      }
    ]
    const config = getPackageConfigurationObject(input)
    assert.deepEqual(config, {
      prefix: '/foo',
      foo: {
        fooOption1: 'value1',
        fooOption2: 'value2'
      },
      foobar: 123,
      boolean: {
        truthy: true,
        falsey: false
      }
    })

    // should throw
    try {
      getPackageConfigurationObject([
        {
          path: 'wrong',
          type: 'object',
          value: {}
        }
      ])
      assert.fail()
    } catch (err) {
      assert.equal(err.code, 'PLT_GEN_WRONG_TYPE')
      assert.equal(err.message, 'Invalid value type. Accepted values are \'string\', \'number\' and \'boolean\', found \'object\'.')
    }
  })
})
