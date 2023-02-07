# Rules

<!-- TODO: Add examples that explicitly show how roles work in the context of rules -->

## Introduction

Authorization rules can be defined to control what operations users are
able to execute via the REST or GraphQL APIs that are exposed by a Platformatic
DB app.

Every rule must specify:

- `role` (required) — A role name. It's a string and must match with the role(s) set by an external authentication service.
- `entity` (optional) — The Platformatic DB entity to apply this rule to.
- `entities` (optional) — The Platformatic DB entities to apply this rule to.
- `defaults` (optional) — Configure entity fields that will be
  [automatically set from user data](#set-entity-fields-from-user-metadata).
- One entry for each supported CRUD operation: `find`, `save`, `delete`

One of `entity` and `entities` must be specified.

## Operation checks

Every entity operation — such as `find`, `insert`, `save` or `delete` — can have
authorization `checks` specified for them. This value can be `false` (operation disabled)
or `true` (operation enabled with no checks).

To specify more fine-grained authorization controls, add a `checks` field, e.g.:

```json
{
  "role": "user",
  "entity": "page",
  "find": {
    "checks": {
      "userId": "X-PLATFORMATIC-USER-ID"
    }
  },
  ...
}

```

In this example, when a user with a `user` role executes a `findPage`, they can
access all the data that has `userId` equal to the value  in user metadata with
key `X-PLATFORMATIC-USER-ID`.

Note that `"userId": "X-PLATFORMATIC-USER-ID"` is syntactic sugar for:

```json
      "find": {
        "checks": {
          "userId": {
            "eq": "X-PLATFORMATIC-USER-ID"
          }
        }
      }
```

It's possible to specify more complex rules using all the [supported where clause operators](/reference/sql-mapper/entities/api.md#where-clause).

Note that `userId` MUST exist as a field in the database table to use this feature.

### GraphQL events and subscriptions

<!-- TODO: Reword this -->

Platformatic DB supports GraphQL subscriptions and therefore db-authorization must protect them.
The check is performed based on the `find` permissions, the only permissions that are supported are:

1. `find: false`, the subscription for that role is disabled
2. `find: { checks: { [prop]: 'X-PLATFORMATIC-PROP' } }` validates that the given prop is equal
3. `find: { checks: { [prop]: { eq: 'X-PLATFORMATIC-PROP' } } }` validates that the given prop is equal

Conflicting rules across roles for different equality checks will not be supported.

## Restrict access to entity fields

If a `fields` array is present on an operation, Platformatic DB restricts the columns on which the user can execute to that list.
For `save` operations, the configuration must specify all the not-nullable fields (otherwise, it would fail at runtime).
Platformatic does these checks at startup.

Example:

```json
    "rule": {
        "entity": "page",
        "role": "user",
        "find": {
          "checks": {
            "userId": "X-PLATFORMATIC-USER-ID"
          },
          "fields": ["id", "title"]
        }
        ...
    }
```

In this case, only `id` and `title` are returned for a user with a `user` role on the `page` entity.

## Set entity fields from user metadata

Defaults are used in database insert and are default fields added automatically populated from user metadata, e.g.:

```json
        "defaults": {
          "userId": "X-PLATFORMATIC-USER-ID"
        },
```

When an entity is created, the `userId` column is used and populated using the value from user metadata.

## Programmatic rules

If it's necessary to have more control over the authorizations, it's possible to specify the rules programmatically, e.g.:

```js

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


## Skip authorization rules

In custom plugins, it's possible to skip the authorization rules on entities programmatically by setting the `skipAuth` flag to `true` or not passing a `ctx`, e.g.:

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
Skip authorization rules is not possible on the automatically generated REST and GraphQL APIs.
:::

## Avoid repetition of the same rule multiple times

Very often we end up writing the same rules over and over again.
Instead, it's possible to condense the rule for multiple entities on a single entry:

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
