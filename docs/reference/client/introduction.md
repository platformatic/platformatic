# Platformatic Client

Create a Fastify plugin that exposes a client for a remote OpenAPI or GraphQL API.

To create a client for a remote OpenAPI API, you can use the following command:

```bash
$ platformatic client http://exmaple.com/to/schema/file --name myclient
```

To create a client for a remote Graphql API, you can use the following command:

```bash
$ platformatic client http://exmaple.com/grapqhl --name myclient
```

## Usage with Platformatic Service or Platformatic DB

If you run the generator in in a Platformatic application, and it will
automatically extend it to load your client by editing the configuration file
and adding a `clients` section.
Then, in any part of your Platformatic application you can use the client.

You can use the client in your application in Javascript, calling a GraphQL endpoint:

```js
// Use a typescript reference to set up autocompletion
// and explore the generated APIs.

/// <reference path="./myclient" />

/**  @type {import('fastify').FastifyPluginAsync<{} */
module.exports = async function (app, opts) {
  app.post('/', async (request, reply) => {
    const res = await app.myclient.graphql({
      query: 'query { movies { title } }'
    })
    return res
  })
}
```

or in Typescript, calling an OpenAPI endpoint:


```ts
import { FastifyInstance } from 'fastify'
/// <reference path="./myclient" />

export default async function (app: FastifyInstance) {
  app.get('/', async () => {
    return app.myclient.get({})
  })
}
```

The client configuration in the `platformatic.db.json` and `platformatic.service.json` would look like:

```json
{
  "clients": [{
    "schema": "./myclient/myclient.openapi.json" // or ./myclient/myclient.schema.graphl
    "name": "myclient",
    "type": "openapi" // or graphql
    "url": "{ PLT_MYCLIENT_URL }"
  }]
}
```

Note that the generator would also have updated the `.env` and `.env.sample` files if they exists.

## Generating a client for a service running within Platformatic Runtime

Platformatic Runtime allows you to create a network of services that are not exposed.
To create a client to invoke one of those services from another, run:

```bash
$ platformatic client --name <clientname> --runtime <serviceId>
```

Where `<clientname>` is the name of the client and `<serviceId>` is the id of the given service
(which correspond in the basic case with the folder name of that service).
The client generated is identical to the one in the previous section.

Note that this command looks for a `platformatic.runtime.json` in a parent directory.

### Example

As an example, consider a network of three microservices:

- `somber-chariot`, an instance of Platformatic DB;
- `languid-noblemen`, an instance of Platformatic Service;
- `pricey-paesant`, an instance of Platformatic Composer, which is also the runtime entrypoint.

From within the `languid-noblemen` folder, we can run:

```bash
$ platformatic client --name chariot --runtime somber-chariot
```

The client configuration in the `platformatic.db.json` and `platformatic.service.json` would look like:

```json
{
  "clients": [{
    "path": "./chariot",
    "serviceId": "somber-chariot"
  }]
}
```

Even if the client is generated from an HTTP endpoint, it is possible to add a `serviceId` property each client object shown above.
This is not required, but if using the Platformatic Runtime, the `serviceId`
property will be used to identify the service dependency.

## Types Generator

The types for the client are automatically generated for both OpenAPI and GraphQL schemas.

### OpenAPI

We provide a fully typed experience for OpenAPI, Typing both the request and response for
each individual OpenAPI operation.

Consider this example:

```typescript
// Omitting all the individual Request and Reponse payloads for brevity

interface Client {
  getMovies(req: GetMoviesRequest): Promise<Array<GetMoviesResponse>>;
  createMovie(req: CreateMovieRequest): Promise<CreateMovieResponse>;
  updateMovies(req: UpdateMoviesRequest): Promise<Array<UpdateMoviesResponse>>;
  getMovieById(req: GetMovieByIdRequest): Promise<GetMovieByIdResponse>;
  updateMovie(req: UpdateMovieRequest): Promise<UpdateMovieResponse>;
  updateMovie(req: UpdateMovieRequest): Promise<UpdateMovieResponse>;
  deleteMovies(req: DeleteMoviesRequest): Promise<DeleteMoviesResponse>;
  getQuotesForMovie(req: GetQuotesForMovieRequest): Promise<Array<GetQuotesForMovieResponse>>;
  getQuotes(req: GetQuotesRequest): Promise<Array<GetQuotesResponse>>;
  createQuote(req: CreateQuoteRequest): Promise<CreateQuoteResponse>;
  updateQuotes(req: UpdateQuotesRequest): Promise<Array<UpdateQuotesResponse>>;
  getQuoteById(req: GetQuoteByIdRequest): Promise<GetQuoteByIdResponse>;
  updateQuote(req: UpdateQuoteRequest): Promise<UpdateQuoteResponse>;
  updateQuote(req: UpdateQuoteRequest): Promise<UpdateQuoteResponse>;
  deleteQuotes(req: DeleteQuotesRequest): Promise<DeleteQuotesResponse>;
  getMovieForQuote(req: GetMovieForQuoteRequest): Promise<GetMovieForQuoteResponse>;
}

type ClientPlugin = FastifyPluginAsync<NonNullable<client.ClientOptions>>

declare module 'fastify' {
  interface FastifyInstance {
    'client': Client;
  }

  interface FastifyRequest {
    'client': Client;
  }
}

declare namespace client {
  export interface ClientOptions {
    url: string
  }
  export const client: ClientPlugin;
  export { client as default };
}

declare function client(...params: Parameters<ClientPlugin>): ReturnType<ClientPlugin>;
export = client;
```

### GraphQL

We provide a partially typed experience for GraphQL, because we do not want to limit
how you are going to query the remote system. Take a look at this example:

```typescript
declare module 'fastify' {
  interface GraphQLQueryOptions {
    query: string;
    headers: Record<string, string>;
    variables: Record<string, unknown>;
  }
  interface GraphQLClient {
    graphql<T>(GraphQLQuery): PromiseLike<T>;
  }
  interface FastifyInstance {
    'client'
    : GraphQLClient;

  }

  interface FastifyRequest {
    'client'<T>(GraphQLQuery): PromiseLike<T>;
  }
}

declare namespace client {
  export interface Clientoptions {
    url: string
  }
  export interface Movie {
    'id'?: string;

    'title'?: string;

    'realeasedDate'?: string;

    'createdAt'?: string;

    'preferred'?: string;

    'quotes'?: Array<Quote>;

  }
  export interface Quote {
    'id'?: string;

    'quote'?: string;

    'likes'?: number;

    'dislikes'?: number;

    'movie'?: Movie;

  }
  export interface MoviesCount {
    'total'?: number;

  }
  export interface QuotesCount {
    'total'?: number;

  }
  export interface MovieDeleted {
    'id'?: string;

  }
  export interface QuoteDeleted {
    'id'?: string;

  }
  export const client: Clientplugin;
  export { client as default };
}

declare function client(...params: Parameters<Clientplugin>): ReturnType<Clientplugin>;
export = client;
```

Given only you can know what GraphQL query you are producing, you are responsible for typing
it accordingly.

## Usage with standalone Fastify

If a platformatic configuration file is not found, a complete Fastify plugin is generated to be 
used in your Fastify application like so:

```js
const fastify = require('fastify')()
const client = require('./your-client-name')

fastify.register(client, {
  url: 'http://example.com'
})

// GraphQL
fastify.post('/', async (request, reply) => {
  const res = await request.movies.graphql({
    query: 'mutation { saveMovie(input: { title: "foo" }) { id, title } }'
  })
  return res
})

// OpenAPI
fastify.post('/', async (request, reply) => {
  const res = await request.movies.createMovie({ title: 'foo' })
  return res
})

fastify.listen({ port: 3000 })
```

Note that you would need to install `@platformatic/client` as a depedency.

## How are the method names defined in OpenAPI

The names of the operations are defined in the OpenAPI specification.
Specifically, we use the [`operationId`](https://swagger.io/specification/).
If that's not part of the spec,
the name is generated by combining the parts of the path,
like `/something/{param1}/` and a method `GET`, it genertes `getSomethingParam1`.

## Authentication

It's very common that downstream services requires some form of Authentication.
How could we add the necessary headers? You can configure them from your plugin:

```js
/// <reference path="./myclient" />

/**  @type {import('fastify').FastifyPluginAsync<{} */
module.exports = async function (app, opts) {
  app.configureMyclient({
    async getHeaders (req, reply) {
      return {
        'foo': 'bar'
      }
    }
  })

  app.post('/', async (request, reply) => {
    const res = await app.myclient.graphql({
      query: 'query { movies { title } }'
    })
    return res
  })
}
```
