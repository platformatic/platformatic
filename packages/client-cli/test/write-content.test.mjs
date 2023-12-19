'use strict'

import { test } from 'tap'
import { writeContent } from '../lib/openapi-common.mjs'
import CodeBlockWriter from 'code-block-writer'

function getWriter () {
  return new CodeBlockWriter({
    indentNumberOfSpaces: 2,
    useTabs: false,
    useSingleQuote: true
  })
}
test('support array of objects', async (t) => {
  const writer = getWriter()
  const content = {
    'application/json': {
      schema: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'number' },
            name: { type: 'string' }
          },
          required: ['id']
        }
      }
    }
  }
  const isResponseArray = writeContent(writer, 'MyResponseTypeName', content, {}, new Set())
  t.equal(writer.toString(), `export type MyResponseTypeName = Array<{
  'id': number;
  'name'?: string;
}>`)
  t.equal(isResponseArray, true)
})

test('support object', async (t) => {
  const writer = getWriter()
  const content = {
    'application/json': {
      schema: {
        type: 'object',
        properties: {
          id: { type: 'number' },
          name: { type: 'string' }
        },
        required: ['id']
      }
    }
  }
  const isResponseArray = writeContent(writer, 'MyResponseTypeName', content, {}, new Set())
  t.equal(writer.toString(), `export type MyResponseTypeName = {
  'id': number;
  'name'?: string;
}`)
  t.equal(isResponseArray, false)
})

test('support array of mixed stuff', async (t) => {
  const writer = getWriter()
  const content = {
    'application/json': {
      schema: {
        items: {
          allOf: [
            {
              properties: {
                id: {
                  type: 'string'
                }
              },
              required: ['id'],
              type: 'object'
            },
            {
              anyOf: [
                {
                  additionalProperties: false,
                  properties: {
                    age: {
                      type: 'number'
                    }
                  },
                  required: ['age'],
                  type: 'object'
                },
                {
                  additionalProperties: false,
                  properties: {
                    valid: {
                      type: 'boolean'
                    }
                  },
                  required: ['valid'],
                  type: 'object'
                }
              ]
            }
          ]
        },
        type: 'array'
      }
    }
  }
  const isResponseArray = writeContent(writer, 'MyResponseTypeName', content, {}, new Set())
  t.equal(writer.toString(), `export type MyResponseTypeName = Array<{ id: string } & { age: number } | { valid: boolean }>
`)
  t.equal(isResponseArray, true)
})

test('support mixed stuff', async (t) => {
  const writer = getWriter()
  const content = {
    'application/json': {
      schema: {
        allOf: [
          {
            properties: {
              id: {
                type: 'string'
              }
            },
            required: ['id'],
            type: 'object'
          },
          {
            anyOf: [
              {
                additionalProperties: false,
                properties: {
                  age: {
                    type: 'number'
                  }
                },
                required: ['age'],
                type: 'object'
              },
              {
                additionalProperties: false,
                properties: {
                  valid: {
                    type: 'boolean'
                  }
                },
                required: ['valid'],
                type: 'object'
              }
            ]
          }
        ]
      }
    }
  }
  const isResponseArray = writeContent(writer, 'MyResponseTypeName', content, {}, new Set())
  t.equal(writer.toString(), 'export type MyResponseTypeName = { id: string } & { age: number } | { valid: boolean }')
  t.equal(isResponseArray, false)
})

test('support array of $ref', async (t) => {
  const writer = getWriter()
  const spec = {
    components: {
      schemas: {
        Movie: {
          title: 'Movie',
          description: 'A Movie',
          type: 'object',
          properties: {
            id: {
              type: 'integer'
            },
            title: {
              type: 'string'
            }
          },
          required: [
            'title'
          ]
        }
      }
    }
  }
  const content = {
    'application/json': {
      schema: {
        type: 'array',
        items: {
          $ref: '#/components/schemas/Movie'
        }
      }
    }
  }
  const isResponseArray = writeContent(writer, 'MyResponseTypeName', content, spec, new Set())
  t.equal(writer.toString().trim(), 'export type MyResponseTypeName = Array<{ id?: number; title: string }>')
  t.equal(isResponseArray, true)
})

test('support $ref', async (t) => {
  const writer = getWriter()
  const spec = {
    components: {
      schemas: {
        Movie: {
          title: 'Movie',
          description: 'A Movie',
          type: 'object',
          properties: {
            id: {
              type: 'integer'
            },
            title: {
              type: 'string'
            }
          },
          required: [
            'title'
          ]
        }
      }
    }
  }
  const content = {
    'application/json': {
      schema: {
        $ref: '#/components/schemas/Movie'
      }
    }
  }
  const isResponseArray = writeContent(writer, 'MyResponseTypeName', content, spec, new Set())
  t.equal(writer.toString().trim(), 'export type MyResponseTypeName = { id?: number; title: string }')
  t.equal(isResponseArray, false)
})

test('convert to unknown', async (t) => {
  const writer = getWriter()
  const content = {
    'application/json': {
      schema: {
        type: 'foobar'
      }
    }
  }
  writeContent(writer, 'MyResponseTypeName', content, {}, new Set())
  t.equal(writer.toString(), 'export type MyResponseTypeName = unknown')
})
