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

- [Node.js](https://nodejs.org/) (v22.19.0+)
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

### 2. Use `npm create wattpm`

Use `npm create wattpm` to wrap your application inside Watt.

```bash
$ npm create wattpm
Hello YOURNAME, welcome to Watt 3.0.0!
? This folder seems to already contain a Node.js application. Do you want to wrap into Watt? yes
? What port do you want to use? 3042
[15:59:20.315] INFO (53128): /home/user/work/demo/.env written!
[15:59:20.319] INFO (53128): /home/user/work/demo/.env.sample written!
[15:59:20.319] INFO (53128): /home/user/work/demo/package.json written!
[15:59:20.320] INFO (53128): /home/user/work/demo/watt.json written!
[15:59:20.320] INFO (53128): Installing dependencies for the application using npm ...
[15:59:37.237] INFO (53128): You are all set! Run `npm start` to start your project.
```

### 3. Setup application commands (optional)

If your application is using custom commands to start, you must set them in your `watt.json`. Modify the `application.commands` property like in the example below:

```json
{
  "$schema": "https://schemas.platformatic.dev/@platformatic/node/3.0.0.json",
  "application": {
    "commands": {
      "development": "npm run dev",
      "build": "npm run build",
      "production": "npm run start"
    }
  },
  "runtime": {
    "logger": {
      "level": "{PLT_SERVER_LOGGER_LEVEL}"
    },
    "server": {
      "hostname": "{PLT_SERVER_HOSTNAME}",
      "port": "{PORT}"
    },
    "managementApi": "{PLT_MANAGEMENT_API}"
  }
}
```

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

## Common Issues and Solutions

- **Port conflicts**: If the specified port is already in use, Watt will try the next one.
- **Missing scripts**: If you use a custom start script, insert into the `watt.json` file in the section `application.commands.production`. See the step 3 above for more informations.
- **Build step**: For TypeScript projects, ensure you've built your project before running Watt. You can use `wattpm build` to compile your TypeScript files.
- **Environment variables**: Confirm that all required environment variables are available.

## Learn More

- [Watt Quick Start](/docs/getting-started/quick-start/)
- [Framework Integration Guides](/docs/guides/frameworks) - Setup guides for Next.js, Astro, Remix, Vite, and more
