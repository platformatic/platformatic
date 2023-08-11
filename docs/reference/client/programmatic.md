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

If you use Typescript you can take advantage of the generated types file 

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
