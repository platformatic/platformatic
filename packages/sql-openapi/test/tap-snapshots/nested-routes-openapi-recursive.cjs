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
            "nullable": true,
            "type": "integer",
          },
          "name": Object {
            "nullable": true,
            "type": "string",
          },
          "parentId": Object {
            "nullable": true,
            "type": "integer",
          },
        },
        "title": "Person",
        "type": "object",
      },
      "PersonInput": Object {
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
        "title": "PersonInput",
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
        "description": "Fetch people from the database.",
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
            "name": "where.id.contains",
            "required": false,
            "schema": Object {
              "type": "string",
            },
          },
          Object {
            "in": "query",
            "name": "where.id.contained",
            "required": false,
            "schema": Object {
              "type": "string",
            },
          },
          Object {
            "in": "query",
            "name": "where.id.overlaps",
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
            "name": "where.name.contains",
            "required": false,
            "schema": Object {
              "type": "string",
            },
          },
          Object {
            "in": "query",
            "name": "where.name.contained",
            "required": false,
            "schema": Object {
              "type": "string",
            },
          },
          Object {
            "in": "query",
            "name": "where.name.overlaps",
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
            "name": "where.parentId.contains",
            "required": false,
            "schema": Object {
              "type": "string",
            },
          },
          Object {
            "in": "query",
            "name": "where.parentId.contained",
            "required": false,
            "schema": Object {
              "type": "string",
            },
          },
          Object {
            "in": "query",
            "name": "where.parentId.overlaps",
            "required": false,
            "schema": Object {
              "type": "string",
            },
          },
          Object {
            "in": "query",
            "name": "where.or",
            "required": false,
            "schema": Object {
              "items": Object {
                "type": "string",
              },
              "type": "array",
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
        "summary": "Get people.",
        "tags": Array [
          "people",
        ],
      },
      "post": Object {
        "description": "Add new person to the database.",
        "operationId": "createPerson",
        "requestBody": Object {
          "content": Object {
            "application/json": Object {
              "schema": Object {
                "$ref": "#/components/schemas/PersonInput",
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
        "summary": "Create person.",
        "tags": Array [
          "people",
        ],
      },
      "put": Object {
        "description": "Update one or more people in the database.",
        "operationId": "updatePeople",
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
            "name": "where.id.contains",
            "required": false,
            "schema": Object {
              "type": "string",
            },
          },
          Object {
            "in": "query",
            "name": "where.id.contained",
            "required": false,
            "schema": Object {
              "type": "string",
            },
          },
          Object {
            "in": "query",
            "name": "where.id.overlaps",
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
            "name": "where.name.contains",
            "required": false,
            "schema": Object {
              "type": "string",
            },
          },
          Object {
            "in": "query",
            "name": "where.name.contained",
            "required": false,
            "schema": Object {
              "type": "string",
            },
          },
          Object {
            "in": "query",
            "name": "where.name.overlaps",
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
            "name": "where.parentId.contains",
            "required": false,
            "schema": Object {
              "type": "string",
            },
          },
          Object {
            "in": "query",
            "name": "where.parentId.contained",
            "required": false,
            "schema": Object {
              "type": "string",
            },
          },
          Object {
            "in": "query",
            "name": "where.parentId.overlaps",
            "required": false,
            "schema": Object {
              "type": "string",
            },
          },
          Object {
            "in": "query",
            "name": "where.or",
            "required": false,
            "schema": Object {
              "items": Object {
                "type": "string",
              },
              "type": "array",
            },
          },
        ],
        "requestBody": Object {
          "content": Object {
            "application/json": Object {
              "schema": Object {
                "$ref": "#/components/schemas/PersonInput",
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
        "summary": "Update people.",
        "tags": Array [
          "people",
        ],
      },
    },
    "/people/{id}": Object {
      "delete": Object {
        "description": "Delete one or more people from the Database.",
        "operationId": "deletePeople",
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
        "summary": "Delete people.",
        "tags": Array [
          "people",
        ],
      },
      "get": Object {
        "description": "Fetch Person using its id from the database.",
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
        "summary": "Get Person by id.",
        "tags": Array [
          "people",
        ],
      },
      "put": Object {
        "description": "Update person in the database.",
        "operationId": "updatePerson",
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
                "$ref": "#/components/schemas/PersonInput",
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
        "summary": "Update person.",
        "tags": Array [
          "people",
        ],
      },
    },
    "/people/{id}/parent": Object {
      "get": Object {
        "description": "Fetch the person for person from the database.",
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
        "summary": "Get person for person.",
        "tags": Array [
          "people",
        ],
      },
    },
    "/people/{id}/people": Object {
      "get": Object {
        "description": "Fetch all the people for person from the database.",
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
        "summary": "Get people for person.",
        "tags": Array [
          "people",
        ],
      },
    },
  },
}
`
