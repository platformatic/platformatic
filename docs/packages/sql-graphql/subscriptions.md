# Subscription 

When the GraphQL plugin is loaded, some subscriptions are automatically adding to
the GraphQL schema if the `@platformatic/sql-events` plugin has been previously registered.

It's possible to avoid creating the subscriptions for a given entity by adding the `subscriptionIgnore` config,
like so: `subscriptionIgnore: ['page']`.

## `[ENTITY]Saved`

Published whenever an entity is saved, e.g. when the mutation `insert[ENTITY]` or `save[ENTITY]` are called.

## `[ENTITY]Deleted`

Published whenever an entity is deleted, e.g. when the mutation `delete[ENTITY]` is called..
