/* IMPORTANT
 * This snapshot file is auto-generated, but designed for humans.
 * It should be checked into source control and tracked carefully.
 * Re-generate by setting TAP_SNAPSHOT=1 and running tests.
 * Make sure to inspect the output below.  Do not ignore changes!
 */
'use strict'
exports['test/cli/schema.test.mjs TAP print the graphql schema to stdout > must match snapshot 1'] = `
type Query {
  getGraphById(id: ID!): Graph
  graphs(limit: Int, offset: Int, orderBy: [GraphOrderByArguments], where: GraphWhereArguments): [Graph]
  countGraphs(where: GraphWhereArguments): graphsCount
}

type Graph {
  id: ID
  name: String
}

input GraphOrderByArguments {
  field: GraphOrderByField
  direction: OrderByDirection!
}

enum GraphOrderByField {
  id
  name
}

enum OrderByDirection {
  ASC
  DESC
}

input GraphWhereArguments {
  id: GraphWhereArgumentsid
  name: GraphWhereArgumentsname
}

input GraphWhereArgumentsid {
  eq: ID
  neq: ID
  gt: ID
  gte: ID
  lt: ID
  lte: ID
  in: [ID]
  nin: [ID]
}

input GraphWhereArgumentsname {
  eq: String
  neq: String
  gt: String
  gte: String
  lt: String
  lte: String
  in: [String]
  nin: [String]
}

type graphsCount {
  total: Int
}

type Mutation {
  saveGraph(input: GraphInput!): Graph
  insertGraphs(inputs: [GraphInput]!): [Graph]
  deleteGraphs(where: GraphWhereArguments): [Graph]
}

input GraphInput {
  id: ID
  name: String
}
`

exports['test/cli/schema.test.mjs TAP print the help if schema type is missing > must match snapshot 1'] = `
Generate a schema from the database and prints it to standard output:

* \`schema graphql\` - generate the GraphQL schema
* \`schema openapi\` - generate the OpenAPI schema

Options:

  -c, --config FILE  Specify a configuration file to use

If not specified, the configuration specified will be loaded from
\`platformatic.db.json\`, \`platformatic.db.yml\`, or \`platformatic.db.tml\` in the current directory.
You can find more details about the configuration format at:
https://oss.platformatic.dev/docs/reference/configuration.
`

exports['test/cli/schema.test.mjs TAP print the openapi schema to stdout > must match snapshot 1'] = `
{
  "openapi": "3.0.3",
  "info": {
    "title": "Platformatic DB",
    "description": "Exposing a SQL database as REST"
  },
  "components": {
    "schemas": {
      "Graph": {
        "title": "Graph",
        "description": "A Graph",
        "type": "object",
        "properties": {
          "id": {
            "type": "integer"
          },
          "name": {
            "type": "string",
            "nullable": true
          }
        },
        "required": []
      }
    }
  },
  "paths": {
    "/graphs/": {
      "get": {
        "operationId": "getGraphs",
        "parameters": [
          {
            "schema": {
              "type": "integer"
            },
            "in": "query",
            "name": "limit",
            "required": false
          },
          {
            "schema": {
              "type": "integer"
            },
            "in": "query",
            "name": "offset",
            "required": false
          },
          {
            "schema": {
              "type": "boolean",
              "default": false
            },
            "in": "query",
            "name": "totalCount",
            "required": false
          },
          {
            "schema": {
              "type": "array",
              "items": {
                "type": "string",
                "enum": [
                  "id",
                  "name"
                ]
              }
            },
            "in": "query",
            "name": "fields",
            "required": false
          },
          {
            "schema": {
              "type": "integer"
            },
            "in": "query",
            "name": "where.id.eq",
            "required": false
          },
          {
            "schema": {
              "type": "integer"
            },
            "in": "query",
            "name": "where.id.neq",
            "required": false
          },
          {
            "schema": {
              "type": "integer"
            },
            "in": "query",
            "name": "where.id.gt",
            "required": false
          },
          {
            "schema": {
              "type": "integer"
            },
            "in": "query",
            "name": "where.id.gte",
            "required": false
          },
          {
            "schema": {
              "type": "integer"
            },
            "in": "query",
            "name": "where.id.lt",
            "required": false
          },
          {
            "schema": {
              "type": "integer"
            },
            "in": "query",
            "name": "where.id.lte",
            "required": false
          },
          {
            "schema": {
              "type": "string"
            },
            "in": "query",
            "name": "where.id.in",
            "required": false
          },
          {
            "schema": {
              "type": "string"
            },
            "in": "query",
            "name": "where.id.nin",
            "required": false
          },
          {
            "schema": {
              "type": "string"
            },
            "in": "query",
            "name": "where.name.eq",
            "required": false
          },
          {
            "schema": {
              "type": "string"
            },
            "in": "query",
            "name": "where.name.neq",
            "required": false
          },
          {
            "schema": {
              "type": "string"
            },
            "in": "query",
            "name": "where.name.gt",
            "required": false
          },
          {
            "schema": {
              "type": "string"
            },
            "in": "query",
            "name": "where.name.gte",
            "required": false
          },
          {
            "schema": {
              "type": "string"
            },
            "in": "query",
            "name": "where.name.lt",
            "required": false
          },
          {
            "schema": {
              "type": "string"
            },
            "in": "query",
            "name": "where.name.lte",
            "required": false
          },
          {
            "schema": {
              "type": "string"
            },
            "in": "query",
            "name": "where.name.in",
            "required": false
          },
          {
            "schema": {
              "type": "string"
            },
            "in": "query",
            "name": "where.name.nin",
            "required": false
          },
          {
            "schema": {
              "type": "string",
              "enum": [
                "asc",
                "desc"
              ]
            },
            "in": "query",
            "name": "orderby.id",
            "required": false
          },
          {
            "schema": {
              "type": "string",
              "enum": [
                "asc",
                "desc"
              ]
            },
            "in": "query",
            "name": "orderby.name",
            "required": false
          }
        ],
        "responses": {
          "200": {
            "description": "Default Response",
            "content": {
              "application/json": {
                "schema": {
                  "type": "array",
                  "items": {
                    "$ref": "#/components/schemas/Graph"
                  }
                }
              }
            }
          }
        }
      },
      "post": {
        "requestBody": {
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/Graph"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "Default Response",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Graph"
                }
              }
            },
            "links": {}
          }
        }
      }
    },
    "/graphs/{id}": {
      "get": {
        "operationId": "getGraphById",
        "parameters": [
          {
            "schema": {
              "type": "array",
              "items": {
                "type": "string",
                "enum": [
                  "id",
                  "name"
                ]
              }
            },
            "in": "query",
            "name": "fields",
            "required": false
          },
          {
            "schema": {
              "type": "integer"
            },
            "in": "path",
            "name": "id",
            "required": true
          }
        ],
        "responses": {
          "200": {
            "description": "Default Response",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Graph"
                }
              }
            },
            "links": {}
          }
        }
      },
      "post": {
        "requestBody": {
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/Graph"
              }
            }
          }
        },
        "parameters": [
          {
            "schema": {
              "type": "array",
              "items": {
                "type": "string",
                "enum": [
                  "id",
                  "name"
                ]
              }
            },
            "in": "query",
            "name": "fields",
            "required": false
          },
          {
            "schema": {
              "type": "integer"
            },
            "in": "path",
            "name": "id",
            "required": true
          }
        ],
        "responses": {
          "200": {
            "description": "Default Response",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Graph"
                }
              }
            },
            "links": {}
          }
        }
      },
      "put": {
        "requestBody": {
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/Graph"
              }
            }
          }
        },
        "parameters": [
          {
            "schema": {
              "type": "array",
              "items": {
                "type": "string",
                "enum": [
                  "id",
                  "name"
                ]
              }
            },
            "in": "query",
            "name": "fields",
            "required": false
          },
          {
            "schema": {
              "type": "integer"
            },
            "in": "path",
            "name": "id",
            "required": true
          }
        ],
        "responses": {
          "200": {
            "description": "Default Response",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Graph"
                }
              }
            },
            "links": {}
          }
        }
      },
      "delete": {
        "parameters": [
          {
            "schema": {
              "type": "array",
              "items": {
                "type": "string",
                "enum": [
                  "id",
                  "name"
                ]
              }
            },
            "in": "query",
            "name": "fields",
            "required": false
          },
          {
            "schema": {
              "type": "integer"
            },
            "in": "path",
            "name": "id",
            "required": true
          }
        ],
        "responses": {
          "200": {
            "description": "Default Response",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Graph"
                }
              }
            }
          }
        }
      }
    },
    "/": {
      "get": {
        "responses": {
          "200": {
            "description": "Default Response"
          }
        }
      }
    }
  }
}
`
