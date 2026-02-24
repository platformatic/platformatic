import Issues from '../../getting-started/issues.md';

# API Gateway (Gateway Service)

The Gateway Service is an API Gateway that runs within Watt (the Node.js Application Server). It automatically integrates multiple microservices into a unified API ecosystem, providing a single public endpoint for clients while managing routing, composition, and conflict resolution behind the scenes.

The Gateway Service aggregates APIs from multiple sources - whether they're other applications in your Watt application, external APIs, or legacy systems - presenting them as a cohesive, well-documented API to your clients.

For a high level overview of how Watt and its applications work, please reference the [Overview](../../overview.md) guide.

## Features

- **Service Discovery**: Automatically discover and compose APIs from multiple applications in your Watt application
- **OpenAPI Composition**: Combine multiple OpenAPI specifications into a single, unified API documentation
- **GraphQL Federation**: Aggregate GraphQL schemas from multiple applications with Apollo Federation support
- **Conflict Resolution**: Intelligent handling of endpoint conflicts and path overlaps between applications
- **Route Prefixing**: Organize APIs with automatic or custom path prefixing for each application
- **Flexible Proxy Routing**: Route requests by prefix, method, and path patterns when multiple applications share the same prefix. See [Gateway configuration](./configuration.md#gateway).
- **Dynamic Updates**: Real-time schema updates when underlying applications change (in development mode)
- **Custom Logic**: Extend with Fastify plugins for authentication, rate limiting, or request transformation

## When to Use Gateway Service

Gateway Service is ideal for:

- **Microservices Architecture**: Present a unified API from multiple independent services
- **API Aggregation**: Combine internal and external APIs into a single public interface
- **Legacy Integration**: Gradually modernize by composing new and legacy APIs
- **Team Boundaries**: Allow different teams to own applications while providing unified client experience
- **API Versioning**: Manage different API versions while maintaining client compatibility
- **Client Simplification**: Reduce client complexity by handling application discovery and routing

## Quick Start

Create a Gateway Service within a Watt application:

```bash
# Create a new Watt application
wattpm create my-gateway

# Add multiple applications to compose
# (This will prompt you through the application setup)
cd my-gateway

# Start in development mode
wattpm dev
```

Your Gateway Service will automatically discover other applications in your Watt application and create a unified API. Visit `http://localhost:3042/documentation` to see the composed API documentation.

For application-specific configuration and advanced usage, see the [Configuration](./configuration.md) guide.

## Command Line usage (CLI)

When using [Watt](../watt/overview.md), `@platformatic/gateway` applications will make some additional commands available on the terminal.

All the commands will be prefixed by the application id. For instance, if your application id is `main`, then you will have the following commands available:

- `main:fetch-openapi-schemas`: Fetch OpenAPI schemas from remote services.

<Issues />
