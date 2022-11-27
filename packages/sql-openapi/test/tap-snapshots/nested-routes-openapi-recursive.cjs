/* IMPORTANT
 * This snapshot file is auto-generated, but designed for humans.
 * It should be checked into source control and tracked carefully.
 * Re-generate by setting TAP_SNAPSHOT=1 and running tests.
 * Make sure to inspect the output below.  Do not ignore changes!
 */
'use strict'
exports['platformatic/db/openapi/where nested routes with recursive FK > matches expected OpenAPI defs 1'] = `
Object {
  "components": Object {
    "schemas": Object {
      "Person": Object {
        "description": "A Person",
        "properties": Object {
          "id": Object {
            "type": "integer",
          },
          "name": Object {
            "type": "string",
          },
          "parentId": Object {
            "nullable": true,
            "type": "integer",
          },
        },
        "required": Array [
          "name",
        ],
        "title": "Person",
        "type": "object",
      },
    },
  },
  "info": Object {
    "description": "Exposing a SQL database as REST",
    "title": "Platformatic DB",
    "version": "1.0.0",
  },
  "openapi": "3.0.3",
  "paths": Object {
    "/people/": Object {
      "get": Object {
        "operationId": "getPeople",
        "parameters": Array [
          Object {
            "description": "Limit will be applied by default if not passed. If the provided value exceeds the maximum allowed value a validation error will be thrown",
            "in": "query",
            "name": "limit",
            "required": false,
            "schema": Object {
              "type": "integer",
            },
          },
          Object {
            "in": "query",
            "name": "offset",
            "required": false,
            "schema": Object {
              "type": "integer",
            },
          },
          Object {
            "in": "query",
            "name": "totalCount",
            "required": false,
            "schema": Object {
              "default": false,
              "type": "boolean",
            },
          },
          Object {
            "in": "query",
            "name": "fields",
            "required": false,
            "schema": Object {
              "items": Object {
                "enum": Array [
                  "id",
                  "name",
                  "parentId",
                ],
                "type": "string",
              },
              "type": "array",
            },
          },
          Object {
            "in": "query",
            "name": "where.id.eq",
            "required": false,
            "schema": Object {
              "type": "integer",
            },
          },
          Object {
            "in": "query",
            "name": "where.id.neq",
            "required": false,
            "schema": Object {
              "type": "integer",
            },
          },
          Object {
            "in": "query",
            "name": "where.id.gt",
            "required": false,
            "schema": Object {
              "type": "integer",
            },
          },
          Object {
            "in": "query",
            "name": "where.id.gte",
            "required": false,
            "schema": Object {
              "type": "integer",
            },
          },
          Object {
            "in": "query",
            "name": "where.id.lt",
            "required": false,
            "schema": Object {
              "type": "integer",
            },
          },
          Object {
            "in": "query",
            "name": "where.id.lte",
            "required": false,
            "schema": Object {
              "type": "integer",
            },
          },
          Object {
            "in": "query",
            "name": "where.id.like",
            "required": false,
            "schema": Object {
              "type": "integer",
            },
          },
          Object {
            "in": "query",
            "name": "where.id.in",
            "required": false,
            "schema": Object {
              "type": "string",
            },
          },
          Object {
            "in": "query",
            "name": "where.id.nin",
            "required": false,
            "schema": Object {
              "type": "string",
            },
          },
          Object {
            "in": "query",
            "name": "where.name.eq",
            "required": false,
            "schema": Object {
              "type": "string",
            },
          },
          Object {
            "in": "query",
            "name": "where.name.neq",
            "required": false,
            "schema": Object {
              "type": "string",
            },
          },
          Object {
            "in": "query",
            "name": "where.name.gt",
            "required": false,
            "schema": Object {
              "type": "string",
            },
          },
          Object {
            "in": "query",
            "name": "where.name.gte",
            "required": false,
            "schema": Object {
              "type": "string",
            },
          },
          Object {
            "in": "query",
            "name": "where.name.lt",
            "required": false,
            "schema": Object {
              "type": "string",
            },
          },
          Object {
            "in": "query",
            "name": "where.name.lte",
            "required": false,
            "schema": Object {
              "type": "string",
            },
          },
          Object {
            "in": "query",
            "name": "where.name.like",
            "required": false,
            "schema": Object {
              "type": "string",
            },
          },
          Object {
            "in": "query",
            "name": "where.name.in",
            "required": false,
            "schema": Object {
              "type": "string",
            },
          },
          Object {
            "in": "query",
            "name": "where.name.nin",
            "required": false,
            "schema": Object {
              "type": "string",
            },
          },
          Object {
            "in": "query",
            "name": "where.parentId.eq",
            "required": false,
            "schema": Object {
              "type": "integer",
            },
          },
          Object {
            "in": "query",
            "name": "where.parentId.neq",
            "required": false,
            "schema": Object {
              "type": "integer",
            },
          },
          Object {
            "in": "query",
            "name": "where.parentId.gt",
            "required": false,
            "schema": Object {
              "type": "integer",
            },
          },
          Object {
            "in": "query",
            "name": "where.parentId.gte",
            "required": false,
            "schema": Object {
              "type": "integer",
            },
          },
          Object {
            "in": "query",
            "name": "where.parentId.lt",
            "required": false,
            "schema": Object {
              "type": "integer",
            },
          },
          Object {
            "in": "query",
            "name": "where.parentId.lte",
            "required": false,
            "schema": Object {
              "type": "integer",
            },
          },
          Object {
            "in": "query",
            "name": "where.parentId.like",
            "required": false,
            "schema": Object {
              "type": "integer",
            },
          },
          Object {
            "in": "query",
            "name": "where.parentId.in",
            "required": false,
            "schema": Object {
              "type": "string",
            },
          },
          Object {
            "in": "query",
            "name": "where.parentId.nin",
            "required": false,
            "schema": Object {
              "type": "string",
            },
          },
          Object {
            "in": "query",
            "name": "orderby.id",
            "required": false,
            "schema": Object {
              "enum": Array [
                "asc",
                "desc",
              ],
              "type": "string",
            },
          },
          Object {
            "in": "query",
            "name": "orderby.name",
            "required": false,
            "schema": Object {
              "enum": Array [
                "asc",
                "desc",
              ],
              "type": "string",
            },
          },
          Object {
            "in": "query",
            "name": "orderby.parentId",
            "required": false,
            "schema": Object {
              "enum": Array [
                "asc",
                "desc",
              ],
              "type": "string",
            },
          },
        ],
        "responses": Object {
          "200": Object {
            "content": Object {
              "application/json": Object {
                "schema": Object {
                  "items": Object {
                    "$ref": "#/components/schemas/Person",
                  },
                  "type": "array",
                },
              },
            },
            "description": "Default Response",
          },
        },
      },
      "post": Object {
        "requestBody": Object {
          "content": Object {
            "application/json": Object {
              "schema": Object {
                "$ref": "#/components/schemas/Person",
              },
            },
          },
        },
        "responses": Object {
          "200": Object {
            "content": Object {
              "application/json": Object {
                "schema": Object {
                  "$ref": "#/components/schemas/Person",
                },
              },
            },
            "description": "Default Response",
            "links": Object {
              "GetPeople": Object {
                "operationId": "getPeople",
                "parameters": Object {
                  "where.parentId.eq": "$response.body#/id",
                },
              },
              "GetPersonById": Object {
                "operationId": "getPersonById",
                "parameters": Object {
                  "id": "$response.body#/parentId",
                },
              },
            },
          },
        },
      },
      "put": Object {
        "parameters": Array [
          Object {
            "in": "query",
            "name": "fields",
            "required": false,
            "schema": Object {
              "items": Object {
                "enum": Array [
                  "id",
                  "name",
                  "parentId",
                ],
                "type": "string",
              },
              "type": "array",
            },
          },
          Object {
            "in": "query",
            "name": "where.id.eq",
            "required": false,
            "schema": Object {
              "type": "integer",
            },
          },
          Object {
            "in": "query",
            "name": "where.id.neq",
            "required": false,
            "schema": Object {
              "type": "integer",
            },
          },
          Object {
            "in": "query",
            "name": "where.id.gt",
            "required": false,
            "schema": Object {
              "type": "integer",
            },
          },
          Object {
            "in": "query",
            "name": "where.id.gte",
            "required": false,
            "schema": Object {
              "type": "integer",
            },
          },
          Object {
            "in": "query",
            "name": "where.id.lt",
            "required": false,
            "schema": Object {
              "type": "integer",
            },
          },
          Object {
            "in": "query",
            "name": "where.id.lte",
            "required": false,
            "schema": Object {
              "type": "integer",
            },
          },
          Object {
            "in": "query",
            "name": "where.id.like",
            "required": false,
            "schema": Object {
              "type": "integer",
            },
          },
          Object {
            "in": "query",
            "name": "where.id.in",
            "required": false,
            "schema": Object {
              "type": "string",
            },
          },
          Object {
            "in": "query",
            "name": "where.id.nin",
            "required": false,
            "schema": Object {
              "type": "string",
            },
          },
          Object {
            "in": "query",
            "name": "where.name.eq",
            "required": false,
            "schema": Object {
              "type": "string",
            },
          },
          Object {
            "in": "query",
            "name": "where.name.neq",
            "required": false,
            "schema": Object {
              "type": "string",
            },
          },
          Object {
            "in": "query",
            "name": "where.name.gt",
            "required": false,
            "schema": Object {
              "type": "string",
            },
          },
          Object {
            "in": "query",
            "name": "where.name.gte",
            "required": false,
            "schema": Object {
              "type": "string",
            },
          },
          Object {
            "in": "query",
            "name": "where.name.lt",
            "required": false,
            "schema": Object {
              "type": "string",
            },
          },
          Object {
            "in": "query",
            "name": "where.name.lte",
            "required": false,
            "schema": Object {
              "type": "string",
            },
          },
          Object {
            "in": "query",
            "name": "where.name.like",
            "required": false,
            "schema": Object {
              "type": "string",
            },
          },
          Object {
            "in": "query",
            "name": "where.name.in",
            "required": false,
            "schema": Object {
              "type": "string",
            },
          },
          Object {
            "in": "query",
            "name": "where.name.nin",
            "required": false,
            "schema": Object {
              "type": "string",
            },
          },
          Object {
            "in": "query",
            "name": "where.parentId.eq",
            "required": false,
            "schema": Object {
              "type": "integer",
            },
          },
          Object {
            "in": "query",
            "name": "where.parentId.neq",
            "required": false,
            "schema": Object {
              "type": "integer",
            },
          },
          Object {
            "in": "query",
            "name": "where.parentId.gt",
            "required": false,
            "schema": Object {
              "type": "integer",
            },
          },
          Object {
            "in": "query",
            "name": "where.parentId.gte",
            "required": false,
            "schema": Object {
              "type": "integer",
            },
          },
          Object {
            "in": "query",
            "name": "where.parentId.lt",
            "required": false,
            "schema": Object {
              "type": "integer",
            },
          },
          Object {
            "in": "query",
            "name": "where.parentId.lte",
            "required": false,
            "schema": Object {
              "type": "integer",
            },
          },
          Object {
            "in": "query",
            "name": "where.parentId.like",
            "required": false,
            "schema": Object {
              "type": "integer",
            },
          },
          Object {
            "in": "query",
            "name": "where.parentId.in",
            "required": false,
            "schema": Object {
              "type": "string",
            },
          },
          Object {
            "in": "query",
            "name": "where.parentId.nin",
            "required": false,
            "schema": Object {
              "type": "string",
            },
          },
        ],
        "requestBody": Object {
          "content": Object {
            "application/json": Object {
              "schema": Object {
                "$ref": "#/components/schemas/Person",
              },
            },
          },
        },
        "responses": Object {
          "200": Object {
            "content": Object {
              "application/json": Object {
                "schema": Object {
                  "items": Object {
                    "$ref": "#/components/schemas/Person",
                  },
                  "type": "array",
                },
              },
            },
            "description": "Default Response",
            "links": Object {
              "GetPeople": Object {
                "operationId": "getPeople",
                "parameters": Object {
                  "where.parentId.eq": "$response.body#/id",
                },
              },
              "GetPersonById": Object {
                "operationId": "getPersonById",
                "parameters": Object {
                  "id": "$response.body#/parentId",
                },
              },
            },
          },
        },
      },
    },
    "/people/{id}": Object {
      "delete": Object {
        "parameters": Array [
          Object {
            "in": "query",
            "name": "fields",
            "required": false,
            "schema": Object {
              "items": Object {
                "enum": Array [
                  "id",
                  "name",
                  "parentId",
                ],
                "type": "string",
              },
              "type": "array",
            },
          },
          Object {
            "in": "path",
            "name": "id",
            "required": true,
            "schema": Object {
              "type": "integer",
            },
          },
        ],
        "responses": Object {
          "200": Object {
            "content": Object {
              "application/json": Object {
                "schema": Object {
                  "$ref": "#/components/schemas/Person",
                },
              },
            },
            "description": "Default Response",
          },
        },
      },
      "get": Object {
        "operationId": "getPersonById",
        "parameters": Array [
          Object {
            "in": "query",
            "name": "fields",
            "required": false,
            "schema": Object {
              "items": Object {
                "enum": Array [
                  "id",
                  "name",
                  "parentId",
                ],
                "type": "string",
              },
              "type": "array",
            },
          },
          Object {
            "in": "path",
            "name": "id",
            "required": true,
            "schema": Object {
              "type": "integer",
            },
          },
        ],
        "responses": Object {
          "200": Object {
            "content": Object {
              "application/json": Object {
                "schema": Object {
                  "$ref": "#/components/schemas/Person",
                },
              },
            },
            "description": "Default Response",
            "links": Object {
              "GetPeople": Object {
                "operationId": "getPeople",
                "parameters": Object {
                  "where.parentId.eq": "$response.body#/id",
                },
              },
              "GetPersonById": Object {
                "operationId": "getPersonById",
                "parameters": Object {
                  "id": "$response.body#/parentId",
                },
              },
            },
          },
        },
      },
      "post": Object {
        "parameters": Array [
          Object {
            "in": "query",
            "name": "fields",
            "required": false,
            "schema": Object {
              "items": Object {
                "enum": Array [
                  "id",
                  "name",
                  "parentId",
                ],
                "type": "string",
              },
              "type": "array",
            },
          },
          Object {
            "in": "path",
            "name": "id",
            "required": true,
            "schema": Object {
              "type": "integer",
            },
          },
        ],
        "requestBody": Object {
          "content": Object {
            "application/json": Object {
              "schema": Object {
                "$ref": "#/components/schemas/Person",
              },
            },
          },
        },
        "responses": Object {
          "200": Object {
            "content": Object {
              "application/json": Object {
                "schema": Object {
                  "$ref": "#/components/schemas/Person",
                },
              },
            },
            "description": "Default Response",
            "links": Object {
              "GetPeople": Object {
                "operationId": "getPeople",
                "parameters": Object {
                  "where.parentId.eq": "$response.body#/id",
                },
              },
              "GetPersonById": Object {
                "operationId": "getPersonById",
                "parameters": Object {
                  "id": "$response.body#/parentId",
                },
              },
            },
          },
        },
      },
      "put": Object {
        "parameters": Array [
          Object {
            "in": "query",
            "name": "fields",
            "required": false,
            "schema": Object {
              "items": Object {
                "enum": Array [
                  "id",
                  "name",
                  "parentId",
                ],
                "type": "string",
              },
              "type": "array",
            },
          },
          Object {
            "in": "path",
            "name": "id",
            "required": true,
            "schema": Object {
              "type": "integer",
            },
          },
        ],
        "requestBody": Object {
          "content": Object {
            "application/json": Object {
              "schema": Object {
                "$ref": "#/components/schemas/Person",
              },
            },
          },
        },
        "responses": Object {
          "200": Object {
            "content": Object {
              "application/json": Object {
                "schema": Object {
                  "$ref": "#/components/schemas/Person",
                },
              },
            },
            "description": "Default Response",
            "links": Object {
              "GetPeople": Object {
                "operationId": "getPeople",
                "parameters": Object {
                  "where.parentId.eq": "$response.body#/id",
                },
              },
              "GetPersonById": Object {
                "operationId": "getPersonById",
                "parameters": Object {
                  "id": "$response.body#/parentId",
                },
              },
            },
          },
        },
      },
    },
    "/people/{id}/parent": Object {
      "get": Object {
        "operationId": "getPersonForPerson",
        "parameters": Array [
          Object {
            "in": "query",
            "name": "fields",
            "required": false,
            "schema": Object {
              "items": Object {
                "enum": Array [
                  "id",
                  "name",
                  "parentId",
                ],
                "type": "string",
              },
              "type": "array",
            },
          },
          Object {
            "in": "path",
            "name": "id",
            "required": true,
            "schema": Object {
              "type": "integer",
            },
          },
        ],
        "responses": Object {
          "200": Object {
            "content": Object {
              "application/json": Object {
                "schema": Object {
                  "$ref": "#/components/schemas/Person",
                },
              },
            },
            "description": "Default Response",
            "links": Object {
              "GetPeople": Object {
                "operationId": "getPeople",
                "parameters": Object {
                  "where.parentId.eq": "$response.body#/id",
                },
              },
              "GetPersonById": Object {
                "operationId": "getPersonById",
                "parameters": Object {
                  "id": "$response.body#/parentId",
                },
              },
            },
          },
        },
      },
    },
    "/people/{id}/people": Object {
      "get": Object {
        "operationId": "getPeopleForPerson",
        "parameters": Array [
          Object {
            "in": "query",
            "name": "fields",
            "required": false,
            "schema": Object {
              "items": Object {
                "enum": Array [
                  "id",
                  "name",
                  "parentId",
                ],
                "type": "string",
              },
              "type": "array",
            },
          },
          Object {
            "in": "path",
            "name": "id",
            "required": true,
            "schema": Object {
              "type": "integer",
            },
          },
        ],
        "responses": Object {
          "200": Object {
            "content": Object {
              "application/json": Object {
                "schema": Object {
                  "items": Object {
                    "$ref": "#/components/schemas/Person",
                  },
                  "type": "array",
                },
              },
            },
            "description": "Default Response",
            "links": Object {
              "GetPeople": Object {
                "operationId": "getPeople",
                "parameters": Object {
                  "where.parentId.eq": "$response.body#/id",
                },
              },
              "GetPersonById": Object {
                "operationId": "getPersonById",
                "parameters": Object {
                  "id": "$response.body#/parentId",
                },
              },
            },
          },
        },
      },
    },
  },
}
`
