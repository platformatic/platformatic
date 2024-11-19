# Programmatic API

It is possible to use the Platformatic client without the generator.

## OpenAPI Client

### Basic Usage

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

### Accessing Operation Mapping

Once you have a `client` generated from `buildOpenAPIClient`, you can access a mapping between operation IDs and method/path by leveraging the `Symbol.for('plt.operationIdMap')` property

```js
const client = await buildOpenAPIClient({
  // ... your client settings
})

const mapping = client[Symbol.for('plt.operationIdMap')]

console.log(mapping)
```

**Example Output**
```json
{
  getOperationFoo: { path: '/operation-foo/', method: 'get' },
  postOperationBar: { path: '/operation-bar/', method: 'post' },
 }
```

## Dynamic Headers 

You can pass an asynchronous function to modify the headers for each request with the `getHeaders` option. This function will be executed before each request. Note that `headers` and `getHeaders` can work together:

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

## Optional properties
You can also pass the following properties to `buildOpenAPIClient`:
```ts
import { Agent } from 'undici'
import { buildOpenAPIClient } from '@platformatic/client'

const client = await buildOpenAPIClient({
  url: 'string', // the URL of the service to be called
  path: 'string', // the path to the Open API schema
  fullResponse: true, // require or not a full response object
  fullRequest: true, // require or not a full request object
  throwOnError: true, // if there is an error, the client will throw depending ton this option
  headers: {}, // additional headers to be passed
  bodyTimeout: 900000, // body timeout passed to the undici request method
  headersTimeout: 900000, // headers timeout passed to the undici request method
  validateResponse: true, // validate or not the response received against the expected schema
  queryParser: (query) => `${query.toString()}[]`, // override the default query parser logic
  dispatcher: new Agent(), // optional property that allows passing a custom undici Agent
})
```

## TypeScript Support 

If you use Typescript, you can take advantage of the generated types file:

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

To create a GraphQL client, use the `buildGraphQLClient` function:

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
