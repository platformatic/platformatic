'use strict'

const assert = require('node:assert/strict')
const { test } = require('node:test')
const { join } = require('node:path')
const { tmpdir } = require('node:os')
const { mkdtemp, cp, rm, readFile } = require('node:fs/promises')
const { generateSchema } = require('./helper.js')

test('should generate an openapi schema from a ts app', async (t) => {
  const cwd = await mkdtemp(join(tmpdir(), 'fastify-rpc-'))
  t.after(() => rm(cwd, { recursive: true }))

  const fixtureDir = join(__dirname, 'fixtures', 'ts-app-1')
  await cp(fixtureDir, cwd, { recursive: true })

  const schemaPath = join(cwd, 'openapi.json')
  const tsConfigPath = join(cwd, 'tsconfig.json')

  await generateSchema(schemaPath, tsConfigPath, { cwd })

  const openapiSchemaFile = await readFile(schemaPath, 'utf8')
  const openapiSchema = JSON.parse(openapiSchemaFile)

  assert.deepStrictEqual(openapiSchema, {
    openapi: '3.0.0',
    info: {
      title: 'Platformatic RPC',
      version: '1.0.0',
    },
    paths: {
      '/addUser': {
        post: {
          operationId: 'addUser',
          requestBody: {
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/addUserArgs',
                },
              },
            },
          },
          responses: {
            200: {
              description: 'Success',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/addUserReturnType',
                  },
                },
              },
            },
          },
        },
      },
      '/getUsers': {
        post: {
          operationId: 'getUsers',
          requestBody: {
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/getUsersArgs',
                },
              },
            },
          },
          responses: {
            200: {
              description: 'Success',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/getUsersReturnType',
                  },
                },
              },
            },
          },
        },
      },
      '/getGroupByName': {
        post: {
          operationId: 'getGroupByName',
          requestBody: {
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/getGroupByNameArgs',
                },
              },
            },
          },
          responses: {
            200: {
              description: 'Success',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/getGroupByNameReturnType',
                  },
                },
              },
            },
          },
        },
      },
      '/getRecursiveNode': {
        post: {
          operationId: 'getRecursiveNode',
          responses: {
            200: {
              description: 'Success',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/getRecursiveNodeReturnType',
                  },
                },
              },
            },
          },
        },
      },
    },
    components: {
      schemas: {
        addUserArgs: {
          type: 'object',
          properties: {
            user: {
              type: 'object',
              properties: {
                name: {
                  type: 'string',
                },
                age: {
                  type: 'number',
                },
              },
              additionalProperties: false,
              required: ['age', 'name'],
            },
          },
          additionalProperties: false,
          required: ['user'],
        },
        addUserReturnType: {
          type: 'object',
          properties: {},
        },
        getUsersArgs: {
          type: 'object',
          properties: {
            maxAge: {
              type: 'number',
            },
          },
          additionalProperties: false,
          required: ['maxAge'],
        },
        getUsersReturnType: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: {
                type: 'string',
              },
              age: {
                type: 'number',
              },
            },
            additionalProperties: false,
            required: ['age', 'name'],
          },
        },
        getGroupByNameArgs: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
            },
          },
          additionalProperties: false,
          required: ['name'],
        },
        getGroupByNameReturnType: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
            },
            users: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: {
                    type: 'string',
                  },
                  age: {
                    type: 'number',
                  },
                },
                additionalProperties: false,
                required: [
                  'age',
                  'name',
                ],
              },
            },
          },
          additionalProperties: false,
          required: ['users'],
        },
        getRecursiveNodeReturnType: {
          $ref: '#/components/schemas/Node',
        },
        Node: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
            },
            nodes: {
              type: 'array',
              items: {
                anyOf: [
                  {
                    $ref: '#/components/schemas/Node',
                  },
                  {
                    type: 'null',
                  },
                ],
              },
            },
          },
          additionalProperties: false,
          required: ['id', 'nodes'],
        },
      },
    },
  })
})
