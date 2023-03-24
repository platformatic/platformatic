# Platformatic Client

Create a Fastify plugin that exposes a client for a remote OpenAPI or GraphQL API.

To create a client for a remote OpenAPI API, you can use the following command:

```bash
$ platformatic client http://exmaple.com/to/schema/file
```

To create a client for a remote Graphql API, you can use the following command:

```bash
$ platformatic client http://exmaple.com/grapqhl
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

You can know use the client in your Fastify application:

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
