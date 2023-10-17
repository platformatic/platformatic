'use strict'

import { test } from 'tap'
import { getType } from '../lib/openapi-common.mjs'

test('get type with schema', async (t) => {
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
  t.equal(type, 'Array<\'id\' | \'title\'>')
})

test('get type without schema', async (t) => {
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
  t.equal(getType(stringDef), 'string')
  t.equal(getType(arrayStringDef), 'Array<\'id\' | \'title\'>')
})

test('support anyOf', async (t) => {
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
  t.equal(getType(anyOfDef), 'string | Array<string> | number')
})

test('support allOf', async (t) => {
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
  t.equal(getType(allOfDef), 'string & Array<string> & number')
})

test('support objects', async (t) => {
  const objectDef = {
    type: 'object',
    properties: {
      foo: { type: 'string' },
      bar: { type: 'number' }
    }
  }
  t.equal(getType(objectDef), '{ foo?: string; bar?: number }')
})

test('support nested objects', async (t) => {
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
  t.equal(getType(objectDef), '{ foo?: string; bar?: { prop1?: string; prop2?: Array<string> } }')
})

test('support array of objects', async (t) => {
  const arrayOfObjectsDef = {
    items: {
      additionalProperties: false,
      properties: { attachedAt: { type: 'string' }, id: { type: 'string' } },
      required: ['id'],
      type: 'object'
    },
    type: 'array'
  }
  t.equal(getType(arrayOfObjectsDef), 'Array<{ attachedAt?: string; id: string }>')
})

test('support array with anyOf', async (t) => {
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
  t.equal(getType(arrayOfObjectsDef), 'Array<string | number>')
})

test('support enum', async (t) => {
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

  t.equal(getType(enumDef), '{ prop1: \'foo\' | \'bar\' | \'pippo\\\'Giuseppe_Raimondo_Vittorio\\\'baudo\'; prop2: string }')
})

test('support enum with numbers', async (t) => {
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

  t.equal(getType(enumDef), '{ prop1?: 1 | 2; prop2?: string }')
})

test('object without properties', async (t) => {
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

  t.equal(getType(emptyObjectDef), '{ prop1?: string; prop2?: object; prop3?: object }')
})
