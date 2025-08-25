---
title: Overview
label: Platformatic Service
---

import Issues from '../../getting-started/issues.md';

# HTTP Service

The HTTP Service is a core application type that runs within Watt (the Node.js Application Server). It provides a fast, flexible foundation for building custom APIs and web applications using Fastify.

The HTTP Service handles custom application logic, business rules, and API endpoints that aren't automatically generated from your database schema. It's perfect for authentication, complex business logic, third-party integrations, and custom endpoints.

For a high level overview of how Watt and its applications work, please reference the [Overview](../../overview.md) guide.

## Features

- **Fastify-based**: Built on the fast and lightweight Fastify framework
- **Plugin System**: Add custom functionality with [Fastify plugins](./plugin.md)
- **TypeScript Support**: Write plugins in JavaScript or TypeScript
- **Programmatic API**: Start applications [programmatically](./programmatic.md) in tests or other applications
- **Fully Typed**: Complete TypeScript definitions for type-safe development
- **Hot Reloading**: Automatic reload during development with Watt
- **Application Mesh Integration**: Seamless communication with other applications in your Watt application

## When to Use HTTP Service

HTTP Service is ideal for:

- **Custom Business Logic**: Implement complex business rules and workflows
- **Authentication & Authorization**: Handle user authentication and access control
- **Third-party Integrations**: Connect to external APIs and applications
- **Custom Endpoints**: Create specialized API endpoints not covered by database applications
- **Middleware & Processing**: Add request/response processing, validation, and transformation
- **Microapplication Architecture**: Build focused applications that handle specific domains

## Issues

If you run into a bug or have a suggestion for improvement, please
[raise an issue on GitHub](https://github.com/platformatic/platformatic/issues/new).

## Quick Start

The easiest way to create an HTTP Service is within a Watt application:

```bash
# Create a new Watt application
wattpm create my-app

# This will create a workspace with HTTP Service included
cd my-app

# Start in development mode
wattpm dev
```

For application-specific configuration and advanced usage, see the [Configuration](./configuration.md) guide.

## Integration with Other Services

HTTP Services work seamlessly with other service types in your Watt application:

- **Database Services**: Access auto-generated database APIs
- **Gateway Services**: Expose your HTTP service through an API gateway
- **Frontend Capabilities**: Serve frontend applications alongside your APIs

<Issues />
