#! /usr/bin/env node
'use strict'

const { metrics, server, plugins, watch } = require('@platformatic/service').schema
const pkg = require('../package.json')
const version = 'v' + pkg.version

const core = {
  type: 'object',
  properties: {
    connectionString: {
      type: 'string'
    },
    schema: {
      type: 'array',
      items: {
        type: 'string'
      }
    },
    poolSize: {
      type: 'integer'
    },
    autoTimestamp: {
      oneOf: [{
        type: 'object',
        properties: {
          createdAt: {
            type: 'string',
            default: 'created_at'
          },
          updatedAt: {
            type: 'string',
            default: 'updated_at'
          }
        }
      }, {
        type: 'boolean'
      }]
    },
    graphql: {
      anyOf: [{
        type: 'boolean'
      }, {
        type: 'object',
        properties: {
          graphiql: {
            type: 'boolean'
          },
          ignore: {
            type: 'object',
            // TODO add support for column-level ignore
            additionalProperties: {
              type: 'boolean'
            }
          },
          subscriptionIgnore: {
            type: 'array',
            items: {
              type: 'string'
            }
          },
          schema: {
            type: 'string'
          },
          schemaPath: {
            type: 'string'
          }
        }
      }]
    },
    openapi: {
      anyOf: [{
        type: 'boolean'
      }, {
        type: 'object',
        properties: {
          info: {
            $ref: '#/$defs/info'
          },
          jsonSchemaDialect: {
            type: 'string',

            default: 'https://spec.openapis.org/oas/3.1/dialect/base'
          },
          servers: {
            type: 'array',
            items: {
              $ref: '#/$defs/server'
            },
            default: [
              {
                url: '/'
              }
            ]
          },
          paths: {
            $ref: '#/$defs/paths'
          },
          webhooks: {
            type: 'object',
            additionalProperties: {
              $ref: '#/$defs/path-item-or-reference'
            }
          },
          components: {
            $ref: '#/$defs/components'
          },
          security: {
            type: 'array',
            items: {
              $ref: '#/$defs/security-requirement'
            }
          },
          tags: {
            type: 'array',
            items: {
              $ref: '#/$defs/tag'
            }
          },
          externalDocs: {
            $ref: '#/$defs/external-documentation'
          },
          prefix: {
            type: 'string',
            description: 'Base URL for the OpenAPI'
          },
          ignore: {
            type: 'object',
            // TODO add support for column-level ignore
            additionalProperties: {
              type: 'boolean'
            }
          }
        },
        additionalProperties: false
      }]
    },
    ignore: {
      type: 'object',
      // TODO add support for column-level ignore
      additionalProperties: {
        type: 'boolean'
      }
    },
    limit: {
      type: 'object',
      properties: {
        default: {
          type: 'integer',
          default: 10
        },
        max: {
          type: 'integer',
          default: 100
        }
      }
    },
    events: {
      anyOf: [{
        type: 'boolean'
      }, {
        type: 'object',
        properties: {
          connectionString: {
            type: 'string'
          }
        },
        additionalProperties: false
      }]
    }
  },
  required: ['connectionString']
}

const sharedAuthorizationRule = {
  role: {
    type: 'string',
    description: 'the role name to match the rule'
  },
  defaults: {
    type: 'object',
    description: 'defaults for entity creation',
    additionalProperties: {
      type: 'string'
    }
  },
  find: {
    $ref: '#crud-operation-auth'
  },
  save: {
    $ref: '#crud-operation-auth'
  },
  delete: {
    $ref: '#crud-operation-auth'
  }
}

const authorization = {
  type: 'object',
  properties: {
    adminSecret: {
      type: 'string',
      description: 'The password should be used to login dashboard and to access routes under /_admin prefix and for admin access to REST and GraphQL endpoints with X-PLATFORMATIC-ADMIN-SECRET header.'
    },
    roleKey: {
      type: 'string',
      description: 'The user metadata key to store user roles',
      default: 'X-PLATFORMATIC-ROLE'
    },
    anonymousRole: {
      type: 'string',
      description: 'The role name for anonymous users',
      default: 'anonymous'
    },
    jwt: {
      type: 'object',
      additionalProperties: true,
      properties: {
        secret: {
          oneOf: [{
            type: 'string',
            description: 'the shared secret for JWT'
          }, {
            type: 'object',
            description: 'the JWT secret configuration (see: https://github.com/fastify/fastify-jwt#secret-required)',
            additionalProperties: true
          }]
        },
        namespace: {
          type: 'string',
          description: 'the namespace for JWT custom claims'
        },
        jwks: {
          oneOf: [{
            type: 'boolean'
          }, {
            // shall we replicate here all the options in https://github.com/nearform/get-jwks#options
            type: 'object',
            additionalProperties: true
          }]
        }
      }
    },
    webhook: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'the webhook url'
        }
      },
      additionalProperties: false
    },
    rules: {
      type: 'array',
      items: {
        type: 'object',
        oneOf: [{
          type: 'object',
          properties: {
            entity: {
              type: 'string',
              description: 'the DB entity type to which the rule applies'
            },
            ...sharedAuthorizationRule
          },
          required: ['role'],
          additionalProperties: false
        }, {
          type: 'object',
          properties: {
            entities: {
              type: 'array',
              description: 'the DB entity types to which the rule applies',
              items: {
                type: 'string'
              }
            },
            ...sharedAuthorizationRule
          },
          required: ['role'],
          additionalProperties: false
        }]
      }
    }
  },
  additionalProperties: false,
  $defs: {
    crudOperationAuth: {
      $id: '#crud-operation-auth',
      oneOf: [{
        type: 'object',
        description: 'CRUD operation authorization config',
        properties: {
          checks: {
            description: 'checks for the operation',
            type: 'object',
            additionalProperties: {
              if: {
                type: 'object'
              },
              then: {
                type: 'object',
                properties: {
                  eq: { type: 'string' },
                  in: { type: 'string' },
                  nin: { type: 'string' },
                  nen: { type: 'string' },
                  gt: { type: 'string' },
                  gte: { type: 'string' },
                  lt: { type: 'string' },
                  lte: { type: 'string' }
                },
                additionalProperties: false
              },
              else: {
                type: 'string'
              }
            }
          },
          fields: {
            type: 'array',
            description: 'array of enabled field for the operation',
            items: {
              type: 'string'
            }
          }
        },
        additionalProperties: false
      }, {
        type: 'boolean',
        description: 'true if enabled (with not authorization constraints enabled)'
      }]
    }
  }
}

const dashboard = {
  anyOf: [
    { type: 'boolean' },
    {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'The path where the dashboard should be served.'
        }
      },
      additionalProperties: false
    }
  ]
}

const migrations = {
  type: 'object',
  properties: {
    dir: {
      type: 'string',
      description: 'The path to the directory containing the migrations.'
    },
    table: {
      type: 'string'
    },
    validateChecksums: {
      type: 'boolean'
    },
    autoApply: {
      type: 'boolean',
      description: 'Whether to automatically apply migrations when running the migrate command.'
    }
  },
  additionalProperties: false,
  required: ['dir']
}

const types = {
  type: 'object',
  properties: {
    autogenerate: {
      type: 'boolean'
    },
    dir: {
      type: 'string',
      description: 'The path to the directory the types should be generated in.'
    }
  },
  additionalProperties: false
}

const $defs = {
  info: {
    $comment: 'https://spec.openapis.org/oas/v3.1.0#info-object',
    type: 'object',
    properties: {
      title: {
        type: 'string'
      },
      summary: {
        type: 'string'
      },
      description: {
        type: 'string'
      },
      termsOfService: {
        type: 'string'
      },
      contact: {
        $ref: '#/$defs/contact'
      },
      license: {
        $ref: '#/$defs/license'
      },
      version: {
        type: 'string'
      }
    },
    required: [
      'title',
      'version'
    ],
    $ref: '#/$defs/specification-extensions',
    unevaluatedProperties: false
  },
  contact: {
    $comment: 'https://spec.openapis.org/oas/v3.1.0#contact-object',
    type: 'object',
    properties: {
      name: {
        type: 'string'
      },
      url: {
        type: 'string'
      },
      email: {
        type: 'string'
      }
    },
    $ref: '#/$defs/specification-extensions',
    unevaluatedProperties: false
  },
  license: {
    $comment: 'https://spec.openapis.org/oas/v3.1.0#license-object',
    type: 'object',
    properties: {
      name: {
        type: 'string'
      },
      identifier: {
        type: 'string'
      },
      url: {
        type: 'string'
      }
    },
    required: [
      'name'
    ],
    dependentSchemas: {
      identifier: {
        not: {
          required: [
            'url'
          ]
        }
      }
    },
    $ref: '#/$defs/specification-extensions',
    unevaluatedProperties: false
  },
  server: {
    $comment: 'https://spec.openapis.org/oas/v3.1.0#server-object',
    type: 'object',
    properties: {
      url: {
        type: 'string'
      },
      description: {
        type: 'string'
      },
      variables: {
        type: 'object',
        additionalProperties: {
          $ref: '#/$defs/server-variable'
        }
      }
    },
    required: [
      'url'
    ],
    $ref: '#/$defs/specification-extensions',
    unevaluatedProperties: false
  },
  'server-variable': {
    $comment: 'https://spec.openapis.org/oas/v3.1.0#server-variable-object',
    type: 'object',
    properties: {
      enum: {
        type: 'array',
        items: {
          type: 'string'
        },
        minItems: 1
      },
      default: {
        type: 'string'
      },
      description: {
        type: 'string'
      }
    },
    required: [
      'default'
    ],
    $ref: '#/$defs/specification-extensions',
    unevaluatedProperties: false
  },
  components: {
    $comment: 'https://spec.openapis.org/oas/v3.1.0#components-object',
    type: 'object',
    properties: {
      schemas: {
        type: 'object'
      },
      responses: {
        type: 'object',
        additionalProperties: {
          $ref: '#/$defs/response-or-reference'
        }
      },
      parameters: {
        type: 'object',
        additionalProperties: {
          $ref: '#/$defs/parameter-or-reference'
        }
      },
      examples: {
        type: 'object',
        additionalProperties: {
          $ref: '#/$defs/example-or-reference'
        }
      },
      requestBodies: {
        type: 'object',
        additionalProperties: {
          $ref: '#/$defs/request-body-or-reference'
        }
      },
      headers: {
        type: 'object',
        additionalProperties: {
          $ref: '#/$defs/header-or-reference'
        }
      },
      securitySchemes: {
        type: 'object',
        additionalProperties: {
          $ref: '#/$defs/security-scheme-or-reference'
        }
      },
      links: {
        type: 'object',
        additionalProperties: {
          $ref: '#/$defs/link-or-reference'
        }
      },
      callbacks: {
        type: 'object',
        additionalProperties: {
          $ref: '#/$defs/callbacks-or-reference'
        }
      },
      pathItems: {
        type: 'object',
        additionalProperties: {
          $ref: '#/$defs/path-item-or-reference'
        }
      }
    },
    patternProperties: {
      '^(schemas|responses|parameters|examples|requestBodies|headers|securitySchemes|links|callbacks|pathItems)$': {
        $comment: 'Enumerating all of the property names in the regex above is necessary for unevaluatedProperties to work as expected',
        propertyNames: {
          pattern: '^[a-zA-Z0-9._-]+$'
        }
      }
    },
    $ref: '#/$defs/specification-extensions',
    unevaluatedProperties: false
  },
  paths: {
    $comment: 'https://spec.openapis.org/oas/v3.1.0#paths-object',
    type: 'object',
    patternProperties: {
      '^/': {
        $ref: '#/$defs/path-item'
      }
    },
    $ref: '#/$defs/specification-extensions',
    unevaluatedProperties: false
  },
  'path-item': {
    $comment: 'https://spec.openapis.org/oas/v3.1.0#path-item-object',
    type: 'object',
    properties: {
      summary: {
        type: 'string'
      },
      description: {
        type: 'string'
      },
      servers: {
        type: 'array',
        items: {
          $ref: '#/$defs/server'
        }
      },
      parameters: {
        type: 'array',
        items: {
          $ref: '#/$defs/parameter-or-reference'
        }
      },
      get: {
        $ref: '#/$defs/operation'
      },
      put: {
        $ref: '#/$defs/operation'
      },
      post: {
        $ref: '#/$defs/operation'
      },
      delete: {
        $ref: '#/$defs/operation'
      },
      options: {
        $ref: '#/$defs/operation'
      },
      head: {
        $ref: '#/$defs/operation'
      },
      patch: {
        $ref: '#/$defs/operation'
      },
      trace: {
        $ref: '#/$defs/operation'
      }
    },
    $ref: '#/$defs/specification-extensions',
    unevaluatedProperties: false
  },
  'path-item-or-reference': {
    if: {
      type: 'object',
      required: [
        '$ref'
      ]
    },
    then: {
      $ref: '#/$defs/reference'
    },
    else: {
      $ref: '#/$defs/path-item'
    }
  },
  operation: {
    $comment: 'https://spec.openapis.org/oas/v3.1.0#operation-object',
    type: 'object',
    properties: {
      tags: {
        type: 'array',
        items: {
          type: 'string'
        }
      },
      summary: {
        type: 'string'
      },
      description: {
        type: 'string'
      },
      externalDocs: {
        $ref: '#/$defs/external-documentation'
      },
      operationId: {
        type: 'string'
      },
      parameters: {
        type: 'array',
        items: {
          $ref: '#/$defs/parameter-or-reference'
        }
      },
      requestBody: {
        $ref: '#/$defs/request-body-or-reference'
      },
      responses: {
        $ref: '#/$defs/responses'
      },
      callbacks: {
        type: 'object',
        additionalProperties: {
          $ref: '#/$defs/callbacks-or-reference'
        }
      },
      deprecated: {
        default: false,
        type: 'boolean'
      },
      security: {
        type: 'array',
        items: {
          $ref: '#/$defs/security-requirement'
        }
      },
      servers: {
        type: 'array',
        items: {
          $ref: '#/$defs/server'
        }
      }
    },
    $ref: '#/$defs/specification-extensions',
    unevaluatedProperties: false
  },
  'external-documentation': {
    $comment: 'https://spec.openapis.org/oas/v3.1.0#external-documentation-object',
    type: 'object',
    properties: {
      description: {
        type: 'string'
      },
      url: {
        type: 'string'
      }
    },
    required: [
      'url'
    ],
    $ref: '#/$defs/specification-extensions',
    unevaluatedProperties: false
  },
  parameter: {
    $comment: 'https://spec.openapis.org/oas/v3.1.0#parameter-object',
    type: 'object',
    properties: {
      name: {
        type: 'string'
      },
      in: {
        enum: [
          'query',
          'header',
          'path',
          'cookie'
        ]
      },
      description: {
        type: 'string'
      },
      required: {
        default: false,
        type: 'boolean'
      },
      deprecated: {
        default: false,
        type: 'boolean'
      },
      content: {
        $ref: '#/$defs/content',
        minProperties: 1,
        maxProperties: 1
      }
    },
    required: [
      'name',
      'in'
    ],
    oneOf: [
      {
        required: [
          'schema'
        ]
      },
      {
        required: [
          'content'
        ]
      }
    ],
    if: {
      properties: {
        in: {
          const: 'query'
        }
      },
      required: [
        'in'
      ]
    },
    then: {
      properties: {
        allowEmptyValue: {
          default: false,
          type: 'boolean'
        }
      }
    },
    dependentSchemas: {
      schema: {
        properties: {
          style: {
            type: 'string'
          },
          explode: {
            type: 'boolean'
          }
        },
        allOf: [
          {
            $ref: '#/$defs/examples'
          },
          {
            $ref: '#/$defs/parameter/dependentSchemas/schema/$defs/styles-for-path'
          },
          {
            $ref: '#/$defs/parameter/dependentSchemas/schema/$defs/styles-for-header'
          },
          {
            $ref: '#/$defs/parameter/dependentSchemas/schema/$defs/styles-for-query'
          },
          {
            $ref: '#/$defs/parameter/dependentSchemas/schema/$defs/styles-for-cookie'
          },
          {
            $ref: '#/$defs/parameter/dependentSchemas/schema/$defs/styles-for-form'
          }
        ],
        $defs: {
          'styles-for-path': {
            if: {
              properties: {
                in: {
                  const: 'path'
                }
              },
              required: [
                'in'
              ]
            },
            then: {
              properties: {
                name: {
                  pattern: '[^/#?]+$'
                },
                style: {
                  default: 'simple',
                  enum: [
                    'matrix',
                    'label',
                    'simple'
                  ]
                },
                required: {
                  const: true
                }
              },
              required: [
                'required'
              ]
            }
          },
          'styles-for-header': {
            if: {
              properties: {
                in: {
                  const: 'header'
                }
              },
              required: [
                'in'
              ]
            },
            then: {
              properties: {
                style: {
                  default: 'simple',
                  const: 'simple'
                }
              }
            }
          },
          'styles-for-query': {
            if: {
              properties: {
                in: {
                  const: 'query'
                }
              },
              required: [
                'in'
              ]
            },
            then: {
              properties: {
                style: {
                  default: 'form',
                  enum: [
                    'form',
                    'spaceDelimited',
                    'pipeDelimited',
                    'deepObject'
                  ]
                },
                allowReserved: {
                  default: false,
                  type: 'boolean'
                }
              }
            }
          },
          'styles-for-cookie': {
            if: {
              properties: {
                in: {
                  const: 'cookie'
                }
              },
              required: [
                'in'
              ]
            },
            then: {
              properties: {
                style: {
                  default: 'form',
                  const: 'form'
                }
              }
            }
          },
          'styles-for-form': {
            if: {
              properties: {
                style: {
                  const: 'form'
                }
              },
              required: [
                'style'
              ]
            },
            then: {
              properties: {
                explode: {
                  default: true
                }
              }
            },
            else: {
              properties: {
                explode: {
                  default: false
                }
              }
            }
          }
        }
      }
    },
    $ref: '#/$defs/specification-extensions',
    unevaluatedProperties: false
  },
  'parameter-or-reference': {
    if: {
      type: 'object',
      required: [
        '$ref'
      ]
    },
    then: {
      $ref: '#/$defs/reference'
    },
    else: {
      $ref: '#/$defs/parameter'
    }
  },
  'request-body': {
    $comment: 'https://spec.openapis.org/oas/v3.1.0#request-body-object',
    type: 'object',
    properties: {
      description: {
        type: 'string'
      },
      content: {
        $ref: '#/$defs/content'
      },
      required: {
        default: false,
        type: 'boolean'
      }
    },
    required: [
      'content'
    ],
    $ref: '#/$defs/specification-extensions',
    unevaluatedProperties: false
  },
  'request-body-or-reference': {
    if: {
      type: 'object',
      required: [
        '$ref'
      ]
    },
    then: {
      $ref: '#/$defs/reference'
    },
    else: {
      $ref: '#/$defs/request-body'
    }
  },
  content: {
    $comment: 'https://spec.openapis.org/oas/v3.1.0#fixed-fields-10',
    type: 'object',
    additionalProperties: {
      $ref: '#/$defs/media-type'
    }
  },
  'media-type': {
    $comment: 'https://spec.openapis.org/oas/v3.1.0#media-type-object',
    type: 'object',
    properties: {
      encoding: {
        type: 'object',
        additionalProperties: {
          $ref: '#/$defs/encoding'
        }
      }
    },
    allOf: [
      {
        $ref: '#/$defs/specification-extensions'
      },
      {
        $ref: '#/$defs/examples'
      }
    ],
    unevaluatedProperties: false
  },
  encoding: {
    $comment: 'https://spec.openapis.org/oas/v3.1.0#encoding-object',
    type: 'object',
    properties: {
      contentType: {
        type: 'string'
      },
      headers: {
        type: 'object',
        additionalProperties: {
          $ref: '#/$defs/header-or-reference'
        }
      },
      style: {
        default: 'form',
        enum: [
          'form',
          'spaceDelimited',
          'pipeDelimited',
          'deepObject'
        ]
      },
      explode: {
        type: 'boolean'
      },
      allowReserved: {
        default: false,
        type: 'boolean'
      }
    },
    allOf: [
      {
        $ref: '#/$defs/specification-extensions'
      },
      {
        $ref: '#/$defs/encoding/$defs/explode-default'
      }
    ],
    unevaluatedProperties: false,
    $defs: {
      'explode-default': {
        if: {
          properties: {
            style: {
              const: 'form'
            }
          },
          required: [
            'style'
          ]
        },
        then: {
          properties: {
            explode: {
              default: true
            }
          }
        },
        else: {
          properties: {
            explode: {
              default: false
            }
          }
        }
      }
    }
  },
  responses: {
    $comment: 'https://spec.openapis.org/oas/v3.1.0#responses-object',
    type: 'object',
    properties: {
      default: {
        $ref: '#/$defs/response-or-reference'
      }
    },
    patternProperties: {
      '^[1-5](?:[0-9]{2}|XX)$': {
        $ref: '#/$defs/response-or-reference'
      }
    },
    minProperties: 1,
    $ref: '#/$defs/specification-extensions',
    unevaluatedProperties: false,
    if: {
      $comment: 'either default, or at least one response code property must exist',
      patternProperties: {
        '^[1-5](?:[0-9]{2}|XX)$': false
      }
    },
    then: {
      required: [
        'default'
      ]
    }
  },
  response: {
    $comment: 'https://spec.openapis.org/oas/v3.1.0#response-object',
    type: 'object',
    properties: {
      description: {
        type: 'string'
      },
      headers: {
        type: 'object',
        additionalProperties: {
          $ref: '#/$defs/header-or-reference'
        }
      },
      content: {
        $ref: '#/$defs/content'
      },
      links: {
        type: 'object',
        additionalProperties: {
          $ref: '#/$defs/link-or-reference'
        }
      }
    },
    required: [
      'description'
    ],
    $ref: '#/$defs/specification-extensions',
    unevaluatedProperties: false
  },
  'response-or-reference': {
    if: {
      type: 'object',
      required: [
        '$ref'
      ]
    },
    then: {
      $ref: '#/$defs/reference'
    },
    else: {
      $ref: '#/$defs/response'
    }
  },
  callbacks: {
    $comment: 'https://spec.openapis.org/oas/v3.1.0#callback-object',
    type: 'object',
    $ref: '#/$defs/specification-extensions',
    additionalProperties: {
      $ref: '#/$defs/path-item-or-reference'
    }
  },
  'callbacks-or-reference': {
    if: {
      type: 'object',
      required: [
        '$ref'
      ]
    },
    then: {
      $ref: '#/$defs/reference'
    },
    else: {
      $ref: '#/$defs/callbacks'
    }
  },
  example: {
    $comment: 'https://spec.openapis.org/oas/v3.1.0#example-object',
    type: 'object',
    properties: {
      summary: {
        type: 'string'
      },
      description: {
        type: 'string'
      },
      value: true,
      externalValue: {
        type: 'string'
      }
    },
    not: {
      required: [
        'value',
        'externalValue'
      ]
    },
    $ref: '#/$defs/specification-extensions',
    unevaluatedProperties: false
  },
  'example-or-reference': {
    if: {
      type: 'object',
      required: [
        '$ref'
      ]
    },
    then: {
      $ref: '#/$defs/reference'
    },
    else: {
      $ref: '#/$defs/example'
    }
  },
  link: {
    $comment: 'https://spec.openapis.org/oas/v3.1.0#link-object',
    type: 'object',
    properties: {
      operationRef: {
        type: 'string'
      },
      operationId: {
        type: 'string'
      },
      parameters: {
        $ref: '#/$defs/map-of-strings'
      },
      requestBody: true,
      description: {
        type: 'string'
      },
      body: {
        $ref: '#/$defs/server'
      }
    },
    oneOf: [
      {
        required: [
          'operationRef'
        ]
      },
      {
        required: [
          'operationId'
        ]
      }
    ],
    $ref: '#/$defs/specification-extensions',
    unevaluatedProperties: false
  },
  'link-or-reference': {
    if: {
      type: 'object',
      required: [
        '$ref'
      ]
    },
    then: {
      $ref: '#/$defs/reference'
    },
    else: {
      $ref: '#/$defs/link'
    }
  },
  header: {
    $comment: 'https://spec.openapis.org/oas/v3.1.0#header-object',
    type: 'object',
    properties: {
      description: {
        type: 'string'
      },
      required: {
        default: false,
        type: 'boolean'
      },
      deprecated: {
        default: false,
        type: 'boolean'
      },
      content: {
        $ref: '#/$defs/content',
        minProperties: 1,
        maxProperties: 1
      }
    },
    oneOf: [
      {
        required: [
          'schema'
        ]
      },
      {
        required: [
          'content'
        ]
      }
    ],
    dependentSchemas: {
      schema: {
        properties: {
          style: {
            default: 'simple',
            const: 'simple'
          },
          explode: {
            default: false,
            type: 'boolean'
          }
        },
        $ref: '#/$defs/examples'
      }
    },
    $ref: '#/$defs/specification-extensions',
    unevaluatedProperties: false
  },
  'header-or-reference': {
    if: {
      type: 'object',
      required: [
        '$ref'
      ]
    },
    then: {
      $ref: '#/$defs/reference'
    },
    else: {
      $ref: '#/$defs/header'
    }
  },
  tag: {
    $comment: 'https://spec.openapis.org/oas/v3.1.0#tag-object',
    type: 'object',
    properties: {
      name: {
        type: 'string'
      },
      description: {
        type: 'string'
      },
      externalDocs: {
        $ref: '#/$defs/external-documentation'
      }
    },
    required: [
      'name'
    ],
    $ref: '#/$defs/specification-extensions',
    unevaluatedProperties: false
  },
  reference: {
    $comment: 'https://spec.openapis.org/oas/v3.1.0#reference-object',
    type: 'object',
    properties: {
      $ref: {
        type: 'string'
      },
      summary: {
        type: 'string'
      },
      description: {
        type: 'string'
      }
    },
    unevaluatedProperties: false
  },
  schema: {
    $comment: 'https://spec.openapis.org/oas/v3.1.0#schema-object',
    type: [
      'object',
      'boolean'
    ]
  },
  'security-scheme': {
    $comment: 'https://spec.openapis.org/oas/v3.1.0#security-scheme-object',
    type: 'object',
    properties: {
      type: {
        enum: [
          'apiKey',
          'http',
          'mutualTLS',
          'oauth2',
          'openIdConnect'
        ]
      },
      description: {
        type: 'string'
      }
    },
    required: [
      'type'
    ],
    allOf: [
      {
        $ref: '#/$defs/specification-extensions'
      },
      {
        $ref: '#/$defs/security-scheme/$defs/type-apikey'
      },
      {
        $ref: '#/$defs/security-scheme/$defs/type-http'
      },
      {
        $ref: '#/$defs/security-scheme/$defs/type-http-bearer'
      },
      {
        $ref: '#/$defs/security-scheme/$defs/type-oauth2'
      },
      {
        $ref: '#/$defs/security-scheme/$defs/type-oidc'
      }
    ],
    unevaluatedProperties: false,
    $defs: {
      'type-apikey': {
        if: {
          properties: {
            type: {
              const: 'apiKey'
            }
          },
          required: [
            'type'
          ]
        },
        then: {
          properties: {
            name: {
              type: 'string'
            },
            in: {
              enum: [
                'query',
                'header',
                'cookie'
              ]
            }
          },
          required: [
            'name',
            'in'
          ]
        }
      },
      'type-http': {
        if: {
          properties: {
            type: {
              const: 'http'
            }
          },
          required: [
            'type'
          ]
        },
        then: {
          properties: {
            scheme: {
              type: 'string'
            }
          },
          required: [
            'scheme'
          ]
        }
      },
      'type-http-bearer': {
        if: {
          properties: {
            type: {
              const: 'http'
            },
            scheme: {
              type: 'string',
              pattern: '^[Bb][Ee][Aa][Rr][Ee][Rr]$'
            }
          },
          required: [
            'type',
            'scheme'
          ]
        },
        then: {
          properties: {
            bearerFormat: {
              type: 'string'
            }
          }
        }
      },
      'type-oauth2': {
        if: {
          properties: {
            type: {
              const: 'oauth2'
            }
          },
          required: [
            'type'
          ]
        },
        then: {
          properties: {
            flows: {
              $ref: '#/$defs/oauth-flows'
            }
          },
          required: [
            'flows'
          ]
        }
      },
      'type-oidc': {
        if: {
          properties: {
            type: {
              const: 'openIdConnect'
            }
          },
          required: [
            'type'
          ]
        },
        then: {
          properties: {
            openIdConnectUrl: {
              type: 'string'
            }
          },
          required: [
            'openIdConnectUrl'
          ]
        }
      }
    }
  },
  'security-scheme-or-reference': {
    if: {
      type: 'object',
      required: [
        '$ref'
      ]
    },
    then: {
      $ref: '#/$defs/reference'
    },
    else: {
      $ref: '#/$defs/security-scheme'
    }
  },
  'oauth-flows': {
    type: 'object',
    properties: {
      implicit: {
        $ref: '#/$defs/oauth-flows/$defs/implicit'
      },
      password: {
        $ref: '#/$defs/oauth-flows/$defs/password'
      },
      clientCredentials: {
        $ref: '#/$defs/oauth-flows/$defs/client-credentials'
      },
      authorizationCode: {
        $ref: '#/$defs/oauth-flows/$defs/authorization-code'
      }
    },
    $ref: '#/$defs/specification-extensions',
    unevaluatedProperties: false,
    $defs: {
      implicit: {
        type: 'object',
        properties: {
          authorizationUrl: {
            type: 'string'
          },
          refreshUrl: {
            type: 'string'
          },
          scopes: {
            $ref: '#/$defs/map-of-strings'
          }
        },
        required: [
          'authorizationUrl',
          'scopes'
        ],
        $ref: '#/$defs/specification-extensions',
        unevaluatedProperties: false
      },
      password: {
        type: 'object',
        properties: {
          tokenUrl: {
            type: 'string'
          },
          refreshUrl: {
            type: 'string'
          },
          scopes: {
            $ref: '#/$defs/map-of-strings'
          }
        },
        required: [
          'tokenUrl',
          'scopes'
        ],
        $ref: '#/$defs/specification-extensions',
        unevaluatedProperties: false
      },
      'client-credentials': {
        type: 'object',
        properties: {
          tokenUrl: {
            type: 'string'
          },
          refreshUrl: {
            type: 'string'
          },
          scopes: {
            $ref: '#/$defs/map-of-strings'
          }
        },
        required: [
          'tokenUrl',
          'scopes'
        ],
        $ref: '#/$defs/specification-extensions',
        unevaluatedProperties: false
      },
      'authorization-code': {
        type: 'object',
        properties: {
          authorizationUrl: {
            type: 'string'
          },
          tokenUrl: {
            type: 'string'
          },
          refreshUrl: {
            type: 'string'
          },
          scopes: {
            $ref: '#/$defs/map-of-strings'
          }
        },
        required: [
          'authorizationUrl',
          'tokenUrl',
          'scopes'
        ],
        $ref: '#/$defs/specification-extensions',
        unevaluatedProperties: false
      }
    }
  },
  'security-requirement': {
    $comment: 'https://spec.openapis.org/oas/v3.1.0#security-requirement-object',
    type: 'object',
    additionalProperties: {
      type: 'array',
      items: {
        type: 'string'
      }
    }
  },
  'specification-extensions': {
    $comment: 'https://spec.openapis.org/oas/v3.1.0#specification-extensions',
    patternProperties: {
      '^x-': true
    }
  },
  examples: {
    properties: {
      example: true,
      examples: {
        type: 'object',
        additionalProperties: {
          $ref: '#/$defs/example-or-reference'
        }
      }
    }
  },
  'map-of-strings': {
    type: 'object',
    additionalProperties: {
      type: 'string'
    }
  }
}

const platformaticDBschema = {
  $id: `https://platformatic.dev/schemas/${version}/db`,
  $schema: 'http://json-schema.org/draft-07/schema#',
  type: 'object',
  properties: {
    server,
    core,
    dashboard,
    authorization,
    migrations,
    metrics,
    types,
    plugins
  },
  additionalProperties: {
    watch: {
      anyOf: [watch, {
        type: 'boolean'
      }]
    }
  },
  required: ['core', 'server'],
  $defs
}

module.exports.schema = platformaticDBschema

if (require.main === module) {
  console.log(JSON.stringify(platformaticDBschema, null, 2))
}
