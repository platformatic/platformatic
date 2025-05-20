---
title: Running Your Project in Watt
---

# Running Your Project in Watt

This guide explains how to set up any Node.js project to run in [Watt](https://platformatic.dev/watt), the Node.js Application Server.

## Why Use Watt?

Watt is a powerful environment manager for your Node.js applications that provides:

- Simplified deployment
- Built-in support for multiple services
- Multi-threading
- Standardized environment configuration
- Service orchestration
- Gateway capabilities
- Standardized logging
- Standardized monitoring
- ...and much more!

## Setup Instructions

Follow these steps to make your project run in Watt:

## 0. Prerequisites
Before we begin, make sure you have the following installed:

- [Node.js](https://nodejs.org/) (v20.16.0+ or v22.3.0+)
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

### 2. Install Required Dependencies

Then, install the required dependencies for Watt:


```bash
npm install --save wattpm @platformatic/node
```

Where [`wattpm`](https://docs.platformatic.dev/docs/watt/overview) is the Watt CLI and [`@platformatic/node`](https://docs.platformatic.dev/docs/packages/node/overview) is the generic adapter for "bare" Node.js applications, 
if yours is a Next.js, Astro, or Remix application you might want to use the respective packages:
[`@platformatic/next`](https://docs.platformatic.dev/docs/packages/next/overview),
[`@platformatic/remix`](https://docs.platformatic.dev/docs/packages/remix/overview),
[`@platformatic/astro`](https://docs.platformatic.dev/docs/packages/astro/overview).

### 3. Create Configuration Files

You need two configuration files for Watt: one for Watt itself and one for your service, we will call them `watt.json` and `watt-svc.json`, respectively.

#### watt.json

This is the main configuration file for Watt. Create it in your project root:

```json
{
  "$schema": "https://schemas.platformatic.dev/wattpm/2.63.2.json",
  "server": {
    "hostname": "{HOSTNAME}",
    "port": "{PORT}"
  },
  "logger": {
    "level": "info"
  },
  "services": [{
    "id": "fastify-demo",
    "config": "./watt-svc.json",
    "path": "."
  }]
}
```

#### watt-svc.json

This file defines your specific service configuration, create it in the project root:

```json
{
  "$schema": "https://schemas.platformatic.dev/@platformatic/node/2.63.2.json",
  "node": {
    "main": "dist/server.js"
  }
}
```

Replace `node.main` with the path to your compiled server entry point (e.g., `"dist/server.js"` for TypeScript projects).

### 3. Update Environment Variables

Add these variables to your `.env` file or `.env.example`:

```
# Watt
HOSTNAME=127.0.0.1
PORT=3000  # Choose your preferred port
```

You'll need to set `HOSTNAME` to `0.0.0.0` inside docker containers to allow external access.

### 4. Add an NPM Script

Add a script to your package.json:

```json
"scripts": {
  "watt-start": "wattpm start"
}
```

## Starting Your Application

Once everything is set up, you can start your application with:

```bash
npm run watt-start
```

Or directly with:

```bash
npx wattpm start
```

## Common Issues and Solutions

- **Port conflicts**: If the specified port is already in use, Watt will try the next one.
- **Missing entry point**: Verify that the path in `watt-svc.json` points to your actual server entry file.
- **Build step**: For TypeScript projects, ensure you've built your project before running Watt. You can use `npx wattpm build` to compile your TypeScript files.
- **Environment variables**: Confirm that all required environment variables are available.

## Next-step: add more services

In case you want to divide your application into multiple services, you can do so by creating multiple `watt-svc.json` files, one for each service.
Then you can add them to the `watt.json` file like this:


```json
"services": [
  {
    "id": "service1",
    "config": "./service1/watt-svc.json",
    "path": "./service1"
  },
  {
    "id": "service2",
    "config": "./service2/watt-svc.json",
    "path": "./service2"
  }
]
```

In this case you are better served in using the [`autoload`](/docs/reference/watt/configuration#autoload) feature.

Note that if you need to expose multiple services, you'd need to add a [Composer](/docs/composer/overview).

## Learn More

- [Watt Quick Start](/docs/getting-started/quick-start-watt/)
- [@platformatic/node documentation](/docs/packages/node/overview)
- [Full Stack Guide](/docs/getting-started/quick-start-guide)
