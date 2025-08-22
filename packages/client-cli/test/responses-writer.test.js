import CodeBlockWriter from 'code-block-writer'
import assert from 'node:assert'
import { test } from 'node:test'
import { responsesWriter } from '../lib/responses-writer.js'

function getWriter () {
  return new CodeBlockWriter({
    indentNumberOfSpaces: 2,
    useTabs: false,
    useSingleQuote: true
  })
}

test('support multiple responses', async () => {
  const writer = getWriter()
  const responses = {
    200: {
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              id: { type: 'number' },
              'unfriendly-key': { type: 'string' }
            },
            required: ['id']
          }
        }
      }
    },
    403: {
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              message: { type: 'string' }
            },
            required: ['message']
          }
        }
      }
    }
  }

  const output = responsesWriter('MyOperation', responses, false, writer)
  const expected = `
export type MyOperationResponseOK = { 'id': number; 'unfriendly-key'?: string }
export type MyOperationResponseForbidden = { 'message': string }
export type MyOperationResponses =
  MyOperationResponseOK
  | MyOperationResponseForbidden`

  assert.equal(writer.toString().trim(), expected.trim())
  assert.equal(output, 'MyOperationResponses')
})

test('tsdoc comment with response description and summary properties', async () => {
  const writer = getWriter()
  const responses = {
    200: {
      description: 'Response description',
      summary: 'Response summary',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              id: { type: 'number' },
              'unfriendly-key': { type: 'string' }
            },
            required: ['id']
          }
        }
      }
    },
    403: {
      description: 'Response description',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              message: { type: 'string' }
            },
            required: ['message']
          }
        }
      }
    }
  }

  const output = responsesWriter('MyOperation', responses, false, writer)
  const expected = `
/**
 * Response summary
 *
 * Response description
 */
export type MyOperationResponseOK = { 'id': number; 'unfriendly-key'?: string }
/**
 * Response description
 */
export type MyOperationResponseForbidden = { 'message': string }
export type MyOperationResponses =
  MyOperationResponseOK
  | MyOperationResponseForbidden`

  assert.equal(writer.toString().trim(), expected.trim())
  assert.equal(output, 'MyOperationResponses')
})

test('support array of objects', async () => {
  const writer = getWriter()
  const responses = {
    200: {
      content: {
        'application/json': {
          schema: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'number' },
                'unfriendly-key': { type: 'string' }
              },
              required: ['id']
            }
          }
        }
      }
    }
  }

  responsesWriter('MyOperation', responses, false, writer)
  assert.equal(
    writer.toString().trim(),
    `export type MyOperationResponseOK = Array<{ 'id': number; 'unfriendly-key'?: string }>
export type MyOperationResponses =
  MyOperationResponseOK`
  )
})

test('support object', async () => {
  const writer = getWriter()
  const responses = {
    200: {
      content: {
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
    }
  }
  responsesWriter('TheOperationId', responses, false, writer)
  assert.equal(
    writer.toString().trim(),
    `
export type TheOperationIdResponseOK = { 'id': number; 'name'?: string }
export type TheOperationIdResponses =
  TheOperationIdResponseOK
`.trim()
  )
})

test('support 204 without full response', async () => {
  const writer = getWriter()
  const responses = {
    204: {
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              fantozzi: { type: 'number' },
              filini: { type: 'string' }
            },
            required: ['fantozzi']
          }
        }
      }
    }
  }
  responsesWriter('FantozziFilini', responses, false, writer)
  assert.equal(
    writer.toString().trim(),
    `export type FantozziFiliniResponseNoContent = { 'fantozzi': number; 'filini'?: string }
export type FantozziFiliniResponses =
  undefined
`.trim(),
    'result without full response'
  )
})

test('support 204 with full response', async () => {
  const writer = getWriter()
  const responses = {
    204: {
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              filini: { type: 'number' },
              fantozzi: { type: 'string' }
            },
            required: ['filini']
          }
        }
      }
    }
  }
  responsesWriter('FiliniFantozzi', responses, true, writer)
  assert.equal(
    writer.toString().trim(),
    `export type FiliniFantozziResponseNoContent = { 'filini': number; 'fantozzi'?: string }
export type FiliniFantozziResponses =
  FullResponse<undefined, 204>
`.trim(),
    'result with full response'
  )
})

test('support array of allOf structure', async () => {
  const writer = getWriter()
  const responses = {
    200: {
      content: {
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
    }
  }
  responsesWriter('MyOperation', responses, false, writer)
  assert.equal(
    writer.toString().trim(),
    `
export type MyOperationResponseOK = Array<{ 'id': string } & { 'age': number } | { 'valid': boolean }>
export type MyOperationResponses =
  MyOperationResponseOK
`.trim()
  )
})

test('support allOf structure', async () => {
  const writer = getWriter()
  const responses = {
    200: {
      content: {
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
    }
  }
  responsesWriter('MyOperation', responses, false, writer)
  assert.equal(
    writer.toString().trim(),
    `
export type MyOperationResponseOK = { 'id': string } & { 'age': number } | { 'valid': boolean }
export type MyOperationResponses =
  MyOperationResponseOK
`.trim()
  )
})

test('convert to unknown', async () => {
  const writer = getWriter()
  const responses = {
    200: {
      content: {
        'application/json': {
          schema: {
            type: 'foobar'
          }
        }
      }
    }
  }
  responsesWriter('MyOperation', responses, false, writer)
  assert.equal(
    writer.toString().trim(),
    `
export type MyOperationResponseOK = unknown
export type MyOperationResponses =
  MyOperationResponseOK`.trim()
  )
})

test('support anyOf structure', async () => {
  const writer = getWriter()
  const responses = {
    200: {
      content: {
        'application/json': {
          schema: {
            anyOf: [
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
                allOf: [
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
    }
  }
  responsesWriter('MyOperation', responses, false, writer)
  assert.equal(
    writer.toString().trim(),
    `
export type MyOperationResponseOK = { 'id': string } | { 'age': number } & { 'valid': boolean }
export type MyOperationResponses =
  MyOperationResponseOK
`.trim()
  )
})

test('support array of anyOf structure', async () => {
  const writer = getWriter()
  const responses = {
    200: {
      content: {
        'application/json': {
          schema: {
            type: 'array',
            items: {
              anyOf: [
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
                  allOf: [
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
      }
    }
  }
  responsesWriter('MyOperation', responses, false, writer)
  assert.equal(
    writer.toString().trim(),
    `
export type MyOperationResponseOK = Array<{ 'id': string } | { 'age': number } & { 'valid': boolean }>
export type MyOperationResponses =
  MyOperationResponseOK
`.trim()
  )
})

test('support array of $ref', async () => {
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
          required: ['title']
        }
      }
    }
  }
  const responses = {
    200: {
      content: {
        'application/json': {
          schema: {
            type: 'array',
            items: {
              $ref: '#/components/schemas/Movie'
            }
          }
        }
      }
    }
  }
  responsesWriter('MyOperation', responses, false, writer, spec)
  const expected = `
export type MyOperationResponseOK = Array<{ 'id'?: number; 'title': string }>
export type MyOperationResponses =
  MyOperationResponseOK`.trim()
  assert.equal(writer.toString().trim(), expected)
})

test('support $ref', async () => {
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
          required: ['title']
        }
      }
    }
  }
  const responses = {
    200: {
      content: {
        'application/json': {
          schema: {
            $ref: '#/components/schemas/Movie'
          }
        }
      }
    }
  }
  responsesWriter('MyOperation', responses, false, writer, spec)
  const expected = `
export type MyOperationResponseOK = { 'id'?: number; 'title': string }
export type MyOperationResponses =
  MyOperationResponseOK`.trim()
  assert.equal(writer.toString().trim(), expected)
})

test('support discriminator object', async () => {
  const writer = getWriter()
  const spec = {
    components: {
      schemas: {
        Cat: {
          type: 'object',
          properties: {
            cuddle: { type: 'boolean' },
            petType: { type: 'string' },
            breed: { type: 'string' }
          },
          required: ['petType']
        },
        Dog: {
          type: 'object',
          properties: {
            bark: { type: 'boolean' },
            petType: { type: 'string' }
          }
        }
      }
    }
  }
  const responses = {
    200: {
      content: {
        'application/json': {
          schema: {
            oneOf: [{ $ref: '#/components/schemas/Dog' }, { $ref: '#/components/schemas/Cat' }],
            discriminator: {
              propertyName: 'petType'
            }
          }
        }
      }
    }
  }
  responsesWriter('MyOperation', responses, false, writer, spec)
  const expected = `
export type MyOperationResponseOK = { 'bark'?: boolean; 'petType'?: 'Dog' } | { 'cuddle'?: boolean; 'petType': 'Cat'; 'breed'?: string }
export type MyOperationResponses =
  MyOperationResponseOK`.trim()
  assert.equal(writer.toString().trim(), expected)
})
