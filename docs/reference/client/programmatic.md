# Programmatic API

It is possible to use the Platformatic client without the generator.

## OpenAPI Client

```js
import { buildOpenAPIClient } from '@platformatic/client'

const client = await buildOpenAPIClient({
  url: `https://yourapi.com/documentation/json`, 
  // path: 'path/to/openapi.json',
  headers: {
    'foo': 'bar'
  }
})

const res = await client.yourOperationName({ foo: 'bar' })

console.log(res)
```

Once you have a `client` generated from `buildOpenAPIClient`, you can access a mapping between operation IDs and method/path by leveraging the `Symbol.for('plt.operationIdMap')` property.

```js
const client = await buildOpenAPIClient({
  // ... your client settings
})

const mapping = client[Symbol.for('plt.operationIdMap')]

console.log(mapping)

/**
 * 
 * You should see something like:
 * {
 *  getOperationFoo: { path: '/operation-foo/', method: 'get' },
 *  postOperationBar: { path: '/operation-bar/', method: 'post' },
 * }
 * 
 */

```

You're also able to pass an asynchronous function that modifies the headers for each request with the `getHeaders` option. This function will be executed before each request, just like the plugin `getHeaders` options. Note that `headers` and `getHeaders` are not mutually exclusive, and can work together:

```js
import { buildOpenAPIClient } from '@platformatic/client'

const client = await buildOpenAPIClient({
  url: `https://yourapi.com/documentation/json`, 
  headers: {
    'foo': 'bar'
  },
  getHeaders(options) {
    const { url, method, body, headers, telemetryHeaders } = options

    // generate your dynamic headers

    return {
      myDynamicHeader: 'my-value',
    }
  }
})

const res = await client.yourOperationName({ foo: 'bar' })

console.log(res)
```

If you use Typescript you can take advantage of the generated types file:

```ts
import { buildOpenAPIClient } from '@platformatic/client'
import Client from './client'
//
// interface Client {
//   getMovies(req: GetMoviesRequest): Promise<Array<GetMoviesResponse>>;
//   createMovie(req: CreateMovieRequest): Promise<CreateMovieResponse>;
//   ...
// }
//

const client: Client = await buildOpenAPIClient<Client>({
  url: `https://yourapi.com/documentation/json`, 
  // path: 'path/to/openapi.json',
  headers: {
    'foo': 'bar'
  }
})

const res = await client.getMovies()
console.log(res)
```


## GraphQL Client

```js
import { buildGraphQLClient } from '@platformatic/client'

const client = await buildGraphQLClient({
  url: `https://yourapi.com/graphql`,
  headers: {
    'foo': 'bar'
  }
})

const res = await client.graphql({
  query: `
    mutation createMovie($title: String!) {
      saveMovie(input: {title: $title}) {
        id
        title
      }
    }
  `,
  variables: {
    title: 'The Matrix'
  }
})

console.log(res)
```
