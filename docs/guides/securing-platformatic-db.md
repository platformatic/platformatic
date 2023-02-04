# Securing Platformatic DB with Authorization

## Introduction

Authorization in Platformatic DB is **role-based**. User authentication and the
assignment of roles must be handled by an external authentication service.
Take a look to at the reference documentation for [Authorization](/docs/reference/db/authorization).

The goal of this simple guide is to protect an API built with Platformatic DB
with the use of a shared secret, that we call `adminSecret`. We want to prevent
any user that is not an admin to access the data.

:::info
The use of an `adminSecret` is a simplistic way of securing a system.
It is a crude way for limiting access and not suitable for production systems.
Nevertheless it's a good way to learn and experiment with the authorization system.
Remember to configure Platformatic DB with JSON Web Token or Web Hooks.
:::

## Configuration

The following configuration will block all users to access the `page` entity, e.g. the `pages` table.


```json
{
  ...
  "authorization": {
    "adminSecret": "replaceWithSomethingRandomAndSecure",
    "rules": [{
      "role": "anonymous",
      "entity": "page",
      "find": false,
      "save": false,
      "delete": false
    }]
  }
}
```

The data will still be available if the `X-PLATFORMATIC-ADMIN-SECRET` HTTP header
is specified when making HTTP calls.
