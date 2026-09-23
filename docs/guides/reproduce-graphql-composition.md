import Issues from '../getting-started/issues.md';

# Reproduce GraphQL Composition

Gateway no longer composes GraphQL schemas itself. Follow this guide to reproduce the former built-in GraphQL composition behavior while keeping the composition stack owned by your application.

## Install the GraphQL stack

Install the composition and GraphQL server packages in the Gateway application. You can replace these packages with any compatible GraphQL composition stack.

```bash
npm install @platformatic/graphql-composer mercurius
```

## Configure the subgraphs

Register a plugin and pass it the subgraphs to compose. The `host` can be a Runtime mesh address for an application in the same Watt instance, or an external URL.

```json
{
  "$schema": "https://schemas.platformatic.dev/@platformatic/gateway/4.0.0.json",
  "gateway": {
    "applications": [
      {
        "id": "movies",
        "proxy": {
          "prefix": "/movies"
        }
      },
      {
        "id": "songs",
        "proxy": {
          "prefix": "/songs"
        }
      }
    ]
  },
  "plugins": {
    "paths": [
      {
        "path": "./graphql-composition.js",
        "options": {
          "graphiql": true,
          "subgraphs": [
            {
              "name": "movies",
              "host": "http://movies.plt.local"
            },
            {
              "name": "songs",
              "host": "http://songs.plt.local"
            }
          ]
        }
      }
    ]
  }
}
```

The `gateway.applications` entries above are ordinary proxies. They are optional when the subgraphs are only accessed by the composition plugin, but keeping them exposes each subgraph under a predictable path.

## Compose and register the schema

Create `graphql-composition.js` next to the Gateway configuration file:

```js
import { compose } from '@platformatic/graphql-composer'
import mercurius from 'mercurius'

export default async function graphqlComposition (app, options) {
  const subgraphs = options.subgraphs.map(subgraph => ({
    name: subgraph.name,
    server: {
      host: subgraph.host,
      composeEndpoint: subgraph.composeEndpoint ?? '/.well-known/graphql-composition',
      graphqlEndpoint: subgraph.graphqlEndpoint ?? '/graphql'
    }
  }))

  const composed = await compose({
    logger: app.log,
    subgraphs
  })

  await app.register(mercurius, {
    schema: composed.toSdl(),
    resolvers: composed.resolvers,
    graphiql: options.graphiql === true
  })
}
```

The plugin owns schema loading, composition, resolver generation, error handling, and GraphQL server configuration. This makes it possible to replace `@platformatic/graphql-composer`, customize subgraph discovery, or use a different GraphQL server without Gateway changes.

## Restore Composition Options

The former `gateway.graphql` options are no longer Gateway configuration. If your application used entities or a default argument adapter, pass those values directly to your user-owned composition package:

```js
  const composed = await compose({
    logger: app.log,
    defaultArgsAdapter: options.defaultArgsAdapter,
    addEntitiesResolvers: options.addEntitiesResolvers,
    entities: options.entities,
    subgraphs
  })
```

Likewise, implement `onSubgraphError` in the plugin and pass `graphqlEndpoint` or `composeEndpoint` as fields in your own `subgraphs` configuration. The old Gateway fields are rejected by the Gateway schema; they must not be placed under `gateway`.

## Runtime mesh and external services

For subgraphs running in the same Watt instance, use `http://<application-id>.plt.local`. For external services, use their complete HTTP origin instead. The composition plugin makes the schema requests directly, while ordinary client traffic reaches the composed endpoint registered by the plugin.

## Related documentation

- [Gateway configuration](./configuration.md)
- [Gateway plugins](./plugin.md)
- [Platformatic Runtime mesh](../runtime/multithread-architecture.md)

<Issues />
