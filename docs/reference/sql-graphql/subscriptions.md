# Subscription 

When the GraphQL plugin is loaded, some subscriptions are automatically adding to
the GraphQL schema if the `@platformatic/sql-events` plugin has been previously registered.

It's possible to avoid creating the subscriptions for a given entity by adding the `subscriptionIgnore` config,
like so: `subscriptionIgnore: ['page']`.

## `[ENTITY]Saved`

Published once whenever an entity is inserted or updated, including through `upsert[ENTITY]` or the deprecated `save[ENTITY]` alias.

## `[ENTITY]Deleted`

Published whenever an entity is deleted, e.g. when the mutation `delete[ENTITY]` is called.
