/* IMPORTANT
 * This snapshot file is auto-generated, but designed for humans.
 * It should be checked into source control and tracked carefully.
 * Re-generate by setting TAP_SNAPSHOT=1 and running tests.
 * Make sure to inspect the output below.  Do not ignore changes!
 */
'use strict'
exports['platformatic/db/openapi/where nested routes > matches expected OpenAPI defs 1'] = `
Object {
  "components": Object {
    "schemas": Object {
      "Owner": Object {
        "description": "A Owner",
        "properties": Object {
          "id": Object {
            "type": "integer",
          },
          "name": Object {
            "nullable": true,
            "type": "string",
          },
        },
        "required": Array [],
        "title": "Owner",
        "type": "object",
      },
      "Post": Object {
        "description": "A Post",
        "properties": Object {
          "counter": Object {
            "nullable": true,
            "type": "integer",
          },
          "id": Object {
            "type": "integer",
          },
          "longText": Object {
            "nullable": true,
            "type": "string",
          },
          "ownerId": Object {
            "nullable": true,
            "type": "integer",
          },
          "title": Object {
            "nullable": true,
            "type": "string",
          },
        },
        "required": Array [],
        "title": "Post",
        "type": "object",
      },
    },
  },
  "info": Object {
    "description": "Exposing a SQL database as REST",
    "title": "Platformatic DB",
    "version": "0.3.0",
  },
  "openapi": "3.0.3",
  "paths": Object {
    "/owners/": Object {
      "get": Object {
        "operationId": "getOwners",
        "parameters": Array [
          Object {
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
        ],
        "responses": Object {
          "200": Object {
            "content": Object {
              "application/json": Object {
                "schema": Object {
                  "items": Object {
                    "$ref": "#/components/schemas/Owner",
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
                "$ref": "#/components/schemas/Owner",
              },
            },
          },
        },
        "responses": Object {
          "200": Object {
            "content": Object {
              "application/json": Object {
                "schema": Object {
                  "$ref": "#/components/schemas/Owner",
                },
              },
            },
            "description": "Default Response",
            "links": Object {
              "GetPosts": Object {
                "operationId": "getPosts",
                "parameters": Object {
                  "where.ownerId.eq": "$response.body#/id",
                },
              },
            },
          },
        },
      },
    },
    "/owners/{id}": Object {
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
                  "$ref": "#/components/schemas/Owner",
                },
              },
            },
            "description": "Default Response",
          },
        },
      },
      "get": Object {
        "operationId": "getOwnerById",
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
                  "$ref": "#/components/schemas/Owner",
                },
              },
            },
            "description": "Default Response",
            "links": Object {
              "GetPosts": Object {
                "operationId": "getPosts",
                "parameters": Object {
                  "where.ownerId.eq": "$response.body#/id",
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
                "$ref": "#/components/schemas/Owner",
              },
            },
          },
        },
        "responses": Object {
          "200": Object {
            "content": Object {
              "application/json": Object {
                "schema": Object {
                  "$ref": "#/components/schemas/Owner",
                },
              },
            },
            "description": "Default Response",
            "links": Object {
              "GetPosts": Object {
                "operationId": "getPosts",
                "parameters": Object {
                  "where.ownerId.eq": "$response.body#/id",
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
                "$ref": "#/components/schemas/Owner",
              },
            },
          },
        },
        "responses": Object {
          "200": Object {
            "content": Object {
              "application/json": Object {
                "schema": Object {
                  "$ref": "#/components/schemas/Owner",
                },
              },
            },
            "description": "Default Response",
            "links": Object {
              "GetPosts": Object {
                "operationId": "getPosts",
                "parameters": Object {
                  "where.ownerId.eq": "$response.body#/id",
                },
              },
            },
          },
        },
      },
    },
    "/owners/{id}/posts": Object {
      "get": Object {
        "operationId": "getPostsForOwner",
        "parameters": Array [
          Object {
            "in": "query",
            "name": "fields",
            "required": false,
            "schema": Object {
              "items": Object {
                "enum": Array [
                  "counter",
                  "id",
                  "longText",
                  "ownerId",
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
                  "items": Object {
                    "$ref": "#/components/schemas/Post",
                  },
                  "type": "array",
                },
              },
            },
            "description": "Default Response",
            "links": Object {
              "GetOwnerById": Object {
                "operationId": "getOwnerById",
                "parameters": Object {
                  "id": "$response.body#/ownerId",
                },
              },
            },
          },
        },
      },
    },
    "/posts/": Object {
      "get": Object {
        "operationId": "getPosts",
        "parameters": Array [
          Object {
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
                  "counter",
                  "id",
                  "longText",
                  "ownerId",
                  "title",
                ],
                "type": "string",
              },
              "type": "array",
            },
          },
          Object {
            "in": "query",
            "name": "where.counter.eq",
            "required": false,
            "schema": Object {
              "type": "integer",
            },
          },
          Object {
            "in": "query",
            "name": "where.counter.neq",
            "required": false,
            "schema": Object {
              "type": "integer",
            },
          },
          Object {
            "in": "query",
            "name": "where.counter.gt",
            "required": false,
            "schema": Object {
              "type": "integer",
            },
          },
          Object {
            "in": "query",
            "name": "where.counter.gte",
            "required": false,
            "schema": Object {
              "type": "integer",
            },
          },
          Object {
            "in": "query",
            "name": "where.counter.lt",
            "required": false,
            "schema": Object {
              "type": "integer",
            },
          },
          Object {
            "in": "query",
            "name": "where.counter.lte",
            "required": false,
            "schema": Object {
              "type": "integer",
            },
          },
          Object {
            "in": "query",
            "name": "where.counter.in",
            "required": false,
            "schema": Object {
              "type": "string",
            },
          },
          Object {
            "in": "query",
            "name": "where.counter.nin",
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
            "name": "where.longText.eq",
            "required": false,
            "schema": Object {
              "type": "string",
            },
          },
          Object {
            "in": "query",
            "name": "where.longText.neq",
            "required": false,
            "schema": Object {
              "type": "string",
            },
          },
          Object {
            "in": "query",
            "name": "where.longText.gt",
            "required": false,
            "schema": Object {
              "type": "string",
            },
          },
          Object {
            "in": "query",
            "name": "where.longText.gte",
            "required": false,
            "schema": Object {
              "type": "string",
            },
          },
          Object {
            "in": "query",
            "name": "where.longText.lt",
            "required": false,
            "schema": Object {
              "type": "string",
            },
          },
          Object {
            "in": "query",
            "name": "where.longText.lte",
            "required": false,
            "schema": Object {
              "type": "string",
            },
          },
          Object {
            "in": "query",
            "name": "where.longText.in",
            "required": false,
            "schema": Object {
              "type": "string",
            },
          },
          Object {
            "in": "query",
            "name": "where.longText.nin",
            "required": false,
            "schema": Object {
              "type": "string",
            },
          },
          Object {
            "in": "query",
            "name": "where.ownerId.eq",
            "required": false,
            "schema": Object {
              "type": "integer",
            },
          },
          Object {
            "in": "query",
            "name": "where.ownerId.neq",
            "required": false,
            "schema": Object {
              "type": "integer",
            },
          },
          Object {
            "in": "query",
            "name": "where.ownerId.gt",
            "required": false,
            "schema": Object {
              "type": "integer",
            },
          },
          Object {
            "in": "query",
            "name": "where.ownerId.gte",
            "required": false,
            "schema": Object {
              "type": "integer",
            },
          },
          Object {
            "in": "query",
            "name": "where.ownerId.lt",
            "required": false,
            "schema": Object {
              "type": "integer",
            },
          },
          Object {
            "in": "query",
            "name": "where.ownerId.lte",
            "required": false,
            "schema": Object {
              "type": "integer",
            },
          },
          Object {
            "in": "query",
            "name": "where.ownerId.in",
            "required": false,
            "schema": Object {
              "type": "string",
            },
          },
          Object {
            "in": "query",
            "name": "where.ownerId.nin",
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
            "name": "orderby.counter",
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
          Object {
            "in": "query",
            "name": "orderby.longText",
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
            "name": "orderby.ownerId",
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
                    "$ref": "#/components/schemas/Post",
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
                "$ref": "#/components/schemas/Post",
              },
            },
          },
        },
        "responses": Object {
          "200": Object {
            "content": Object {
              "application/json": Object {
                "schema": Object {
                  "$ref": "#/components/schemas/Post",
                },
              },
            },
            "description": "Default Response",
            "links": Object {
              "GetOwnerById": Object {
                "operationId": "getOwnerById",
                "parameters": Object {
                  "id": "$response.body#/ownerId",
                },
              },
            },
          },
        },
      },
    },
    "/posts/{id}": Object {
      "delete": Object {
        "parameters": Array [
          Object {
            "in": "query",
            "name": "fields",
            "required": false,
            "schema": Object {
              "items": Object {
                "enum": Array [
                  "counter",
                  "id",
                  "longText",
                  "ownerId",
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
                  "$ref": "#/components/schemas/Post",
                },
              },
            },
            "description": "Default Response",
          },
        },
      },
      "get": Object {
        "operationId": "getPostById",
        "parameters": Array [
          Object {
            "in": "query",
            "name": "fields",
            "required": false,
            "schema": Object {
              "items": Object {
                "enum": Array [
                  "counter",
                  "id",
                  "longText",
                  "ownerId",
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
                  "$ref": "#/components/schemas/Post",
                },
              },
            },
            "description": "Default Response",
            "links": Object {
              "GetOwnerById": Object {
                "operationId": "getOwnerById",
                "parameters": Object {
                  "id": "$response.body#/ownerId",
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
                  "counter",
                  "id",
                  "longText",
                  "ownerId",
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
                "$ref": "#/components/schemas/Post",
              },
            },
          },
        },
        "responses": Object {
          "200": Object {
            "content": Object {
              "application/json": Object {
                "schema": Object {
                  "$ref": "#/components/schemas/Post",
                },
              },
            },
            "description": "Default Response",
            "links": Object {
              "GetOwnerById": Object {
                "operationId": "getOwnerById",
                "parameters": Object {
                  "id": "$response.body#/ownerId",
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
                  "counter",
                  "id",
                  "longText",
                  "ownerId",
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
                "$ref": "#/components/schemas/Post",
              },
            },
          },
        },
        "responses": Object {
          "200": Object {
            "content": Object {
              "application/json": Object {
                "schema": Object {
                  "$ref": "#/components/schemas/Post",
                },
              },
            },
            "description": "Default Response",
            "links": Object {
              "GetOwnerById": Object {
                "operationId": "getOwnerById",
                "parameters": Object {
                  "id": "$response.body#/ownerId",
                },
              },
            },
          },
        },
      },
    },
    "/posts/{id}/owner": Object {
      "get": Object {
        "operationId": "getOwnerForPost",
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
                  "$ref": "#/components/schemas/Owner",
                },
              },
            },
            "description": "Default Response",
            "links": Object {
              "GetPosts": Object {
                "operationId": "getPosts",
                "parameters": Object {
                  "where.ownerId.eq": "$response.body#/id",
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
