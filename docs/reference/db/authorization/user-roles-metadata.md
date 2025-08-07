# User Roles & Metadata

import Issues from '../../../getting-started/issues.md';

## Introduction

Roles and user information are passed to Platformatic DB from an external
authentication service as a string (JWT claims or HTTP headers). We refer to
this data as [user metadata](#user-metadata).

## Roles

### Understanding User Roles

User roles in Platformatic DB are represented as strings and are passed via the `X-PLATFORMATIC-ROLE` HTTP header. These roles are specified as a list of comma-separated names. The key used to pass roles is configurable, allowing integration with various authentication systems.

For detailed configuration options, refer to our [configuration documentation](#role-configuration)

### Reserved roles

Platformatic DB reserves certain role names for internal use:

- `platformatic-admin`: Identifies a user with admin powers.
- `anonymous`: Automatically assigned when no other roles are specified.

### Anonymous Role

By default, if a user does not have an assigned role, the `anonymous` role is applied. You can define specific rules for users with this role as shown below:

```json
{
  "role": "anonymous",
  "entity": "page",
  "find": false,
  "delete": false,
  "save": false
}
```

This configuration ensures that users with the `anonymous` role cannot perform `find`, `delete`, or `save` operations on the page entity.


### Role Impersonation
Role impersonation allows an admin to perform actions on behalf of another user by specifying roles to impersonate in the `X-PLATFORMATIC-ROLE` HTTP header. This feature requires a valid `X-PLATFORMATIC-ADMIN-SECRET` header.


### Role impersonation

If a request includes a valid `X-PLATFORMATIC-ADMIN-SECRET` HTTP header it is
possible to impersonate a user roles. The roles to impersonate can be specified
by sending a `X-PLATFORMATIC-ROLE` HTTP header containing a comma separated list
of roles.

```plaintext
X-PLATFORMATIC-ADMIN-SECRET: <shared-admin-secret>
X-PLATFORMATIC-ROLE: editor,admin
```

:::important
Role impersonation is disabled when JWT or Webhook authentication methods are set. In such cases, the role is automatically set to platformatic-admin if the X-PLATFORMATIC-ADMIN-SECRET HTTP header is specified.
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

Another option is to use the `rolePath` field to specify a path to the role in the user metadata. This is useful when the role is nested in the user data extracted from the JWT claims, e.g. if we have a JWT token with:

```json
{
  "user": {
    "roles": ["admin", "editor"]
  }
}

```

We can specify the `rolePath` as `user.roles`:

```json
 "authorization": {
    "rolePath": "user.roles",
    ...
  }
```

Note that the `rolePath` has the precedence on `roleKey`. If both are set, the `rolePath` will be used and the `roleKey` will be ignored.

## User metadata

User roles and other user data, such as `userId`, are referred to by Platformatic
DB as user metadata.

User metadata is parsed from an HTTP request and stored in a `user` object on the
Fastify request object. This object is populated on-demand, but it's possible
to populate it explicitly with `await request.setupDBAuthorizationUser()`.

```javascript
await request.setupDBAuthorizationUser();
const userRoles = request.user.roles;
```

<Issues />
