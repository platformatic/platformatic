# Authorization

## Introduction

Authorization in Platformatic DB is **role-based**. User authentication and the
assignment of roles must be handled by an external authentication service.

## Configuration

Authorization strategies and rules are configured via a Platformatic DB
configuration file. See the Platformatic DB [Configuration](/docs/reference/db/configuration#authorization)
documentation for the supported settings.

## Bypass authorization in development

To make testing and developing easier, it's possible to bypass authorization checks
if an `adminSecret` is set. See the [HTTP headers (development only)](/docs/reference/db/authorization/strategies#http-headers-development-only) documentation.
