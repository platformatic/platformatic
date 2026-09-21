import dtsgenerator, { parseSchema } from 'dtsgenerator'
import { notEqual, deepEqual as same } from 'node:assert'
import { test } from 'node:test'
import { mapOpenAPItoTypes } from '../index.js'

let structuredClone = globalThis.structuredClone
if (structuredClone === undefined) {
  structuredClone = obj => JSON.parse(JSON.stringify(obj))
}

function referenceTest (name, obj, opts = {}) {
  const { only } = opts
  test(name, { only }, async t => {
    let reference = await dtsgenerator.default({ contents: [parseSchema(structuredClone(obj))] })
    // Unlike dtsgenerator, numeric primary keys are intentionally rendered as
    // strings, because that is what the mapper returns at runtime
    reference = reference.replace(/^(\s*id\??): (.+);$/m, (_, prefix, union) => {
      const members = Array.from(new Set(union.split(' | ').map(t => (t === 'number' ? 'string' : t))))
      return `${prefix}: ${members.join(' | ')};`
    })
    const cloned = structuredClone(obj)
    const ours = mapOpenAPItoTypes(cloned, { id: { primaryKey: true } })
    notEqual(cloned, obj)
    same(cloned, obj)
    same(ours.trim(), reference.trim())
  })
}

referenceTest('p1', {
  id: 'Page',
  title: 'Page',
  description: 'A Page',
  type: 'object',
  properties: {
    id: {
      type: 'integer'
    },
    description: {
      type: 'string',
      nullable: true
    },
    metadata: {
      type: 'object',
      additionalProperties: true,
      nullable: true
    },
    section: {
      type: 'number',
      nullable: true
    },
    title: {
      type: 'string'
    }
  },
  required: ['title']
})

referenceTest('p2', {
  id: 'Page',
  title: 'Page',
  description: 'A Page',
  type: 'object',
  properties: {
    id: {
      type: 'integer'
    },
    description: {
      type: 'string',
      nullable: true
    },
    metadata: {
      type: 'object',
      additionalProperties: true,
      nullable: true
    },
    section: {
      type: 'number',
      nullable: true
    }
  },
  required: []
})

referenceTest('p3', {
  id: 'GeneratedTest',
  title: 'GeneratedTest',
  description: 'A GeneratedTest',
  type: 'object',
  properties: {
    id: {
      type: 'integer'
    },
    test: {
      type: 'integer',
      nullable: true
    },
    testStored: {
      type: 'integer',
      nullable: true,
      readOnly: true
    },
    testVirtual: {
      type: 'integer',
      nullable: true,
      readOnly: true
    }
  },
  required: []
})

referenceTest('multiple types', {
  id: 'Page',
  title: 'Page',
  description: 'A Page',
  type: 'object',
  properties: {
    id: {
      type: ['integer', 'string']
    },
    description: {
      type: 'string',
      nullable: true
    },
    metadata: {
      type: 'object',
      additionalProperties: true,
      nullable: true
    },
    section: {
      type: ['number', 'null']
    },
    title: {
      type: 'string'
    }
  },
  required: ['title']
})

referenceTest('arrays', {
  id: 'Page',
  title: 'Page',
  description: 'A Page',
  type: 'object',
  properties: {
    id: {
      type: 'integer'
    },
    tags: {
      type: 'array',
      items: {
        type: 'string'
      }
    },
    title: {
      type: 'string'
    }
  },
  required: ['title']
})

referenceTest('objects in arrays', {
  id: 'Page',
  title: 'Page',
  description: 'A Page',
  type: 'object',
  properties: {
    id: {
      type: 'integer'
    },
    tags: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          foo: {
            type: 'string'
          }
        }
      }
    },
    title: {
      type: 'string'
    }
  },
  required: ['title']
})

referenceTest('enums', {
  id: 'Page',
  title: 'Page',
  description: 'A Page',
  type: 'object',
  properties: {
    id: {
      type: 'integer'
    },
    color: {
      type: 'string',
      enum: ['amber', 'green', 'red']
    },
    title: {
      type: 'string'
    }
  },
  required: ['title']
})

test('bytea fields are mapped to Buffer type', async t => {
  const schema = {
    id: 'FileData',
    title: 'FileData',
    description: 'A FileData',
    type: 'object',
    properties: {
      id: {
        type: 'integer'
      },
      content: {
        type: 'string'
      },
      metadata: {
        type: 'string'
      }
    },
    required: ['id']
  }

  const fieldDefinitions = {
    id: { primaryKey: true },
    content: { sqlType: 'bytea' },
    metadata: { sqlType: 'text' }
  }

  const result = mapOpenAPItoTypes(schema, fieldDefinitions)

  // Verify that bytea field is mapped to Buffer
  same(result.includes('content?: Buffer;'), true, 'bytea field should be mapped to Buffer type')
  // Verify that non-bytea fields are mapped normally
  same(result.includes('metadata?: string;'), true, 'non-bytea string field should be mapped to string type')
  // The mapper always returns primary keys as strings
  same(result.includes('id: string;'), true, 'primary key field should be mapped to string type')
})

test('numeric primary keys are mapped to string type', async t => {
  /* https://github.com/platformatic/platformatic/issues/3862 */
  const schema = {
    id: 'User',
    title: 'User',
    description: 'A User',
    type: 'object',
    properties: {
      id: {
        type: 'integer'
      },
      age: {
        type: 'integer'
      },
      contactId: {
        type: 'integer'
      },
      externalCode: {
        type: 'integer'
      },
      name: {
        type: 'string'
      }
    },
    required: ['id']
  }

  const fieldDefinitions = {
    id: { primaryKey: true, sqlType: 'integer' },
    age: { sqlType: 'integer' },
    contactId: { foreignKey: true, stringifyOutput: true, sqlType: 'integer' },
    externalCode: { foreignKey: true, sqlType: 'integer' },
    name: { sqlType: 'varchar' }
  }

  const result = mapOpenAPItoTypes(schema, fieldDefinitions)

  same(result.includes('id: string;'), true, 'the primary key is typed as string, like the mapper returns it')
  same(result.includes('contactId?: string;'), true, 'a foreign key to a primary key is typed as string')
  same(result.includes('externalCode?: number;'), true, 'other foreign keys keep the number type')
  same(result.includes('age?: number;'), true, 'other numeric fields keep the number type')
  same(result.includes('name?: string;'), true, 'string fields keep the string type')
})
