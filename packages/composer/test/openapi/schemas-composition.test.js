'use strict'

const assert = require('node:assert/strict')
const { test } = require('node:test')
const { default: OpenAPISchemaValidator } = require('openapi-schema-validator')

const composeOpenApi = require('../../lib/openapi-composer')

const openApiValidator = new OpenAPISchemaValidator({ version: 3 })

test('should merge two basic apis', async (t) => {
  const schema1 = {
    openapi: '3.0.0',
    info: {
      title: 'API 1',
      version: '1.0.0'
    },
    paths: {
      '/books': {
        get: {
          operationId: 'getBooks',
          responses: {
            200: {
              description: 'OK',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/Books'
                  }
                }
              }
            }
          }
        }
      }
    },
    components: {
      schemas: {
        Books: {
          type: 'object',
          properties: {
            id: {
              type: 'string'
            },
            title: {
              type: 'string'
            }
          }
        }
      }
    }
  }

  const schema2 = {
    openapi: '3.0.0',
    info: {
      title: 'API 2',
      version: '1.0.0'
    },
    paths: {
      '/films': {
        get: {
          operationId: 'getFilms',
          responses: {
            200: {
              description: 'OK',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/Films'
                  }
                }
              }
            }
          }
        }
      }
    },
    components: {
      schemas: {
        Films: {
          type: 'object',
          properties: {
            id: {
              type: 'string'
            },
            title: {
              type: 'string'
            }
          }
        }
      }
    }
  }

  const composedSchema = composeOpenApi([
    { id: 'api1', schema: schema1 },
    { id: 'api2', schema: schema2 }
  ])

  openApiValidator.validate(composedSchema)

  assert.equal(composedSchema.openapi, '3.0.0')

  assert.equal(composedSchema.info.title, 'Platformatic Composer')
  assert.equal(composedSchema.info.version, '1.0.0')

  assert.deepEqual(composedSchema.components.schemas, {
    api1_Books: {
      type: 'object',
      title: 'Books',
      properties: {
        id: {
          type: 'string'
        },
        title: {
          type: 'string'
        }
      }
    },
    api2_Films: {
      type: 'object',
      title: 'Films',
      properties: {
        id: {
          type: 'string'
        },
        title: {
          type: 'string'
        }
      }
    }
  })

  assert.deepEqual(composedSchema.paths['/books'], {
    get: {
      operationId: 'api1_getBooks',
      responses: {
        200: {
          description: 'OK',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/api1_Books'
              }
            }
          }
        }
      }
    }
  })

  assert.deepEqual(composedSchema.paths['/films'], {
    get: {
      operationId: 'api2_getFilms',
      responses: {
        200: {
          description: 'OK',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/api2_Films'
              }
            }
          }
        }
      }
    }
  })
})

test('should merge two basic apis with path prefixes', async (t) => {
  const schema1 = {
    openapi: '3.0.0',
    info: {
      title: 'API 1',
      version: '1.0.0'
    },
    paths: {
      '/books': {
        get: {
          operationId: 'getBooks',
          responses: {
            200: {
              description: 'OK',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/Books'
                  }
                }
              }
            }
          }
        }
      }
    },
    components: {
      schemas: {
        Books: {
          type: 'object',
          properties: {
            id: {
              type: 'string'
            },
            title: {
              type: 'string'
            }
          }
        }
      }
    }
  }

  const schema2 = {
    openapi: '3.0.0',
    info: {
      title: 'API 2',
      version: '1.0.0'
    },
    paths: {
      '/films': {
        get: {
          operationId: 'getFilms',
          responses: {
            200: {
              description: 'OK',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/Films'
                  }
                }
              }
            }
          }
        }
      }
    },
    components: {
      schemas: {
        Films: {
          type: 'object',
          properties: {
            id: {
              type: 'string'
            },
            title: {
              type: 'string'
            }
          }
        }
      }
    }
  }

  const schema3 = {
    openapi: '3.0.0',
    info: {
      title: 'API 3',
      version: '1.0.0'
    },
    paths: {
      '/actors': {
        get: {
          operationId: 'getActors',
          responses: {
            200: {
              description: 'OK',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/Actors'
                  }
                }
              }
            }
          }
        }
      }
    },
    components: {
      schemas: {
        Actors: {
          type: 'object',
          properties: {
            id: {
              type: 'string'
            },
            name: {
              type: 'string'
            }
          }
        }
      }
    }
  }

  const composedSchema = composeOpenApi([
    { id: 'api1', prefix: '/api1', schema: schema1 },
    { id: 'api-2', prefix: '/api2', schema: schema2 },
    { id: '-api-3_', prefix: '/api3', schema: schema3 }
  ])

  openApiValidator.validate(composedSchema)

  assert.equal(composedSchema.openapi, '3.0.0')

  assert.equal(composedSchema.info.title, 'Platformatic Composer')
  assert.equal(composedSchema.info.version, '1.0.0')

  assert.deepEqual(composedSchema.components.schemas, {
    api1_Books: {
      type: 'object',
      title: 'Books',
      properties: {
        id: {
          type: 'string'
        },
        title: {
          type: 'string'
        }
      }
    },
    api_2_Films: {
      type: 'object',
      title: 'Films',
      properties: {
        id: {
          type: 'string'
        },
        title: {
          type: 'string'
        }
      }
    },
    api_3_Actors: {
      type: 'object',
      title: 'Actors',
      properties: {
        id: {
          type: 'string'
        },
        name: {
          type: 'string'
        }
      }
    }
  })

  assert.deepEqual(composedSchema.paths['/api1/books'], {
    get: {
      operationId: 'api1_getBooks',
      responses: {
        200: {
          description: 'OK',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/api1_Books'
              }
            }
          }
        }
      }
    }
  })

  assert.deepEqual(composedSchema.paths['/api2/films'], {
    get: {
      operationId: 'api_2_getFilms',
      responses: {
        200: {
          description: 'OK',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/api_2_Films'
              }
            }
          }
        }
      }
    }
  })

  assert.deepEqual(composedSchema.paths['/api3/actors'], {
    get: {
      operationId: 'api_3_getActors',
      responses: {
        200: {
          description: 'OK',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/api_3_Actors'
              }
            }
          }
        }
      }
    }
  })
})

test('should not overwrite a schema title if exists', async (t) => {
  const schema1 = {
    openapi: '3.0.0',
    info: {
      title: 'API 1',
      version: '1.0.0'
    },
    paths: {
      '/books': {
        get: {
          operationId: 'getBooks',
          responses: {
            200: {
              description: 'OK',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/Books'
                  }
                }
              }
            }
          }
        }
      }
    },
    components: {
      schemas: {
        Books: {
          type: 'object',
          title: 'My Books',
          properties: {
            id: {
              type: 'string'
            },
            title: {
              type: 'string'
            }
          }
        }
      }
    }
  }

  const schema2 = {
    openapi: '3.0.0',
    info: {
      title: 'API 2',
      version: '1.0.0'
    },
    paths: {
      '/films': {
        get: {
          operationId: 'getFilms',
          responses: {
            200: {
              description: 'OK',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/Films'
                  }
                }
              }
            }
          }
        }
      }
    },
    components: {
      schemas: {
        Films: {
          type: 'object',
          properties: {
            id: {
              type: 'string'
            },
            title: {
              type: 'string'
            }
          }
        }
      }
    }
  }

  const composedSchema = composeOpenApi([
    { id: 'api1', prefix: '/api1', schema: schema1 },
    { id: 'api2', prefix: '/api2', schema: schema2 }
  ])

  openApiValidator.validate(composedSchema)

  assert.equal(composedSchema.openapi, '3.0.0')

  assert.equal(composedSchema.info.title, 'Platformatic Composer')
  assert.equal(composedSchema.info.version, '1.0.0')

  assert.deepEqual(composedSchema.components.schemas, {
    api1_Books: {
      type: 'object',
      title: 'My Books',
      properties: {
        id: {
          type: 'string'
        },
        title: {
          type: 'string'
        }
      }
    },
    api2_Films: {
      type: 'object',
      title: 'Films',
      properties: {
        id: {
          type: 'string'
        },
        title: {
          type: 'string'
        }
      }
    }
  })

  assert.deepEqual(composedSchema.paths['/api1/books'], {
    get: {
      operationId: 'api1_getBooks',
      responses: {
        200: {
          description: 'OK',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/api1_Books'
              }
            }
          }
        }
      }
    }
  })

  assert.deepEqual(composedSchema.paths['/api2/films'], {
    get: {
      operationId: 'api2_getFilms',
      responses: {
        200: {
          description: 'OK',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/api2_Films'
              }
            }
          }
        }
      }
    }
  })
})

test('should throw an error if there are duplicates paths', async (t) => {
  const schema1 = {
    openapi: '3.0.0',
    info: {
      title: 'API 1',
      version: '1.0.0'
    },
    paths: {
      '/books': {
        get: {
          operationId: 'getBooks',
          responses: {}
        }
      }
    }
  }

  const schema2 = {
    openapi: '3.0.0',
    info: {
      title: 'API 1',
      version: '1.0.0'
    },
    paths: {
      '/books': {
        get: {
          operationId: 'getBooks',
          responses: {}
        }
      }
    }
  }

  try {
    composeOpenApi([
      { id: 'api1', schema: schema1 },
      { id: 'api2', schema: schema2 }
    ])
    assert.fail('should throw an error')
  } catch (err) {
    assert.equal(err.message, 'Path "/books" already exists')
  }
})

test('should throw an error if there are duplicates paths with prefixes', async (t) => {
  const schema1 = {
    openapi: '3.0.0',
    info: {
      title: 'API 1',
      version: '1.0.0'
    },
    paths: {
      '/books': {
        get: {
          operationId: 'getBooks',
          responses: {}
        }
      }
    }
  }

  const schema2 = {
    openapi: '3.0.0',
    info: {
      title: 'API 1',
      version: '1.0.0'
    },
    paths: {
      '/api1/books': {
        get: {
          operationId: 'getBooks',
          responses: {}
        }
      }
    }
  }

  try {
    composeOpenApi([
      { id: 'api1', prefix: '/api1', schema: schema1 },
      { id: 'api2', schema: schema2 }
    ])
    assert.fail('should throw an error')
  } catch (err) {
    assert.equal(err.message, 'Path "/api1/books" already exists')
  }
})
