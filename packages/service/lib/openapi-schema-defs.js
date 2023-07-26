'use strict'

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
    $ref: '#/$defs/specification-extensions'
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
    $ref: '#/$defs/specification-extensions'
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
    $ref: '#/$defs/specification-extensions'
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
    $ref: '#/$defs/specification-extensions'
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
    $ref: '#/$defs/specification-extensions'
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
    $ref: '#/$defs/specification-extensions'
  },
  paths: {
    $comment: 'https://spec.openapis.org/oas/v3.1.0#paths-object',
    type: 'object',
    patternProperties: {
      '^/': {
        $ref: '#/$defs/path-item'
      }
    },
    $ref: '#/$defs/specification-extensions'
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
    $ref: '#/$defs/specification-extensions'
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
    $ref: '#/$defs/specification-extensions'
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
    $ref: '#/$defs/specification-extensions'
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
        type: 'object',
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
      type: 'object',
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
      type: 'object',
      properties: {
        allowEmptyValue: {
          default: false,
          type: 'boolean'
        }
      }
    },
    $ref: '#/$defs/specification-extensions'
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
    $ref: '#/$defs/specification-extensions'
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
    ]
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

    $defs: {
      'explode-default': {
        if: {
          type: 'object',
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
          type: 'object',
          properties: {
            explode: {
              default: true
            }
          }
        },
        else: {
          type: 'object',
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
    additionalProperties: {
      $ref: '#/$defs/response-or-reference'
    },
    minProperties: 1,
    $ref: '#/$defs/specification-extensions'
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
    $ref: '#/$defs/specification-extensions'
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
    $ref: '#/$defs/specification-extensions'
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
    $ref: '#/$defs/specification-extensions'
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
        type: 'object',
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
    $ref: '#/$defs/specification-extensions'
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
    $ref: '#/$defs/specification-extensions'
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
    }
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
    $defs: {
      'type-apikey': {
        if: {
          type: 'object',
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
          type: 'object',
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
          type: 'object',
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
          type: 'object',
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
          type: 'object',
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
          type: 'object',
          properties: {
            bearerFormat: {
              type: 'string'
            }
          }
        }
      },
      'type-oauth2': {
        if: {
          type: 'object',
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
          type: 'object',
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
          type: 'object',
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
          type: 'object',
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
        $ref: '#/$defs/specification-extensions'
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
        $ref: '#/$defs/specification-extensions'
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
        $ref: '#/$defs/specification-extensions'
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
        $ref: '#/$defs/specification-extensions'
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
    type: 'object',
    patternProperties: {
      '^x-': true
    }
  },
  examples: {
    type: 'object',
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

module.exports = $defs
