# API modification

If you want to modify automatically generated API, you can use composer custom `onRoute` hook.

#### `addComposerOnRouteHook(openApiPath, methods, handler)`

- **`openApiPath`** (`string`) - A route OpenAPI path that Platformatic Composer takes from the OpenAPI specification.
- **`methods`** (`string[]`) - Route HTTP methods that Platformatic Composer takes from the OpenAPI specification.
- **`handler`** (`function`) - fastify [onRoute](https://www.fastify.io/docs/latest/Reference/Hooks/#onroute) hook handler.

_Example_

```js
app.platformatic.addComposerOnRouteHook('/users/{id}', ['GET'], routeOptions => {
  routeOptions.schema.response[200] = {
    type: 'object',
    properties: {
      firstName: { type: 'string' },
      lastName: { type: 'string' }
    }
  }

  routeOptions.preSerialization = async (request, reply, payload) => {
    return {
      firstName: payload.first_name,
      lastName: payload.last_name
    }
  }
})
```
