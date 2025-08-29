import Issues from '../../getting-started/issues.md';

# API modification

If you want to modify automatically generated API, you can use gateway custom `onRoute` hook.

### `addGatewayOnRouteHook(openApiPath, methods, handler)`

- **`openApiPath`** (`string`) - A route OpenAPI path that Platformatic Gateway takes from the OpenAPI specification.
- **`methods`** (`string[]`) - Route HTTP methods that Platformatic Gateway takes from the OpenAPI specification.
- **`handler`** (`function`) - fastify [onRoute](https://www.fastify.io/docs/latest/Reference/Hooks/#onroute) hook handler.


### `onGatewayResponse`

`onGatewayResponse` hook is called after the response is received from a composed application.
It might be useful if you want to modify the response before it is sent to the client.
If you want to use it you need to add `onGatewayResponse` property to the `config` object of the route options.

- **`request`** (`object`) - fastify request object.
- **`reply`** (`object`) - fastify reply object.
- **`body`** (`object`) - [undici](https://undici.nodejs.org/) response body object.

_Example_

```js
app.platformatic.addGatewayOnRouteHook('/users/{id}', ['GET'], routeOptions => {
  routeOptions.schema.response[200] = {
    type: 'object',
    properties: {
      firstName: { type: 'string' },
      lastName: { type: 'string' }
    }
  }

  async function onGatewayResponse (request, reply, body) {
    const payload = await body.json()
    const newPayload = {
      firstName: payload.first_name,
      lastName: payload.last_name
    }
    reply.send(newPayload)
  }
  routeOptions.config.onGatewayResponse = onGatewayResponse
})
```

<Issues />
