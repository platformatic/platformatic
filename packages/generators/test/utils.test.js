'use strict'

const { test, describe } = require('node:test')
const { EOL } = require('node:os')
const assert = require('node:assert')
const {
  convertApplicationNameToPrefix,
  envObjectToString,
  extractEnvVariablesFromText,
  getPackageConfigurationObject,
  addPrefixToString
} = require('../lib/utils')
const { flattenObject } = require('../lib/utils')
const { getApplicationTemplateFromSchemaUrl } = require('../lib/utils')
const { envStringToObject } = require('../lib/utils')

describe('utils', () => {
  describe('convertApplicationNameToPrefix', () => {
    test('should convert application name to env prefix', async t => {
      const expectations = {
        'my-application': 'MY_APPLICATION',
        a: 'A',
        MY_APPLICATION: 'MY_APPLICATION',
        asderas123: 'ASDERAS123'
      }

      Object.entries(expectations).forEach(exp => {
        const converted = convertApplicationNameToPrefix(exp[0])
        assert.equal(exp[1], converted)
      })
    })
  })

  describe('envObjectToString', () => {
    test('should convert env object to string', async () => {
      const env = {
        FOO: 'bar',
        DATABASE_URL: 'sqlite://./db.sqlite'
      }

      assert.equal(envObjectToString(env), `FOO=bar${EOL}DATABASE_URL=sqlite://./db.sqlite`)
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
        path: 'foo.fooOption3',
        value: 'value3',
        type: 'string',
        name: 'THE_FOO_OPTION_3'
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
    const output = getPackageConfigurationObject(input)
    assert.deepEqual(output.config, {
      prefix: '/foo',
      foo: {
        fooOption1: 'value1',
        fooOption2: 'value2',
        fooOption3: '{THE_FOO_OPTION_3}'
      },
      foobar: 123,
      boolean: {
        truthy: true,
        falsey: false
      }
    })

    assert.deepEqual(output.env, {
      THE_FOO_OPTION_3: 'value3'
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
      assert.equal(
        err.message,
        "Invalid value type. Accepted values are 'string', 'number' and 'boolean', found 'object'."
      )
    }
  })

  describe('addPrefixToString', () => {
    test('should add prefix to string', async () => {
      assert.equal(addPrefixToString('PLT_APPLICATION_FOO', 'APPLICATION'), 'PLT_APPLICATION_FOO')
      assert.equal(addPrefixToString('FOO', 'APPLICATION'), 'PLT_APPLICATION_FOO')
      assert.equal(addPrefixToString('FOO', ''), 'FOO')
    })
  })

  describe('flattenObject', () => {
    test('should return a single depth object', () => {
      const packageObject = {
        name: '@fastify/oauth2',
        options: {
          name: '{PLT_RIVAL_FST_PLUGIN_OAUTH2_NAME}',
          credentials: {
            client: {
              id: '{PLT_RIVAL_FST_PLUGIN_OAUTH2_CREDENTIALS_CLIENT_ID}',
              secret: '{PLT_RIVAL_FST_PLUGIN_OAUTH2_CREDENTIALS_CLIENT_SECRET}'
            }
          },
          startRedirectPath: '{PLT_RIVAL_FST_PLUGIN_OAUTH2_REDIRECT_PATH}',
          callbackUri: '{PLT_RIVAL_FST_PLUGIN_OAUTH2_CALLBACK_URI}'
        }
      }
      const expected = {
        name: '@fastify/oauth2',
        'options.name': '{PLT_RIVAL_FST_PLUGIN_OAUTH2_NAME}',
        'options.credentials.client.id': '{PLT_RIVAL_FST_PLUGIN_OAUTH2_CREDENTIALS_CLIENT_ID}',
        'options.credentials.client.secret': '{PLT_RIVAL_FST_PLUGIN_OAUTH2_CREDENTIALS_CLIENT_SECRET}',
        'options.startRedirectPath': '{PLT_RIVAL_FST_PLUGIN_OAUTH2_REDIRECT_PATH}',
        'options.callbackUri': '{PLT_RIVAL_FST_PLUGIN_OAUTH2_CALLBACK_URI}'
      }
      assert.deepEqual(flattenObject(packageObject), expected)
    })
  })

  describe('getApplicationTemplateFromSchemaUrl', () => {
    test('should get the right template name from schema url', () => {
      const composerSchema = 'https://schemas.platformatic.dev/@platformatic/composer/1.52.0.json'
      const applicationSchema = 'https://schemas.platformatic.dev/@platformatic/service/1.52.0.json'
      const dbSchema = 'https://schemas.platformatic.dev/@platformatic/db/1.52.0.json'

      assert.equal(getApplicationTemplateFromSchemaUrl(composerSchema), '@platformatic/composer')
      assert.equal(getApplicationTemplateFromSchemaUrl(applicationSchema), '@platformatic/service')
      assert.equal(getApplicationTemplateFromSchemaUrl(dbSchema), '@platformatic/db')
    })
  })

  describe('envStringToObject', () => {
    test('should convert .env-like string to object', () => {
      const template = [
        '',
        '# this is a comment that will be not parsed',
        'MY_VAR=value',
        'PLT_APPLICATION_NAME_FOOBAR=foobar'
      ]

      const expected = {
        MY_VAR: 'value',
        PLT_APPLICATION_NAME_FOOBAR: 'foobar'
      }

      assert.deepEqual(envStringToObject(template.join(EOL)), expected)
    })
  })
})
