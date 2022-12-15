# User Roles & Metadata

## Introduction

<!--

TODO: Explain what roles and user metadata are

-->

Roles and user information are passed to Platformatic DB from an external
authentication service as a string (JWT claims or HTTP headers). We refer to
this data as [user metadata](#user-metadata).

## Roles

<!-- TODO: Rewrite this section -->

<!-- TODO: Update the link here -->
Users can have a list of roles associated with them. These roles can be specified
in an `X-PLATFORMATIC-ROLE` property as a list of comma separated role names
(the key name is [configurable](/reference/db/configuration.md#role-and-anonymous-keys)).

Note that role names are just strings.

### Reserved roles

Some special role names are reserved by Platformatic DB:

- `platformatic-admin` : this identifies a user who has admin powers
- `anonymous`: set automatically when no roles are associated

### Anonymous role

If a user has no role, the `anonymous` role is assigned automatically. It's possible
to specify rules to apply to users with this role:

```json
    {
      "role": "anonymous",
      "entity": "page",
      "find": false,
      "delete": false,
      "save": false
    }
```

In this case, a user that has no role or explicitly has the `anonymous` role
cannot perform any operations on the `page` entity.

### Role impersonation

If a request includes a valid `X-PLATFORMATIC-ADMIN-SECRET` HTTP header it is
possible to impersonate a user roles. The roles to impersonate can be specified
by sending a `X-PLATFORMATIC-ROLE` HTTP header containing a comma separated list
of roles.

<!--

TODO: Add an example

X-PLATFORMATIC-ADMIN-SECRET: <shared-admin-secret>
X-PLATFORMATIC-ROLE: editor,admin

-->

:::note
When JWT or Webhook are set, user role impersonation is not enabled, and the role
is always set as `platfomatic-admin` automatically if the `X-PLATFORMATIC-ADMIN-SECRET`
HTTP header is specified.
:::

### Role configuration

The roles key in user metadata defaults to `X-PLATFORMATIC-ROLE`. It's possible to change it using the `roleKey` field in configuration. Same for the `anonymous` role, which value can be changed using `anonymousRole`.

```json
 "authorization": {
    "roleKey": "X-MYCUSTOM-ROLE_KEY",
    "anonymousRole": "anonym",
    "rules": [
    ...
    ]
  }
```

## User metadata

User roles and other user data, such as `userId`, are referred to by Platformatic
DB as user metadata.

User metadata is parsed from an HTTP request and stored in a `user` object on the
Fastify request object. This object is populated on-demand, but it's possible
to populate it explicity with `await request.setupDBAuthorizationUser()`.

<!-- TODO: Give some examples? -->
