# Programmatic API

It is possible to use the Platformatic client without the generator.

## OpenAPI Client

```js
import { buildOpenAPIClient } from '@platformatic/client'

const client = await buildOpenAPIClient({
  url: `https://yourapi.com/documentation/json`
  // path: 'path/to/openapi.json'
})

const res = await client.yourOperationName({ foo: 'bar' })

console.log(res)
```

## GraphQL Client

```js
import { buildGraphQLClient } from '@platformatic/client'

const client = await buildGraphQLClient({
  url: `https://yourapi.com/graphql`
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
