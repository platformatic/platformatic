import { test } from 'node:test'
import assert from 'node:assert'
import { requestBodyParser } from '../lib/body-parser.mjs'

test('should parse arrays', () => {
  const fullSpec = {}
  const requestBody = {
    content: {
      'application/json': {
        schema: {
          items: {
            properties: {
              foo: { type: 'string' },
              baz: { type: 'string' }
            },
            type: 'object'
          },
          type: 'array'
        }
      }
    }
  }

  const expected = 'Array<{ \'foo\'?: string; \'baz\'?: string }>'
  const expectedFull = 'body: Array<{ \'foo\'?: string; \'baz\'?: string }>'
  assert.equal(requestBodyParser(requestBody, fullSpec, false), expected)
  assert.equal(requestBodyParser(requestBody, fullSpec, true), expectedFull)
})

test('should parse object', () => {
  const fullSpec = {}
  const requestBody = {
    content: {
      'application/json': {
        schema: {
          properties: {
            foo: { type: 'string' },
            baz: { type: 'string' }
          },
          type: 'object'
        }
      }
    }
  }

  const expected = '{ \'foo\'?: string; \'baz\'?: string }'
  const expectedFull = 'body: { \'foo\'?: string; \'baz\'?: string }'
  assert.equal(requestBodyParser(requestBody, fullSpec, false), expected)
  assert.equal(requestBodyParser(requestBody, fullSpec, true), expectedFull)
})

test.only('should parse complex arrays (with anyOf)', () => {
  const fullSpec = {}
  const requestBody = {
    content: {
      'application/json': {
        schema: {
          items: {
            anyOf: [
              {
                additionalProperties: false,
                properties: {
                  codeType: {
                    enum: ['customField'],
                    type: 'string'
                  },
                  externalId: {},
                  internalId: {
                    type: 'string'
                  },
                  kind: {
                    enum: ['mapped'],
                    type: 'string'
                  }
                },
                required: ['kind', 'codeType', 'internalId', 'externalId'],
                type: 'object'
              },
              {
                additionalProperties: false,
                properties: {
                  codeType: {
                    enum: ['costCenter'],
                    type: 'string'
                  },
                  externalId: {},
                  kind: {
                    enum: ['mapped'],
                    type: 'string'
                  }
                },
                required: ['kind', 'codeType', 'externalId'],
                type: 'object'
              },
              {
                additionalProperties: false,
                properties: {
                  externalId: {},
                  kind: {
                    enum: ['notMapped'],
                    type: 'string'
                  }
                },
                required: ['kind', 'externalId'],
                type: 'object'
              }
            ]
          },
          type: 'array'
        }
      }
    }
  }
  const expected = 'Array<{ \'codeType\': \'customField\'; \'externalId\': unknown; \'internalId\': string; \'kind\': \'mapped\' } | { \'codeType\': \'costCenter\'; \'externalId\': unknown; \'kind\': \'mapped\' } | { \'externalId\': unknown; \'kind\': \'notMapped\' }>'
  const expectedFull = 'body: Array<{ \'codeType\': \'customField\'; \'externalId\': unknown; \'internalId\': string; \'kind\': \'mapped\' } | { \'codeType\': \'costCenter\'; \'externalId\': unknown; \'kind\': \'mapped\' } | { \'externalId\': unknown; \'kind\': \'notMapped\' }>'

  assert.equal(requestBodyParser(requestBody, fullSpec, false), expected)
  assert.equal(requestBodyParser(requestBody, fullSpec, true), expectedFull)
})
