# Introduction to the GraphQL API

The Platformatic DB GraphQL plugin starts a GraphQL server wand makes it available
via a `/graphql` endpoint. This endpoint is automatically ready to run queries and
mutations against your entities. This functionality is powered by
[Mercurius](https://mercurius.dev).

## GraphiQL

The [GraphiQL](https://github.com/graphql/graphiql) web UI is integrated into
Platformatic DB. To enable it you can pass an option to the `sql-graphql` plugin:

```javascript
app.register(graphqlPlugin, { graphiql: true })
```

The GraphiQL interface is made available under the `/graphiql` path.
