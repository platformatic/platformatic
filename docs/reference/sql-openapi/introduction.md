# Introduction to the REST API

The Platformatic DB OpenAPI plugin automatically starts a REST API server (powered by [Fastify](https://fastify.io)) that provides CRUD (**C**reate, **R**ead, **U**pdate, **D**elete) functionality for each entity.

## Configuration

In the config file, under the `"db"` section, the OpenAPI server is enabled by default. Although you can disable it setting the property `openapi` to `false`.

_Example_

```json
{
  ...
  "db": {
    "openapi": false
  }
}
```

As Platformatic DB uses [`fastify-swagger`](https://github.com/fastify/fastify-swagger) under the hood, the `"openapi"` property can be an object that follows the [OpenAPI Specification Object](https://swagger.io/specification/#oasObject) format.

This allows you to extend the output of the Swagger UI documentation.

