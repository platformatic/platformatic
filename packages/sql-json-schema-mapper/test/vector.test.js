import { deepEqual as same } from 'node:assert'
import { test } from 'node:test'
import { mapSQLEntityToJSONSchema } from '../index.js'

test('vector fields are mapped to arrays of numbers', async () => {
  const entity = {
    name: 'Embedding',
    camelCasedFields: {
      id: {
        camelcase: 'id',
        sqlType: 'int4',
        isNullable: false,
        primaryKey: true
      },
      embedding: {
        camelcase: 'embedding',
        sqlType: 'vector',
        isNullable: false,
        vectorDimensions: 1536
      }
    }
  }

  same(mapSQLEntityToJSONSchema(entity), {
    $id: 'Embedding',
    title: 'Embedding',
    description: 'A Embedding',
    type: 'object',
    properties: {
      id: {
        type: 'integer'
      },
      embedding: {
        type: 'array',
        items: {
          type: 'number'
        },
        minItems: 1536,
        maxItems: 1536
      }
    },
    required: ['embedding'],
    additionalProperties: false
  })
})
