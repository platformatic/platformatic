/* IMPORTANT
 * This snapshot file is auto-generated, but designed for humans.
 * It should be checked into source control and tracked carefully.
 * Re-generate by setting TAP_SNAPSHOT=1 and running tests.
 * Make sure to inspect the output below.  Do not ignore changes!
 */
'use strict'
exports['platformatic/db/openapi/simple nullable fields > GET /documentation/json response 1'] = `
Object {
  "components": Object {
    "schemas": Object {
      "Page": Object {
        "description": "A Page",
        "properties": Object {
          "id": Object {
            "type": "integer",
          },
          "title": Object {
            "nullable": true,
            "type": "string",
          },
        },
        "required": Array [],
        "title": "Page",
        "type": "object",
      },
      "Test1": Object {
        "description": "A Test1",
        "properties": Object {
          "id": Object {
            "type": "string",
          },
        },
        "required": Array [],
        "title": "Test1",
        "type": "object",
      },
      "Test2": Object {
        "description": "A Test2",
        "properties": Object {
          "customId": Object {
            "type": "string",
          },
          "fkId": Object {
            "type": "string",
          },
          "id": Object {
            "type": "string",
          },
        },
        "required": Array [
          "fkId",
          "customId",
        ],
        "title": "Test2",
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
    "/pages/": Object {
      "get": Object {
        "operationId": "getPages",
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
                  "title",
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
            "name": "where.title.eq",
            "required": false,
            "schema": Object {
              "type": "string",
            },
          },
          Object {
            "in": "query",
            "name": "where.title.neq",
            "required": false,
            "schema": Object {
              "type": "string",
            },
          },
          Object {
            "in": "query",
            "name": "where.title.gt",
            "required": false,
            "schema": Object {
              "type": "string",
            },
          },
          Object {
            "in": "query",
            "name": "where.title.gte",
            "required": false,
            "schema": Object {
              "type": "string",
            },
          },
          Object {
            "in": "query",
            "name": "where.title.lt",
            "required": false,
            "schema": Object {
              "type": "string",
            },
          },
          Object {
            "in": "query",
            "name": "where.title.lte",
            "required": false,
            "schema": Object {
              "type": "string",
            },
          },
          Object {
            "in": "query",
            "name": "where.title.like",
            "required": false,
            "schema": Object {
              "type": "string",
            },
          },
          Object {
            "in": "query",
            "name": "where.title.in",
            "required": false,
            "schema": Object {
              "type": "string",
            },
          },
          Object {
            "in": "query",
            "name": "where.title.nin",
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
            "name": "orderby.title",
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
                    "$ref": "#/components/schemas/Page",
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
                "$ref": "#/components/schemas/Page",
              },
            },
          },
        },
        "responses": Object {
          "200": Object {
            "content": Object {
              "application/json": Object {
                "schema": Object {
                  "$ref": "#/components/schemas/Page",
                },
              },
            },
            "description": "Default Response",
            "links": Object {},
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
                  "title",
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
            "name": "where.title.eq",
            "required": false,
            "schema": Object {
              "type": "string",
            },
          },
          Object {
            "in": "query",
            "name": "where.title.neq",
            "required": false,
            "schema": Object {
              "type": "string",
            },
          },
          Object {
            "in": "query",
            "name": "where.title.gt",
            "required": false,
            "schema": Object {
              "type": "string",
            },
          },
          Object {
            "in": "query",
            "name": "where.title.gte",
            "required": false,
            "schema": Object {
              "type": "string",
            },
          },
          Object {
            "in": "query",
            "name": "where.title.lt",
            "required": false,
            "schema": Object {
              "type": "string",
            },
          },
          Object {
            "in": "query",
            "name": "where.title.lte",
            "required": false,
            "schema": Object {
              "type": "string",
            },
          },
          Object {
            "in": "query",
            "name": "where.title.like",
            "required": false,
            "schema": Object {
              "type": "string",
            },
          },
          Object {
            "in": "query",
            "name": "where.title.in",
            "required": false,
            "schema": Object {
              "type": "string",
            },
          },
          Object {
            "in": "query",
            "name": "where.title.nin",
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
                "$ref": "#/components/schemas/Page",
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
                    "$ref": "#/components/schemas/Page",
                  },
                  "type": "array",
                },
              },
            },
            "description": "Default Response",
            "links": Object {},
          },
        },
      },
    },
    "/pages/{id}": Object {
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
                  "title",
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
                  "$ref": "#/components/schemas/Page",
                },
              },
            },
            "description": "Default Response",
          },
        },
      },
      "get": Object {
        "operationId": "getPageById",
        "parameters": Array [
          Object {
            "in": "query",
            "name": "fields",
            "required": false,
            "schema": Object {
              "items": Object {
                "enum": Array [
                  "id",
                  "title",
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
                  "$ref": "#/components/schemas/Page",
                },
              },
            },
            "description": "Default Response",
            "links": Object {},
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
                  "title",
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
                "$ref": "#/components/schemas/Page",
              },
            },
          },
        },
        "responses": Object {
          "200": Object {
            "content": Object {
              "application/json": Object {
                "schema": Object {
                  "$ref": "#/components/schemas/Page",
                },
              },
            },
            "description": "Default Response",
            "links": Object {},
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
                  "title",
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
                "$ref": "#/components/schemas/Page",
              },
            },
          },
        },
        "responses": Object {
          "200": Object {
            "content": Object {
              "application/json": Object {
                "schema": Object {
                  "$ref": "#/components/schemas/Page",
                },
              },
            },
            "description": "Default Response",
            "links": Object {},
          },
        },
      },
    },
    "/test1/": Object {
      "get": Object {
        "operationId": "getTest1",
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
              "type": "string",
            },
          },
          Object {
            "in": "query",
            "name": "where.id.neq",
            "required": false,
            "schema": Object {
              "type": "string",
            },
          },
          Object {
            "in": "query",
            "name": "where.id.gt",
            "required": false,
            "schema": Object {
              "type": "string",
            },
          },
          Object {
            "in": "query",
            "name": "where.id.gte",
            "required": false,
            "schema": Object {
              "type": "string",
            },
          },
          Object {
            "in": "query",
            "name": "where.id.lt",
            "required": false,
            "schema": Object {
              "type": "string",
            },
          },
          Object {
            "in": "query",
            "name": "where.id.lte",
            "required": false,
            "schema": Object {
              "type": "string",
            },
          },
          Object {
            "in": "query",
            "name": "where.id.like",
            "required": false,
            "schema": Object {
              "type": "string",
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
        ],
        "responses": Object {
          "200": Object {
            "content": Object {
              "application/json": Object {
                "schema": Object {
                  "items": Object {
                    "$ref": "#/components/schemas/Test1",
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
                "$ref": "#/components/schemas/Test1",
              },
            },
          },
        },
        "responses": Object {
          "200": Object {
            "content": Object {
              "application/json": Object {
                "schema": Object {
                  "$ref": "#/components/schemas/Test1",
                },
              },
            },
            "description": "Default Response",
            "links": Object {
              "GetTest2": Object {
                "operationId": "getTest2",
                "parameters": Object {
                  "where.fkId.eq": "$response.body#/id",
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
              "type": "string",
            },
          },
          Object {
            "in": "query",
            "name": "where.id.neq",
            "required": false,
            "schema": Object {
              "type": "string",
            },
          },
          Object {
            "in": "query",
            "name": "where.id.gt",
            "required": false,
            "schema": Object {
              "type": "string",
            },
          },
          Object {
            "in": "query",
            "name": "where.id.gte",
            "required": false,
            "schema": Object {
              "type": "string",
            },
          },
          Object {
            "in": "query",
            "name": "where.id.lt",
            "required": false,
            "schema": Object {
              "type": "string",
            },
          },
          Object {
            "in": "query",
            "name": "where.id.lte",
            "required": false,
            "schema": Object {
              "type": "string",
            },
          },
          Object {
            "in": "query",
            "name": "where.id.like",
            "required": false,
            "schema": Object {
              "type": "string",
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
        ],
        "requestBody": Object {
          "content": Object {
            "application/json": Object {
              "schema": Object {
                "$ref": "#/components/schemas/Test1",
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
                    "$ref": "#/components/schemas/Test1",
                  },
                  "type": "array",
                },
              },
            },
            "description": "Default Response",
            "links": Object {
              "GetTest2": Object {
                "operationId": "getTest2",
                "parameters": Object {
                  "where.fkId.eq": "$response.body#/id",
                },
              },
            },
          },
        },
      },
    },
    "/test1/{id}": Object {
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
              "type": "string",
            },
          },
        ],
        "responses": Object {
          "200": Object {
            "content": Object {
              "application/json": Object {
                "schema": Object {
                  "$ref": "#/components/schemas/Test1",
                },
              },
            },
            "description": "Default Response",
          },
        },
      },
      "get": Object {
        "operationId": "getTest1ById",
        "parameters": Array [
          Object {
            "in": "query",
            "name": "fields",
            "required": false,
            "schema": Object {
              "items": Object {
                "enum": Array [
                  "id",
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
              "type": "string",
            },
          },
        ],
        "responses": Object {
          "200": Object {
            "content": Object {
              "application/json": Object {
                "schema": Object {
                  "$ref": "#/components/schemas/Test1",
                },
              },
            },
            "description": "Default Response",
            "links": Object {
              "GetTest2": Object {
                "operationId": "getTest2",
                "parameters": Object {
                  "where.fkId.eq": "$response.body#/id",
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
              "type": "string",
            },
          },
        ],
        "requestBody": Object {
          "content": Object {
            "application/json": Object {
              "schema": Object {
                "$ref": "#/components/schemas/Test1",
              },
            },
          },
        },
        "responses": Object {
          "200": Object {
            "content": Object {
              "application/json": Object {
                "schema": Object {
                  "$ref": "#/components/schemas/Test1",
                },
              },
            },
            "description": "Default Response",
            "links": Object {
              "GetTest2": Object {
                "operationId": "getTest2",
                "parameters": Object {
                  "where.fkId.eq": "$response.body#/id",
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
              "type": "string",
            },
          },
        ],
        "requestBody": Object {
          "content": Object {
            "application/json": Object {
              "schema": Object {
                "$ref": "#/components/schemas/Test1",
              },
            },
          },
        },
        "responses": Object {
          "200": Object {
            "content": Object {
              "application/json": Object {
                "schema": Object {
                  "$ref": "#/components/schemas/Test1",
                },
              },
            },
            "description": "Default Response",
            "links": Object {
              "GetTest2": Object {
                "operationId": "getTest2",
                "parameters": Object {
                  "where.fkId.eq": "$response.body#/id",
                },
              },
            },
          },
        },
      },
    },
    "/test1/{id}/customId": Object {
      "get": Object {
        "operationId": "getTest2ForTest1",
        "parameters": Array [
          Object {
            "in": "query",
            "name": "fields",
            "required": false,
            "schema": Object {
              "items": Object {
                "enum": Array [
                  "customId",
                  "fkId",
                  "id",
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
                    "$ref": "#/components/schemas/Test2",
                  },
                  "type": "array",
                },
              },
            },
            "description": "Default Response",
            "links": Object {
              "GetTest1ById": Object {
                "operationId": "getTest1ById",
                "parameters": Object {
                  "id": "$response.body#/fkId",
                },
              },
            },
          },
        },
      },
    },
    "/test1/{id}/fkId": Object {
      "get": Object {
        "operationId": "getTest2ForTest1",
        "parameters": Array [
          Object {
            "in": "query",
            "name": "fields",
            "required": false,
            "schema": Object {
              "items": Object {
                "enum": Array [
                  "customId",
                  "fkId",
                  "id",
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
                    "$ref": "#/components/schemas/Test2",
                  },
                  "type": "array",
                },
              },
            },
            "description": "Default Response",
            "links": Object {
              "GetTest1ById": Object {
                "operationId": "getTest1ById",
                "parameters": Object {
                  "id": "$response.body#/fkId",
                },
              },
            },
          },
        },
      },
    },
    "/test2/": Object {
      "get": Object {
        "operationId": "getTest2",
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
                  "customId",
                  "fkId",
                  "id",
                ],
                "type": "string",
              },
              "type": "array",
            },
          },
          Object {
            "in": "query",
            "name": "where.customId.eq",
            "required": false,
            "schema": Object {
              "type": "string",
            },
          },
          Object {
            "in": "query",
            "name": "where.customId.neq",
            "required": false,
            "schema": Object {
              "type": "string",
            },
          },
          Object {
            "in": "query",
            "name": "where.customId.gt",
            "required": false,
            "schema": Object {
              "type": "string",
            },
          },
          Object {
            "in": "query",
            "name": "where.customId.gte",
            "required": false,
            "schema": Object {
              "type": "string",
            },
          },
          Object {
            "in": "query",
            "name": "where.customId.lt",
            "required": false,
            "schema": Object {
              "type": "string",
            },
          },
          Object {
            "in": "query",
            "name": "where.customId.lte",
            "required": false,
            "schema": Object {
              "type": "string",
            },
          },
          Object {
            "in": "query",
            "name": "where.customId.like",
            "required": false,
            "schema": Object {
              "type": "string",
            },
          },
          Object {
            "in": "query",
            "name": "where.customId.in",
            "required": false,
            "schema": Object {
              "type": "string",
            },
          },
          Object {
            "in": "query",
            "name": "where.customId.nin",
            "required": false,
            "schema": Object {
              "type": "string",
            },
          },
          Object {
            "in": "query",
            "name": "where.fkId.eq",
            "required": false,
            "schema": Object {
              "type": "string",
            },
          },
          Object {
            "in": "query",
            "name": "where.fkId.neq",
            "required": false,
            "schema": Object {
              "type": "string",
            },
          },
          Object {
            "in": "query",
            "name": "where.fkId.gt",
            "required": false,
            "schema": Object {
              "type": "string",
            },
          },
          Object {
            "in": "query",
            "name": "where.fkId.gte",
            "required": false,
            "schema": Object {
              "type": "string",
            },
          },
          Object {
            "in": "query",
            "name": "where.fkId.lt",
            "required": false,
            "schema": Object {
              "type": "string",
            },
          },
          Object {
            "in": "query",
            "name": "where.fkId.lte",
            "required": false,
            "schema": Object {
              "type": "string",
            },
          },
          Object {
            "in": "query",
            "name": "where.fkId.like",
            "required": false,
            "schema": Object {
              "type": "string",
            },
          },
          Object {
            "in": "query",
            "name": "where.fkId.in",
            "required": false,
            "schema": Object {
              "type": "string",
            },
          },
          Object {
            "in": "query",
            "name": "where.fkId.nin",
            "required": false,
            "schema": Object {
              "type": "string",
            },
          },
          Object {
            "in": "query",
            "name": "where.id.eq",
            "required": false,
            "schema": Object {
              "type": "string",
            },
          },
          Object {
            "in": "query",
            "name": "where.id.neq",
            "required": false,
            "schema": Object {
              "type": "string",
            },
          },
          Object {
            "in": "query",
            "name": "where.id.gt",
            "required": false,
            "schema": Object {
              "type": "string",
            },
          },
          Object {
            "in": "query",
            "name": "where.id.gte",
            "required": false,
            "schema": Object {
              "type": "string",
            },
          },
          Object {
            "in": "query",
            "name": "where.id.lt",
            "required": false,
            "schema": Object {
              "type": "string",
            },
          },
          Object {
            "in": "query",
            "name": "where.id.lte",
            "required": false,
            "schema": Object {
              "type": "string",
            },
          },
          Object {
            "in": "query",
            "name": "where.id.like",
            "required": false,
            "schema": Object {
              "type": "string",
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
            "name": "orderby.customId",
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
            "name": "orderby.fkId",
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
        ],
        "responses": Object {
          "200": Object {
            "content": Object {
              "application/json": Object {
                "schema": Object {
                  "items": Object {
                    "$ref": "#/components/schemas/Test2",
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
                "$ref": "#/components/schemas/Test2",
              },
            },
          },
        },
        "responses": Object {
          "200": Object {
            "content": Object {
              "application/json": Object {
                "schema": Object {
                  "$ref": "#/components/schemas/Test2",
                },
              },
            },
            "description": "Default Response",
            "links": Object {
              "GetTest1ById": Object {
                "operationId": "getTest1ById",
                "parameters": Object {
                  "id": "$response.body#/fkId",
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
                  "customId",
                  "fkId",
                  "id",
                ],
                "type": "string",
              },
              "type": "array",
            },
          },
          Object {
            "in": "query",
            "name": "where.customId.eq",
            "required": false,
            "schema": Object {
              "type": "string",
            },
          },
          Object {
            "in": "query",
            "name": "where.customId.neq",
            "required": false,
            "schema": Object {
              "type": "string",
            },
          },
          Object {
            "in": "query",
            "name": "where.customId.gt",
            "required": false,
            "schema": Object {
              "type": "string",
            },
          },
          Object {
            "in": "query",
            "name": "where.customId.gte",
            "required": false,
            "schema": Object {
              "type": "string",
            },
          },
          Object {
            "in": "query",
            "name": "where.customId.lt",
            "required": false,
            "schema": Object {
              "type": "string",
            },
          },
          Object {
            "in": "query",
            "name": "where.customId.lte",
            "required": false,
            "schema": Object {
              "type": "string",
            },
          },
          Object {
            "in": "query",
            "name": "where.customId.like",
            "required": false,
            "schema": Object {
              "type": "string",
            },
          },
          Object {
            "in": "query",
            "name": "where.customId.in",
            "required": false,
            "schema": Object {
              "type": "string",
            },
          },
          Object {
            "in": "query",
            "name": "where.customId.nin",
            "required": false,
            "schema": Object {
              "type": "string",
            },
          },
          Object {
            "in": "query",
            "name": "where.fkId.eq",
            "required": false,
            "schema": Object {
              "type": "string",
            },
          },
          Object {
            "in": "query",
            "name": "where.fkId.neq",
            "required": false,
            "schema": Object {
              "type": "string",
            },
          },
          Object {
            "in": "query",
            "name": "where.fkId.gt",
            "required": false,
            "schema": Object {
              "type": "string",
            },
          },
          Object {
            "in": "query",
            "name": "where.fkId.gte",
            "required": false,
            "schema": Object {
              "type": "string",
            },
          },
          Object {
            "in": "query",
            "name": "where.fkId.lt",
            "required": false,
            "schema": Object {
              "type": "string",
            },
          },
          Object {
            "in": "query",
            "name": "where.fkId.lte",
            "required": false,
            "schema": Object {
              "type": "string",
            },
          },
          Object {
            "in": "query",
            "name": "where.fkId.like",
            "required": false,
            "schema": Object {
              "type": "string",
            },
          },
          Object {
            "in": "query",
            "name": "where.fkId.in",
            "required": false,
            "schema": Object {
              "type": "string",
            },
          },
          Object {
            "in": "query",
            "name": "where.fkId.nin",
            "required": false,
            "schema": Object {
              "type": "string",
            },
          },
          Object {
            "in": "query",
            "name": "where.id.eq",
            "required": false,
            "schema": Object {
              "type": "string",
            },
          },
          Object {
            "in": "query",
            "name": "where.id.neq",
            "required": false,
            "schema": Object {
              "type": "string",
            },
          },
          Object {
            "in": "query",
            "name": "where.id.gt",
            "required": false,
            "schema": Object {
              "type": "string",
            },
          },
          Object {
            "in": "query",
            "name": "where.id.gte",
            "required": false,
            "schema": Object {
              "type": "string",
            },
          },
          Object {
            "in": "query",
            "name": "where.id.lt",
            "required": false,
            "schema": Object {
              "type": "string",
            },
          },
          Object {
            "in": "query",
            "name": "where.id.lte",
            "required": false,
            "schema": Object {
              "type": "string",
            },
          },
          Object {
            "in": "query",
            "name": "where.id.like",
            "required": false,
            "schema": Object {
              "type": "string",
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
        ],
        "requestBody": Object {
          "content": Object {
            "application/json": Object {
              "schema": Object {
                "$ref": "#/components/schemas/Test2",
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
                    "$ref": "#/components/schemas/Test2",
                  },
                  "type": "array",
                },
              },
            },
            "description": "Default Response",
            "links": Object {
              "GetTest1ById": Object {
                "operationId": "getTest1ById",
                "parameters": Object {
                  "id": "$response.body#/fkId",
                },
              },
            },
          },
        },
      },
    },
    "/test2/{id}": Object {
      "delete": Object {
        "parameters": Array [
          Object {
            "in": "query",
            "name": "fields",
            "required": false,
            "schema": Object {
              "items": Object {
                "enum": Array [
                  "customId",
                  "fkId",
                  "id",
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
              "type": "string",
            },
          },
        ],
        "responses": Object {
          "200": Object {
            "content": Object {
              "application/json": Object {
                "schema": Object {
                  "$ref": "#/components/schemas/Test2",
                },
              },
            },
            "description": "Default Response",
          },
        },
      },
      "get": Object {
        "operationId": "getTest2ById",
        "parameters": Array [
          Object {
            "in": "query",
            "name": "fields",
            "required": false,
            "schema": Object {
              "items": Object {
                "enum": Array [
                  "customId",
                  "fkId",
                  "id",
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
              "type": "string",
            },
          },
        ],
        "responses": Object {
          "200": Object {
            "content": Object {
              "application/json": Object {
                "schema": Object {
                  "$ref": "#/components/schemas/Test2",
                },
              },
            },
            "description": "Default Response",
            "links": Object {
              "GetTest1ById": Object {
                "operationId": "getTest1ById",
                "parameters": Object {
                  "id": "$response.body#/fkId",
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
                  "customId",
                  "fkId",
                  "id",
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
              "type": "string",
            },
          },
        ],
        "requestBody": Object {
          "content": Object {
            "application/json": Object {
              "schema": Object {
                "$ref": "#/components/schemas/Test2",
              },
            },
          },
        },
        "responses": Object {
          "200": Object {
            "content": Object {
              "application/json": Object {
                "schema": Object {
                  "$ref": "#/components/schemas/Test2",
                },
              },
            },
            "description": "Default Response",
            "links": Object {
              "GetTest1ById": Object {
                "operationId": "getTest1ById",
                "parameters": Object {
                  "id": "$response.body#/fkId",
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
                  "customId",
                  "fkId",
                  "id",
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
              "type": "string",
            },
          },
        ],
        "requestBody": Object {
          "content": Object {
            "application/json": Object {
              "schema": Object {
                "$ref": "#/components/schemas/Test2",
              },
            },
          },
        },
        "responses": Object {
          "200": Object {
            "content": Object {
              "application/json": Object {
                "schema": Object {
                  "$ref": "#/components/schemas/Test2",
                },
              },
            },
            "description": "Default Response",
            "links": Object {
              "GetTest1ById": Object {
                "operationId": "getTest1ById",
                "parameters": Object {
                  "id": "$response.body#/fkId",
                },
              },
            },
          },
        },
      },
    },
    "/test2/{id}/custom": Object {
      "get": Object {
        "operationId": "getTest1ForTest2",
        "parameters": Array [
          Object {
            "in": "query",
            "name": "fields",
            "required": false,
            "schema": Object {
              "items": Object {
                "enum": Array [
                  "id",
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
              "type": "string",
            },
          },
        ],
        "responses": Object {
          "200": Object {
            "content": Object {
              "application/json": Object {
                "schema": Object {
                  "$ref": "#/components/schemas/Test1",
                },
              },
            },
            "description": "Default Response",
            "links": Object {
              "GetTest2": Object {
                "operationId": "getTest2",
                "parameters": Object {
                  "where.fkId.eq": "$response.body#/id",
                },
              },
            },
          },
        },
      },
    },
    "/test2/{id}/fk": Object {
      "get": Object {
        "operationId": "getTest1ForTest2",
        "parameters": Array [
          Object {
            "in": "query",
            "name": "fields",
            "required": false,
            "schema": Object {
              "items": Object {
                "enum": Array [
                  "id",
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
              "type": "string",
            },
          },
        ],
        "responses": Object {
          "200": Object {
            "content": Object {
              "application/json": Object {
                "schema": Object {
                  "$ref": "#/components/schemas/Test1",
                },
              },
            },
            "description": "Default Response",
            "links": Object {
              "GetTest2": Object {
                "operationId": "getTest2",
                "parameters": Object {
                  "where.fkId.eq": "$response.body#/id",
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
