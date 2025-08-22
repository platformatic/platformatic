import { equal } from 'node:assert'
import { test } from 'node:test'
import { getType } from '../lib/get-type.js'

test('get type with schema', async () => {
  const def = {
    schema: {
      type: 'array',
      items: {
        type: 'string',
        enum: [
          'id',
          'title'
        ]
      }
    }
  }
  const type = getType(def)
  equal(type, 'Array<\'id\' | \'title\'>')
})

test('get type without schema', async () => {
  const arrayStringDef = {
    type: 'array',
    items: {
      type: 'string',
      enum: [
        'id',
        'title'
      ]
    }
  }
  const stringDef = {
    type: 'string'
  }
  equal(getType(stringDef), 'string')
  equal(getType(arrayStringDef), 'Array<\'id\' | \'title\'>')
})

test('support anyOf', async () => {
  const anyOfDef = {
    schema: {
      anyOf: [
        {
          type: 'string'
        },
        {
          items: {
            type: 'string'
          },
          type: 'array'
        },
        {
          type: 'number'
        }
      ]
    }
  }
  equal(getType(anyOfDef), 'string | Array<string> | number')
})

test('support allOf', async () => {
  const allOfDef = {
    schema: {
      allOf: [
        {
          type: 'string'
        },
        {
          items: {
            type: 'string'
          },
          type: 'array'
        },
        {
          type: 'number'
        }
      ]
    }
  }
  equal(getType(allOfDef), 'string & Array<string> & number')
})

test('support objects', async () => {
  const objectDef = {
    type: 'object',
    properties: {
      foo: { type: 'string' },
      bar: { type: 'number' }
    }
  }
  equal(getType(objectDef), '{ \'foo\'?: string; \'bar\'?: number }')
})

test('support nested objects', async () => {
  const objectDef = {
    type: 'object',
    properties: {
      foo: { type: 'string' },
      bar: {
        type: 'object',
        properties: {
          prop1: { type: 'string' },
          prop2: {
            type: 'array',
            items: { type: 'string' }
          }
        }
      }
    }
  }
  equal(getType(objectDef), '{ \'foo\'?: string; \'bar\'?: { \'prop1\'?: string; \'prop2\'?: Array<string> } }')
})

test('support array of objects', async () => {
  const arrayOfObjectsDef = {
    items: {
      additionalProperties: false,
      properties: { attachedAt: { type: 'string' }, id: { type: 'string' } },
      required: ['id'],
      type: 'object'
    },
    type: 'array'
  }
  equal(getType(arrayOfObjectsDef), 'Array<{ \'attachedAt\'?: string; \'id\': string }>')
})

test('support array with anyOf', async () => {
  const arrayOfObjectsDef = {
    items: {
      anyOf: [
        {
          type: 'string'
        },
        {
          type: 'number'
        }
      ]
    },
    type: 'array'
  }
  equal(getType(arrayOfObjectsDef), 'Array<string | number>')
})

test('support enum', async () => {
  const enumDef = {
    properties: {
      prop1: {
        enum: [
          'foo',
          'bar',
          "pippo'Giuseppe_Raimondo_Vittorio'baudo"
        ],
        type: 'string'
      },
      prop2: {
        type: 'string'
      }
    },
    type: 'object',
    required: ['prop1', 'prop2']
  }

  equal(getType(enumDef), '{ \'prop1\': \'foo\' | \'bar\' | \'pippo\\\'Giuseppe_Raimondo_Vittorio\\\'baudo\'; \'prop2\': string }')
})

test('support enum with numbers', async () => {
  const enumDef = {
    properties: {
      prop1: {
        enum: [1, 2],
        type: 'number'
      },
      prop2: {
        type: 'string'
      }
    },
    type: 'object'
  }

  equal(getType(enumDef), '{ \'prop1\'?: 1 | 2; \'prop2\'?: string }')
})

test('object without properties', async () => {
  const emptyObjectDef = {
    type: 'object',
    properties: {
      prop1: { type: 'string' },
      prop2: {
        type: 'object',
        properties: {}
      },
      prop3: {
        type: 'object'
      }
    }
  }

  equal(getType(emptyObjectDef), '{ \'prop1\'?: string; \'prop2\'?: object; \'prop3\'?: object }')
})

test('support oneOf', async () => {
  const oneOfDef = {
    schema: {
      oneOf: [
        {
          type: 'string'
        },
        {
          items: {
            type: 'string'
          },
          type: 'array'
        },
        {
          type: 'number'
        }
      ]
    }
  }
  equal(getType(oneOfDef), 'string | Array<string> | number')
})

test('support discriminator object', async () => {
  const spec = {
    components: {
      schemas: {
        Dog: {
          type: 'object',
          properties: {
            type: { type: 'string' },
            barkSound: { type: 'string' }
          },
          required: ['type', 'barkSound']
        },
        Cat: {
          type: 'object',
          properties: {
            type: { type: 'string' },
            meowSound: { type: 'string' }
          },
          required: ['type', 'meowSound']
        }
      }
    }
  }
  const anyOfDef = {
    schema: {
      oneOf: [
        { $ref: '#/components/schemas/Dog' },
        { $ref: '#/components/schemas/Cat' }
      ],
      discriminator: {
        propertyName: 'type'
      }
    }
  }
  equal(getType(anyOfDef, 'res', spec), '{ \'type\': \'Dog\'; \'barkSound\': string } | { \'type\': \'Cat\'; \'meowSound\': string }')
})

test('support null', async () => {
  const nullDef = {
    schema: {
      type: 'null'
    }
  }
  equal(getType(nullDef), 'null')
})
