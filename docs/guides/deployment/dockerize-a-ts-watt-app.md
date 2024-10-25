---
title: Dockerize a TypeScript Watt Application
label: Dockerize a TypeScript Watt Application
---


# Dockerizing TypeScript Watt Application

This guide will walk you through dockerizing a TypeScript Platformatic Watt Application.

## Dockerfile for TypeScript Watt Application

Ensure you have a `.dockerignore` file in your project root to avoid unnecessary files such as `node_modules`, `dist`, `.env`, and any other files that are not required being copied into your Docker image. Here is an example of a sample `.dockerignore` file:

```sh 
node_modules
npm-debug.log
Dockerfile
.dockerignore
.env
*.log
dist
```

This reduces the image size and speeds up the build process.

## Dockerizing a TypeScript Watt Application

For a TypeScript-based application, Dockerizing requires TypeScript compilation before deployment. Here’s how to set it up.

### TypeScript Compilation

Create a `tsconfig.json` to configure your TypeScript build process with the following settings: 

```json
{
  "compilerOptions": {
    "module": "commonjs",
    "esModuleInterop": true,
    "target": "es2020",
    "sourceMap": true,
    "pretty": true,
    "noEmitOnError": true,
    "incremental": true,
    "strict": true,
    "outDir": "dist",
    "skipLibCheck": true
  },
  "watchOptions": {
    "watchFile": "fixedPollingInterval",
    "watchDirectory": "fixedPollingInterval",
    "fallbackPolling": "dynamicPriority",
    "synchronousWatchDirectory": true,
    "excludeDirectories": [
      "**/node_modules",
      "dist"
    ]
  }
}
```

Ensure `PLT_TYPESCRIPT=true` in your `.env` file for local development. For production, set `PLT_TYPESCRIPT=false` and compile TypeScript using:

```sh
npx platformatic compile
```

This step compiles your TypeScript files and outputs them to the specified `outDir`.

### Environment Setup

Create a `.env `file with environment variables for local development:

```sh
PORT=3042
PLT_SERVER_HOSTNAME=127.0.0.1
PLT_SERVER_LOGGER_LEVEL=debug
DATABASE_URL=sqlite://.platformatic/data/movie-quotes
```

Add `.env` to `.gitignore` to avoid accidentally committing sensitive information:

```sh 
echo ".env" >> .gitignore
```
