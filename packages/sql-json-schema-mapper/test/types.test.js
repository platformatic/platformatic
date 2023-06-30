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
    const ours = mapOpenAPItoTypes(cloned, [])
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
    title: {
      type: 'string'
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
    description: {
      type: 'string',
      nullable: true
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
    metadata: {
      type: 'object',
      additionalProperties: true,
      nullable: true
    },
    section: {
      type: 'number',
      nullable: true
    },
    description: {
      type: 'string',
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
    title: {
      type: 'string'
    },
    metadata: {
      type: 'object',
      additionalProperties: true,
      nullable: true
    },
    section: {
      type: ['number', 'null']
    },
    description: {
      type: 'string',
      nullable: true
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
    title: {
      type: 'string'
    },
    tags: {
      type: 'array',
      items: {
        type: 'string'
      }
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
    title: {
      type: 'string'
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
    title: {
      type: 'string'
    },
    color: {
      type: 'string',
      enum: ['amber', 'green', 'red']
    }
  },
  required: [
    'title'
  ]
})
