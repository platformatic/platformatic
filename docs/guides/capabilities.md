## Capabilities

Capabilities are the building blocks of Platformatic Watt applications. Each capability is a specialized package that provides specific functionality and integrates seamlessly with the Watt runtime environment.

### How Capabilities Work

A capability is essentially a Node.js package that implements the Platformatic capability interface. When you create a Watt project, you choose one or more capabilities that define what your application can do:

- **Single Capability Applications**: Simple applications with one primary function (e.g., a Next.js frontend or a database API)
- **Multi-Capability Applications**: Complex applications that combine multiple capabilities (e.g., a database backend with a React frontend and an API gateway)

Each Watt project can define a set of application, each using its own capability by defining them in the main `watt.json` file via the [autoload](../reference/runtime/configuration.md#autoload) or the [applications](reference/runtime/configuration.md#application) properties.

Each application gets its own folder and the capability is determined by looking at the `$schema` property of the application `watt.json`.

For instance, to use the `@platformatic/next`, you set the `watt.json` (or `platformatic.json`) file as follows:

```js
{
  "$schema": "https://schemas.platformatic.dev/@platformatic/next/3.0.0.json",
  // ...
}
```

If no `watt.json` is present, then Watt will try to autodetect the right capability by looking at the dependencies in the `package.json` file.

#### Role of Configuration Files

The `watt.json` or `platformatic.json` configuration file serves as the authoritative source for:

- **Service Definition**: Explicitly specifies which capability to use (e.g., `@platformatic/next`, `@platformatic/db`)
- **Application Entry Point**: Points to your application's main file or build output directory
- **Runtime Configuration**: Defines port, environment variables, and capability-specific settings
- **Service Dependencies**: Describes how the service connects to other services in multi-capability applications
- **Override Behavior**: Takes precedence over automatic detection, allowing manual control over capability selection

This configuration-first approach ensures predictable behavior and allows developers to override automatic detection when needed.

#### Embedding Runtime Configuration

Each capability configuration file supports a `runtime` property that allows you to embed runtime-level settings directly in the application's configuration. This is useful for configuring workers, logging, health checks, and other runtime features specific to an application.

For example:

```json
{
  "$schema": "https://schemas.platformatic.dev/@platformatic/next/3.31.0.json",
  "runtime": {
    "logger": {
      "level": "debug"
    },
    "workers": {
      "dynamic": true,
      "minimum": 1,
      "maximum": 4
    }
  }
}
```

See the capability configuration documentation (e.g., [Next.js](../reference/next/configuration.md#runtime), [Node](../reference/node/configuration.md#runtime)) for the full list of available runtime properties.

### Available Capabilities

#### Generic Integrations

##### [`@platformatic/node`](../reference/node/overview.md)

- **Description**: Generic Node.js capability
- **Use Case**: For standard Node.js applications that need integration with the Watt runtime
- **Features**: Basic HTTP server functionality, environment variable management, process management

##### [`@platformatic/gateway`](../reference/gateway/overview.md)

- **Description**: API gateway for aggregating services
- **Use Case**: Composing multiple services into a unified API, routing, and service orchestration
- **Features**: Service discovery, request routing, API composition, load balancing

#### Frontend Framework Integrations

##### [`@platformatic/next`](../reference/next/overview.md)

- **Description**: Next.js application integration
- **Use Case**: Server-side rendered React applications, static site generation
- **Features**: SSR/SSG support, API routes, file-based routing, optimization

##### [`@platformatic/vite`](../reference/vite/overview.md)

- **Description**: Vite-based application support
- **Use Case**: Modern frontend applications with fast development server
- **Features**: Hot module replacement, build optimization, plugin ecosystem

##### [`@platformatic/vinext`](../reference/vinext/overview.md)

- **Description**: Vinext integration for running Next.js-compatible apps on Vite
- **Use Case**: Vinext applications using App Router or Pages Router under Watt
- **Features**: App/Pages router support, Vite-based dev/build lifecycle, gateway integration

##### [`@platformatic/astro`](../reference/astro/overview.md)

- **Description**: Astro framework integration
- **Use Case**: Content-focused websites, static site generation with islands architecture
- **Features**: Component islands, multiple framework support, static generation

##### [`@platformatic/remix`](../reference/remix/overview.md)

- **Description**: Remix framework integration
- **Use Case**: Full-stack web applications with focus on web standards
- **Features**: Nested routing, data loading, form handling, progressive enhancement

##### [`@platformatic/nest`](../reference/nest/overview.md)

- **Description**: NestJS framework integration
- **Use Case**: Scalable Node.js server-side applications with TypeScript
- **Features**: Dependency injection, decorators, modular architecture

#### Additional Capabilities

##### [`@platformatic/service`](../reference/service/overview.md)

- **Description**: HTTP service based on Fastify
- **Use Case**: Building high-performance REST APIs and web services
- **Features**: Auto-generated OpenAPI documentation, plugin system, validation, serialization

##### [`@platformatic/db`](../reference/db/overview.md)

- **Description**: Database service with auto-generated APIs
- **Use Case**: Rapid API development with automatic CRUD operations from database schema
- **Features**: Auto-generated GraphQL/REST endpoints, migrations, seeds, authorization

##### [`@platformatic/php`](https://github.com/platformatic/php)

- **Description**: PHP application support
- **Use Case**: Integrating PHP applications into the Watt ecosystem
- **Features**: PHP process management, HTTP integration

##### [`@platformatic/ai-warp`](https://github.com/platformatic/ai-warp)

- **Description**: AI integration capabilities
- **Use Case**: Adding AI/ML functionality to applications
- **Features**: AI service integration, model management

##### [`@platformatic/pg-hooks`](https://github.com/platformatic/pg-hooks)

- **Description**: PostgreSQL hooks
- **Use Case**: Database event handling and triggers
- **Features**: Database event listening, hook management

##### [`@platformatic/rabbitmq-hooks`](https://github.com/platformatic/rabbitmq-hooks)

- **Description**: RabbitMQ integration
- **Use Case**: Message queue integration and event-driven architecture
- **Features**: Message publishing/consuming, queue management

##### [`@platformatic/kafka-hooks`](https://github.com/platformatic/kafka-hooks)

- **Description**: Kafka integration
- **Use Case**: Streaming data processing and event sourcing
- **Features**: Stream processing, topic management, event sourcing

### Adding Custom Capabilities

Use the `--module` option to specify additional capabilities beyond the default ones:

```bash
# Add a custom capability
npm create wattpm --module=my-custom-capability

# Add multiple capabilities
npm create wattpm --module=@my-org/plugin1 --module=@my-org/plugin2

# Short form
npm create wattpm --module=my-plugin
```

## Interactive Workflow

When you run `npm create wattpm`, you'll be guided through:

1. **Project Location**: Choose where to create your project
2. **Service Type**: Select the type of service you want to create
3. **Service Configuration**: Configure service-specific options
4. **Multi-Service Setup**: Optionally add additional services
5. **Entry Point**: Choose which service should be exposed (for multi-service projects)
6. **Package Manager**: Select npm, yarn, or pnpm
7. **Git Initialization**: Optionally initialize a Git repository

## Examples

### Creating a Basic HTTP Service

```bash
npm create wattpm
```

Follow the prompts:

- Choose project location: `my-watt-app`
- Select service type: `@platformatic/service`
- Configure TypeScript and other options
- Choose to install dependencies

### Creating a Next.js Application

```bash
npm create wattpm
```

Follow the prompts:

- Choose project location: `my-next-app`
- Select service type: `@platformatic/next`
- Configure your Next.js specific options

### Creating with Custom Capabilities

```bash
npm create wattpm --module=@my-company/custom-plugin
```

This will include your custom capability in the list of available service types during the interactive setup.

### Multi-Service Application

During the interactive setup, you can choose to create multiple services:

- First service: `@platformatic/db` (database API)
- Second service: `@platformatic/next` (frontend)
- Choose which service to expose as the main entry point

## Wrapping Existing Applications

`create-wattpm` can wrap existing applications into the Watt runtime environment:

1. Run `npm create wattpm` in a directory containing an existing application
2. The tool will detect your application type (React, Next.js, etc.)
3. Choose to wrap the existing application into Watt
4. Your application will be integrated with Watt's runtime features

### Supported Application Types

The tool can automatically detect and wrap:

- React applications
- Next.js applications
- Vite-based projects
- Other JavaScript/TypeScript applications

## Package Manager Support

`create-wattpm` supports and auto-detects:

- **npm** - Default Node.js package manager
- **yarn** - Alternative package manager
- **pnpm** - Fast, disk space efficient package manager

The tool will detect existing lockfiles and use the appropriate package manager, or prompt you to choose one.

## Git Integration

The tool offers to initialize a Git repository with:

- Initial commit with generated files
- Appropriate `.gitignore` file
- Remote origin setup (if applicable)
