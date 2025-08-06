---
title: Overview
label: SQL-RestAPI
---

# Introduction to the REST API

The Platformatic DB OpenAPI plugin automatically starts a REST API server (powered by [Fastify](https://fastify.io)) that provides CRUD (**C**reate, **R**ead, **U**pdate, **D**elete) functionality for each entity.

## Configuration

In the config file, under the `"db"` section, the OpenAPI server is enabled by default. You can disable it setting the property `openapi` to `false`.

### Example Configuration 

```json title="Disable OpenAPI"
{
  ...
  "db": {
    "openapi": false
  }
}
```

## Customizing OpenAPI Configuration 

As Platformatic DB uses [`fastify-swagger`](https://github.com/fastify/fastify-swagger) under the hood, the `"openapi"` property can be an object that follows the [OpenAPI Specification Object](https://swagger.io/specification/#oasObject) format. This allows you to extend the output of the Swagger UI documentation.


**Example Configuration**

```json title="Customize OpenAPI"
{
  "db": {
    "openapi": {
      "openapi": "3.0.0",
      "info": {
        "title": "Platformatic DB API",
        "version": "1.0.0",
        "description": "This is the API documentation for Platformatic DB."
      },
      "servers": [
        {
          "url": "http://localhost:3042",
          "description": "Local server"
        }
      ]
    }
  }
}
```

## Extending Swagger UI Documentation
By customizing the `openapi` property, you can extend the Swagger UI documentation to include security schemes, custom endpoints, and more.

```json 
{
  "db": {
    "openapi": {
      "openapi": "3.0.0",
      "info": {
        "title": "Platformatic DB API",
        "version": "1.0.0",
        "description": "This is the API documentation for Platformatic DB."
      },
      "servers": [
        {
          "url": "http://localhost:3000",
          "description": "Local server"
        }
      ],
      "components": {
        "securitySchemes": {
          "bearerAuth": {
            "type": "http",
            "scheme": "bearer",
            "bearerFormat": "JWT"
          }
        }
      },
      "security": [
        {
          "bearerAuth": []
        }
      ]
    }
  }
}
```

