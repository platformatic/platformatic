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
  graphs(limit: LimitInt, offset: Int, orderBy: [GraphOrderByArguments], where: GraphWhereArguments): [Graph]
  countGraphs(where: GraphWhereArguments): graphsCount
}

type Graph {
  id: ID
  name: String
}

"""
Limit will be applied by default if not passed. If the provided value exceeds the maximum allowed value a validation error will be thrown
"""
scalar LimitInt

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
  or: [GraphWhereArgumentsOr]
}

input GraphWhereArgumentsid {
  eq: ID
  neq: ID
  gt: ID
  gte: ID
  lt: ID
  lte: ID
  like: ID
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
  like: String
  in: [String]
  nin: [String]
}

input GraphWhereArgumentsOr {
  id: GraphWhereArgumentsid
  name: GraphWhereArgumentsname
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

type Subscription {
  graphSaved: Graph
  graphDeleted: GraphDeleted
}

type GraphDeleted {
  id: ID
}
`

exports['test/cli/schema.test.mjs TAP print the openapi schema to stdout > must match snapshot 1'] = `
{
  "openapi": "3.0.3",
  "info": {
    "title": "Platformatic DB",
    "description": "Exposing a SQL database as REST",
    "version": "1.0.0"
  },
  "components": {
    "schemas": {
      "Graph": {
        "title": "Graph",
        "description": "A Graph",
        "type": "object",
        "properties": {
          "id": {
            "type": "integer",
            "nullable": true
          },
          "name": {
            "type": "string",
            "nullable": true
          }
        }
      },
      "GraphInput": {
        "title": "GraphInput",
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
        }
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
            "required": false,
            "description": "Limit will be applied by default if not passed. If the provided value exceeds the maximum allowed value a validation error will be thrown"
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
              "type": "integer"
            },
            "in": "query",
            "name": "where.id.like",
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
            "name": "where.name.like",
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
              "type": "array",
              "items": {
                "type": "string"
              }
            },
            "in": "query",
            "name": "where.or",
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
        "operationId": "createGraph",
        "requestBody": {
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/GraphInput"
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
      },
      "put": {
        "operationId": "updateGraphs",
        "requestBody": {
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/GraphInput"
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
              "type": "integer"
            },
            "in": "query",
            "name": "where.id.like",
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
            "name": "where.name.like",
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
              "type": "array",
              "items": {
                "type": "string"
              }
            },
            "in": "query",
            "name": "where.or",
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
      "put": {
        "operationId": "updateGraph",
        "requestBody": {
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/GraphInput"
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
        "operationId": "deleteGraphs",
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
    }
  }
}
`
