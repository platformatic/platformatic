import Issues from '../../getting-started/issues.md';

# API Gateway (Composer Service)

The Composer Service is an API Gateway that runs within Watt (the Node.js Application Server). It automatically integrates multiple microservices into a unified API ecosystem, providing a single public endpoint for clients while managing routing, composition, and conflict resolution behind the scenes.

The Composer Service aggregates APIs from multiple sources - whether they're other services in your Watt application, external APIs, or legacy systems - presenting them as a cohesive, well-documented API to your clients.

For a high level overview of how Watt and its services work, please reference the [Overview](../../Overview.md) guide. 

## Features

- **Service Discovery**: Automatically discover and compose APIs from multiple services in your Watt application
- **OpenAPI Composition**: Combine multiple OpenAPI specifications into a single, unified API documentation
- **GraphQL Federation**: Aggregate GraphQL schemas from multiple services with Apollo Federation support
- **Conflict Resolution**: Intelligent handling of endpoint conflicts and path overlaps between services
- **Route Prefixing**: Organize APIs with automatic or custom path prefixing for each service
- **Dynamic Updates**: Real-time schema updates when underlying services change (in development mode)
- **Custom Logic**: Extend with Fastify plugins for authentication, rate limiting, or request transformation

## When to Use Composer Service

Composer Service is ideal for:

- **Microservices Architecture**: Present a unified API from multiple independent services
- **API Aggregation**: Combine internal and external APIs into a single public interface
- **Legacy Integration**: Gradually modernize by composing new and legacy APIs
- **Team Boundaries**: Allow different teams to own services while providing unified client experience
- **API Versioning**: Manage different API versions while maintaining client compatibility
- **Client Simplification**: Reduce client complexity by handling service discovery and routing

## Quick Start

Create a Composer Service within a Watt application:

```bash
# Create a new Watt application
wattpm create my-gateway

# Add multiple services to compose
# (This will prompt you through the service setup)
cd my-gateway

# Start in development mode
wattpm dev
```

Your Composer Service will automatically discover other services in your Watt application and create a unified API. Visit `http://localhost:3042/documentation` to see the composed API documentation.

For service-specific configuration and advanced usage, see the [Configuration](./configuration.md) guide.

<Issues />
