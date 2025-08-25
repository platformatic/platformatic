# Reference Documentation

This section contains comprehensive technical specifications, configuration references, and API documentation for all Platformatic components.

## How This Section is Organized

The reference documentation is organized by **user mental model** rather than internal package structure, making it easier to find what you need based on what you want to accomplish:

### 🏗️ Watt (Node.js Application Server)
The core application server that runs and orchestrates all your applications. This is the primary product that everything else runs within.

- **Overview** - What Watt is and how it works
- **Configuration** - Complete configuration options
- **CLI Reference** - Command-line interface documentation

### 🛠️ CLI Tools
Command-line tools for creating, managing, and deploying Platformatic applications.

### 🌐 Applications & APIs
Applications that run within Watt to handle different aspects of your application:

- **Database Application** - Auto-generated APIs from your database schema
- **HTTP Application** - Custom application logic and APIs  
- **API Gateway (Gateway)** - Aggregate multiple applications into unified APIs
- **Client SDK** - Generated clients for consuming APIs

### 🎨 Framework Integrations (Capabilities)
Framework integrations that let you run frontend applications alongside your APIs:

- **Next.js** - React applications with SSR/SSG
- **Astro** - Multi-framework static sites
- **Remix** - Full-stack React applications
- **Vite** - Modern build tooling for any framework
- **Node.js** - Generic Node.js applications

### ⚙️ Runtime & Orchestration
Development and production runtime environment for managing multiple applications.

### 🗄️ SQL Data Layer
Low-level components for database integration and API generation:

- **SQL Mapper** - Database ORM and entity management
- **GraphQL API Generation** - Automatically generated GraphQL APIs
- **REST API Generation** - Automatically generated REST APIs
- **SQL Events** - Database change events and triggers

## Finding What You Need

- **New to Platformatic?** Start with [Getting Started](/docs/getting-started/quick-start-watt)
- **Need to solve a specific problem?** Check [How-to Guides](/docs/guides/build-modular-monolith)
- **Need specific examples?** Check [How-to Guides](/docs/guides/build-modular-monolith) for practical solutions
- **Looking for specific configuration options?** Use the search or browse the relevant application section above

## Configuration Patterns

Most Platformatic components follow consistent patterns:

- **JSON Schema validation** - All configuration files are validated
- **Environment variable support** - Use `{PLT_*}` placeholders
- **Plugin architecture** - Extend functionality with Fastify plugins
- **TypeScript support** - Auto-generated types for your APIs

## Getting Help

- **Discord Community** - Join our [Discord server](https://discord.gg/platformatic)
- **GitHub Issues** - Report bugs or request features
- **Documentation** - Search or browse this reference section