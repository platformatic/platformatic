'use strict'

const { test } = require('tap')
const dtsgenerator = require('dtsgenerator')
const { mapOpenAPItoTypes } = require('..')

let structuredClone = globalThis.structuredClone
if (structuredClone === undefined) {
  structuredClone = (obj) => JSON.parse(JSON.stringify(obj))
}

function referenceTest (name, obj, opts = {}) {
  const { only } = opts
  test(name, { only }, async t => {
    const reference = await dtsgenerator.default({ contents: [dtsgenerator.parseSchema(structuredClone(obj))] })
    const cloned = structuredClone(obj)
    const ours = mapOpenAPItoTypes(cloned, { id: { primaryKey: true } })
    t.not(cloned, obj)
    t.same(cloned, obj)
    t.same(ours.trim(), reference.trim())
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
  required: [
    'title'
  ]
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
  required: [
    'title'
  ]
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
  required: [
    'title'
  ]
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
  required: [
    'title'
  ]
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
  required: [
    'title'
  ]
})
