# Framework Integration Guides

Watt supports seamless integration with popular frontend frameworks and Node.js runtimes. Each framework integration provides built-in development tools, optimized builds, and deployment-ready configurations.

Choose the framework that best fits your project needs - whether you're building static sites, server-rendered applications, or complex Node.js services.

## Frontend Frameworks

### [Astro](../reference/astro/overview.md)
Modern static site generator with component hydration and built-in optimizations.

- **[Overview](../reference/astro/overview.md)** - Getting started with Astro integration
- **[Configuration](../reference/astro/configuration.md)** - Complete configuration reference
- **[Caching](../reference/astro/caching.md)** - Caching strategies and configuration

### [Next.js](../reference/next/overview.md)
Full-stack React framework with server-side rendering and app router support.

- **[Overview](../reference/next/overview.md)** - Getting started with Next.js integration
- **[Configuration](../reference/next/configuration.md)** - Complete configuration reference

### [Remix](../reference/remix/overview.md)
Full-stack web framework focused on web fundamentals and modern user experience.

- **[Overview](../reference/remix/overview.md)** - Getting started with Remix integration
- **[Configuration](../reference/remix/configuration.md)** - Complete configuration reference
- **[Caching](../reference/remix/caching.md)** - Caching strategies and configuration

### [Vite](../reference/vite/overview.md)
Fast build tool with hot module replacement for modern web projects.

- **[Overview](../reference/vite/overview.md)** - Getting started with Vite integration
- **[Configuration](../reference/vite/configuration.md)** - Complete configuration reference

## Node.js Runtimes

### [Node.js](../reference/node/overview.md)
Generic Node.js capability for custom applications and existing codebases.

- **[Overview](../reference/node/overview.md)** - Getting started with Node.js integration
- **[Configuration](../reference/node/configuration.md)** - Complete configuration reference

### [NestJS](../reference/nest/overview.md)
Progressive Node.js framework for building scalable server-side applications.

- **[Overview](../reference/nest/overview.md)** - Getting started with NestJS integration
- **[Configuration](../reference/nest/configuration.md)** - Complete configuration reference

## Quick Start

To add a framework to your Watt application:

1. **Add the application to your configuration:**
   ```json
   {
     "applications": [
       {
         "id": "frontend",
         "path": "./frontend",
         "config": "platformatic.json"
       }
     ]
   }
   ```

2. **Create framework-specific configuration:**
   Each framework has its own configuration file with framework-specific options and build settings.

3. **Run your application:**
   ```bash
   watt start
   ```

## Integration Features

All framework integrations provide:

- **Development Mode** - Hot reload and fast refresh during development
- **Production Builds** - Optimized builds for deployment
- **Environment Configuration** - Framework-specific environment variable handling
- **Logging Integration** - Unified logging across all applications
- **Metrics Collection** - Built-in observability and monitoring
- **TypeScript Support** - Full TypeScript integration where applicable

## Need Help?

- **New to Watt?** Start with the [Watt Quick Start](/docs/getting-started/quick-start) guide
- **Migrating an existing app?** See [Running Your Project in Watt](/docs/getting-started/port-your-app)
- **Framework-specific issues?** Check the individual framework reference pages above
- **Technical details?** Browse the complete [Reference Documentation](../reference/) 
- **Step-by-step tutorials?** Visit our [Learning Tutorials](../learn/)
- **Community support?** Join our [Discord Community](https://discord.gg/platformatic)