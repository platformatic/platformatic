import Issues from '../../getting-started/issues.md';

# Overview

Platformatic Composer is designed to automatically integrate microservices into one ecosystem, providing a single public API for more efficient management and deployment. It is a new way to develop aggregated APIs, starting with OpenAPI composition across multiple API sources. 

## Features of Platformatic Composer

- **OpenAPI Composition:** Effortlessly combine multiple APIs into a cohesive structure.
- **Conflict Resolution:** Automatically resolve endpoint conflicts between different endpoints to maintain API consistency.
- **Automatic Schema Refresh:** Keep your API schema up-to-date with changes in the source APIs without manual intervention.
- **Extensibility:** Customize and extend functionality using Node.js and [Fastify](https://www.fastify.io/) plugins.
- **TypeScript Support:** Benefit from automatic TypeScript compilation to enhance code quality and reliability.
- **Platformatic Service Integration:** Utilize all the robust features of Platformatic Service to supercharge your API management.

## Command Line usage (CLI)

When using [Watt](../watt/overview.md), `@platformatic/composer` services will make some additional commands available on the terminal.

All the commands will be prefixed by the service id. For instance, if your service id is `main`, then you will have the following commands available:

* `main:fetch-openapi-schemas`: Fetch OpenAPI schemas from remote services.

<Issues />
