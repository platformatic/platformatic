---
title: Overview
label: Authorization
---


import Issues from "../../../getting-started/issues.md";

# Introduction

Authorization in Platformatic DB is **role-based access control** (RBAC), which is important for managing user permissions. User authentication and the assignment of roles must be handled by an external authentication service, allowing for integration with existing identity providers.

## Configuration

Authorization strategies and rules are configured via a Platformatic DB configuration file. This configuration dictates how user roles interact with the database’s resources:

- **Authorization Strategies**: Define how Platformatic DB recognizes and enforces user roles and permissions.
- **Rules**: Specific permissions tied to roles that dictate access to different database operations.

:::note
To learn more about roles, permissions and rules, visit our guide on [Authorization Configuration](../../db/configuration.md#authorization).
:::

## Bypass authorization in development

To make testing and developing easier, it's possible to bypass authorization checks
if an `adminSecret` is set. See the [HTTP headers (development only)](../../db/authorization/strategies.md#http-headers-development-only) documentation.

<Issues />
