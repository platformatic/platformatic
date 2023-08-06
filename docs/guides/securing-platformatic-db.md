# Securing Platformatic DB with Authorization

## Introduction

Authorization in Platformatic DB is **role-based**. User authentication and the
assignment of roles must be handled by an external authentication service.
Take a look to at the reference documentation for [Authorization](/docs/reference/db/authorization/introduction).

The goal of this simple guide is to protect an API built with Platformatic DB
with the use of a shared secret, that we call `adminSecret`. We want to prevent
any user that is not an admin to access the data.

The use of an `adminSecret` is a simplistic way of securing a system.
It is a crude way for limiting access and not suitable for production systems,
as the risk of leaking the secret is high in case of a security breach.
A production friendly way would be to issue a machine-to-machine JSON Web Token,
ideally with an asymmetric key. Alternatively, you can defer to an external
service via a Web Hook.

Please refer to our guide to set up [Auth0](/docs/guides/jwt-auth0) for more information
on JSON Web Tokens.

## Block access to all entities, allow admins

The following configuration will block all _anonymous_ users (e.g. each user without a known role)
to access every entity:


```json
{
  ...
  "authorization": {
    "adminSecret": "replaceWithSomethingRandomAndSecure"
  }
}
```

The data will still be available if the `X-PLATFORMATIC-ADMIN-SECRET` HTTP header
is specified when making HTTP calls, like so:

```bash
curl -H 'X-PLATFORMATIC-ADMIN-SECRET: replaceWithSomethingRandomAndSecure' http://127.0.0.1:3042/pages
```


:::info
Configuring JWT or Web Hooks will have the same result of configuring an admin secret.
:::

## Authorization rules

Rules can be provided based on entity and role in order to restrict access and provide fine grained access.
To make an admin only query and save the `page` table / `page` entity using `adminSecret` this structure should be used in the `platformatic.db` configuration file:

```
  ...
  "authorization": {
    "adminSecret": "easy",
    "rules": [{
      "entity": "movie"
      "role": "platformatic-admin",
      "find": true,
      "save": true,
      "delete": false,
      }
    ]
  }
```

:::info
Note that the role of an admin user from `adminSecret` strategy is `platformatic-admin` by default.
:::

## Read-only access to _anonymous_ users

The following configuration will allo all _anonymous_ users (e.g. each user without a known role)
to access the `pages` table / `page` entity in Read-only mode:


```json
{
  ...
  "authorization": {
    "adminSecret": "replaceWithSomethingRandomAndSecure"
    "rules": [{
      "role": "anonymous",
      "entity": "page",
      "find": true,
      "save": false,
      "delete": false
    }]
  }
}
```

Note that we set `find` as `true` to allow the access, while the other options are `false`.

## Work in Progress

This guide is a Work-In-Progress. Let us know what other common authorization use cases we should cover.
