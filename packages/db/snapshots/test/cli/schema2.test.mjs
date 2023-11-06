export default `\
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
        "tags": [
          "graphs"
        ],
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
            "name": "where.id.contains",
            "required": false
          },
          {
            "schema": {
              "type": "string"
            },
            "in": "query",
            "name": "where.id.contained",
            "required": false
          },
          {
            "schema": {
              "type": "string"
            },
            "in": "query",
            "name": "where.id.overlaps",
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
              "type": "string"
            },
            "in": "query",
            "name": "where.name.contains",
            "required": false
          },
          {
            "schema": {
              "type": "string"
            },
            "in": "query",
            "name": "where.name.contained",
            "required": false
          },
          {
            "schema": {
              "type": "string"
            },
            "in": "query",
            "name": "where.name.overlaps",
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
        "tags": [
          "graphs"
        ],
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
        "tags": [
          "graphs"
        ],
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
            "name": "where.id.contains",
            "required": false
          },
          {
            "schema": {
              "type": "string"
            },
            "in": "query",
            "name": "where.id.contained",
            "required": false
          },
          {
            "schema": {
              "type": "string"
            },
            "in": "query",
            "name": "where.id.overlaps",
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
              "type": "string"
            },
            "in": "query",
            "name": "where.name.contains",
            "required": false
          },
          {
            "schema": {
              "type": "string"
            },
            "in": "query",
            "name": "where.name.contained",
            "required": false
          },
          {
            "schema": {
              "type": "string"
            },
            "in": "query",
            "name": "where.name.overlaps",
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
        "tags": [
          "graphs"
        ],
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
        "tags": [
          "graphs"
        ],
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
        "tags": [
          "graphs"
        ],
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
}`
