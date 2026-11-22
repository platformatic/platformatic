---
title: Running Your Project in Watt
---

# Running Your Project in Watt

This guide explains how to set up any Node.js project to run in [Watt](https://platformatic.dev/watt), the Node.js Application Server.

## Why Use Watt?

Watt is a powerful environment manager for your Node.js applications that provides:

- Simplified deployment
- Built-in support for multiple applications
- Multi-threading
- Standardized environment configuration
- Application orchestration
- Gateway capabilities
- Standardized logging
- Standardized monitoring
- ...and much more!

## Setup Instructions

Follow these steps to make your project run in Watt:

## 0. Prerequisites

Before we begin, make sure you have the following installed:

- [Node.js](https://nodejs.org/) (v24.20.0+)
- A Node.js application to run. These steps have been tested on the official Fastify [demo](https://github.com/fastify/demo).

### 1. Clone your Project

If you haven't already, clone your project repository. For example, to clone the Fastify demo:

```bash
git clone git@github.com:fastify/demo.git
```

Then, navigate to the project directory and install its dependencies:

```bash
cd demo
npm install
```

### 2. Integrate with the Watt skill

Install the [official skill](../guides/use-watt-with-ai-agents.md):

```sh
npx skills add platformatic/skills --skill watt
```

Select the exact published Watt 4 version and authorize its local installation before
delegating to the skill. If the project already uses Watt 3, explicitly select
[destination-version migration guidance](../guides/use-watt-with-ai-agents.md#migrating-an-existing-watt-3-project)
instead of treating its local v3 instructions as v4 instructions.

Ask your agent to integrate the existing application with Watt 4 on port 3042,
preserving its source, module convention, original scripts, and environment files.
It should add `wattpm`, the matching capability, and a minimal configuration.
Review changes and authorize dependency installation. For manual integration, see
the [framework reference](../skills/watt/references/frameworks.md).

Use `watt.config.mjs` when the package does not declare `"type": "module"`, or
`watt.config.js` / `watt.config.ts` in an ESM package. Keep one configuration file.

### 3. Setup application commands (optional)

If your application is using custom commands to start, you must set them in your configuration file. Modify the `application.commands` property like in the example below:

```ts config
export default {
  logger: { level: process.env.LOG_LEVEL ?? 'info' },
  application: {
    config: {
      module: '@platformatic/node',
      server: {
        hostname: process.env.HOSTNAME ?? '127.0.0.1',
        port: Number(process.env.PORT ?? 3042)
      },
      application: {
        commands: {
          development: 'npm run dev',
          build: 'npm run build',
          production: 'npm run start'
        }
      }
    }
  }
}
```

The file reads `process.env` directly. Runtime settings like `logger` belong to the
root; capability settings sit under `application.config`. Use `createWattConfig`
from `wattpm` for typed configuration, or add a versioned `$schema` when generating
a plain-object file. Preserve the original framework scripts under different names
to avoid recursively invoking Watt from `application.commands`.

## Starting Your Application

Once everything is set up, you can start your application in development mode with:

```bash
wattpm dev
```

or, you can build and start your application in production mode:

```bash
wattpm build
wattpm start
```

## Port your Next.js application to Watt

Ask your agent to integrate the existing Next.js application, or install the packages directly.

From the root of your application, run:

```sh
npm install wattpm @platformatic/next
```

An inferred single-application project can run without configuration. Write a file
when you need a specific port or other settings.

By default, Watt will run on a random port. If you want to choose a specific port — or anything else the defaults do not cover — write a `watt.config.mjs` at the root of your application:

```ts config
import { createNextConfig } from '@platformatic/next'

export default createNextConfig({
  server: { port: 3000 }
})
```

## Common Issues and Solutions

- **Port conflicts**: If the specified port is already in use, the application fails to start. Choose another port in the capability configuration.
- **Missing scripts**: If you use a custom start script, set it in your configuration file under `application.commands.production`. See step 3 above for more information.
- **Build step**: For TypeScript projects, ensure you've built your project before running Watt. You can use `wattpm build` to compile your TypeScript files.
- **Environment variables**: Confirm that all required environment variables are available.

## Learn More

- [Migrate from Express](../learn/migrations/from-express.md) - a staged migration, from zero-change wrapping to splitting into multiple applications
- [Migrate from Fastify](../learn/migrations/from-fastify.md) - the same, with Fastify specifics
- [Migrate to Watt v4](../guides/migrate-v4.md) - update Watt configuration, globals, listeners, interceptors, and application shutdown
- [Watt Quick Start](/docs/getting-started/quick-start/)
- [Framework Integration Guides](/docs/guides/frameworks) - Setup guides for Next.js, Astro, Remix, Vite, and more
