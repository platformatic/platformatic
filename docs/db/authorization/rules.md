# Rules

## Introduction

Authorization rules in Platformatic DB define what operations users can perform on the REST or GraphQL APIs. 

## Defining Rules

### Basic Rule Structure

Every authorization rule must include the following:

- `role` (required) — Specifies the user role name as a string, which must align with roles set by an external authentication service.
- `entity` or `entities` (optional) — Defines one or more Platformatic DB entities the rule applies to. At least one of `entity` or `entities` must be specified.
- `defaults` (optional) — Sets default values for entity fields from [user metadata](#set-entity-fields-from-user-metadata).

### Supported Operations

Each rule can specify permissions for CRUD operations (`find`, `save`, `delete`). Here's an example illustrating how these permissions are structured:

```json title="Example JSON object"
{
  "role": "user",
  "entity": "page",
  "find": true,
  "save": false,
  "delete": {
    "checks": {
      "userId": "X-PLATFORMATIC-USER-ID"
    }
  }
}
```

This configuration allows users with the `user` role to `find` and `delete` pages where the `userId` matches their user `ID`, but they cannot save changes to pages.

## Advanced Authorization Controls

### Operation Checks

For more fine-grained control, use the `checks` field to define conditions under which operations can be executed. Every entity operation — such as `find`, `insert`, `save` or `delete` — can have authorization `checks` specified for them. This value can be `false` (operation disabled) or `true` (operation enabled with no checks).

```json title="Example JSON object"
{
  "role": "user",
  "entity": "page",
  "find": {
    "checks": {
      "userId": "X-PLATFORMATIC-USER-ID"
    }
  }
}
```

Here a user with a `user` role executes a `findPage` operation and can access all the data for `userId` metadata with the value key `X-PLATFORMATIC-USER-ID`. It's possible to specify more complex rules using all the supported [where clause operators](../../packages/sql-mapper/entities/api.md#where-clause).

:::important
Note that `userId` MUST exist as a field in the database table to use this feature.
:::

### GraphQL events and subscriptions

Platformatic DB supports GraphQL subscriptions, which require specific authorization checks based on `find` permissions. The only permissions that are supported are:

1. `find: false`, the subscription for that role is disabled
2. `find: { checks: { [prop]: 'X-PLATFORMATIC-PROP' } }` validates that the given prop is equal
3. `find: { checks: { [prop]: { eq: 'X-PLATFORMATIC-PROP' } } }` validates that the given prop is equal

:::note 
Conflicting rules across roles for different equality checks will not be supported.
:::

## Restrict Access to Entity Fields

Platformatic DB allows the specification of `fields` arrays in authorization rules to limit the columns a user can interact with during database operations. 

For `save` operations, it's important to include all not-nullable fields in the configuration to prevent runtime errors due to missing data. Platformatic performs these checks at startup to ensure configurations are correct.

```json title="Example JSON object"
{
  "rule": {
    "entity": "page",
    "role": "user",
    "find": {
      "checks": {
        "userId": "X-PLATFORMATIC-USER-ID"
      },
      "fields": ["id", "title"]
    }
  }
}
```

In this configuration, a user with the `user` role can only access the `id` and `title` fields of the `page` entity.

## Set Entity Fields from User Metadata

Defaults are used in database insert and are default fields added automatically populated from user metadata

Example:

```json title="Example JSON object"
{
  "defaults": {
    "userId": "X-PLATFORMATIC-USER-ID"
  }
}
```

When a new entity is created, the `userId` field is automatically populated with the value from the user's metadata.

## Programmatic Rules

For advanced use cases involving authorization, Platformatic DB allows rules to be defined programmatically. 

```javascript 

  app.register(auth, {
    jwt: {
      secret: 'supersecret'
    },
    rules: [{
      role: 'user',
      entity: 'page',
      async find ({ user, ctx, where }) {
        return {
          ...where,
          userId: {
            eq: user['X-PLATFORMATIC-USER-ID']
          }
        }
      },
      async delete ({ user, ctx, where }) {
        return {
          ...where,
          userId: {
            eq: user['X-PLATFORMATIC-USER-ID']
          }
        }
      },
      defaults: {
        userId: async function ({ user, ctx, input }) {
          match(user, {
            'X-PLATFORMATIC-USER-ID': generated.shift(),
            'X-PLATFORMATIC-ROLE': 'user'
          })
          return user['X-PLATFORMATIC-USER-ID']
        }

      },
      async save ({ user, ctx, where }) {
        return {
          ...where,
          userId: {
            eq: user['X-PLATFORMATIC-USER-ID']
          }
        }
      }
    }]
  })
```

In this example, the `user` role can delete all the posts edited before yesterday:

```js
 app.register(auth, {
    jwt: {
      secret: 'supersecret'
    },
    roleKey: 'X-PLATFORMATIC-ROLE',
    anonymousRole: 'anonymous',
    rules: [{
      role: 'user',
      entity: 'page',
      find: true,
      save: true,
      async delete ({ user, ctx, where }) {
        return {
          ...where,
          editedAt: {
            lt: yesterday
          }
        }
      },
      defaults: {
        userId: 'X-PLATFORMATIC-USER-ID'
      }
    }]
  })
```

## Access validation on `entity mapper` for plugins

To assert that a specific user with it's `role(s)` has the correct access rights to use entities on a `platformatic plugin` the context should be passed to the `entity mapper` in order to verify its permissions like this:

To ensure that a specific user has the correct access rights to use entities within a Platformatic plugin, the user's context should be passed to the `entity mapper`. This integration allows the mapper to verify permissions based on the defined rules.


```js
//plugin.js

app.post('/', async (req, reply) => {
  const ctx = req.platformaticContext
  
  await app.platformatic.entities.movie.find({
    where: { /*...*/ },
    ctx
  })
})

```


## Skip authorization rules

In custom plugins, you can skip authorization rules on entities programmatically by setting the `skipAuth` flag to `true` or not passing a `ctx`.

```js
// this works even if the user's role doesn't have the `find` permission.
const result = await app.platformatic.entities.page.find({skipAuth: true, ...})
```

This has the same effect:

```js
// this works even if the user's role doesn't have the `find` permission
const result = await app.platformatic.entities.page.find() // no `ctx`
```

This is useful for custom plugins for which the authentication is not necessary, so there is no user role set when invoked.

:::info
Skip authorization is only applicable in custom plugins and cannot be used in automatically generated REST and GraphQL APIs.
:::

## Avoid repetition of the same rule multiple times

To prevent redundancy and repetition of rules, you can condense similar rules for multiple entities into a single rule entry. 


```js
 app.register(auth, {
    jwt: {
      secret: 'supersecret'
    },
    roleKey: 'X-PLATFORMATIC-ROLE',
    anonymousRole: 'anonymous',
    rules: [{
      role: 'anonymous',
      entities: ['category', 'page'],
      find: true,
      delete: false,
      save: false
    }]
})
```


