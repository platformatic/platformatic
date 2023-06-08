# API modification

If you want to modify automatically generated API, you can use composer custom `onRoute` hook.

#### `addComposerOnRouteHook(openApiPath, methods, handler)`

- **`openApiPath`** (`string`) - A route OpenAPI path that Platformatic Composer takes from the OpenAPI specification.
- **`methods`** (`string[]`) - Route HTTP methods that Platformatic Composer takes from the OpenAPI specification.
- **`handler`** (`function`) - fastify [onRoute](https://www.fastify.io/docs/latest/Reference/Hooks/#onroute) hook handler.

_Example_

```js
app.addComposerOnRouteHook('/users/{id}', ['GET'], routeOptions => {
  routeOptions.onSend = async (req, reply) => {
    reply.status(304)
    return null
  }
})
```
