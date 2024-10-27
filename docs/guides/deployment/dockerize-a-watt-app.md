# Dockerizing Watt Applications

This guide will walk you through dockerizing a JavaScript Platformatic Watt Application.

## Dockerfile for JavaScript Watt Application

Below is an example of a multi-build Dockerfile for a Platformatic JavaScript Watt application with a frontend, composer and DB service:

```dockerfile
# syntax=docker/dockerfile:1.7-labs

# Stage 1: Build
ARG NODE_VERSION=20
FROM node:${NODE_VERSION}-alpine AS build

WORKDIR /app

# Copy all package.json files
COPY package.json ./
COPY package-lock.json ./
# Copy all package.json files from the web directories
# This uses an experimental feature to copy files from multiple directories
# and maintain the directory structure.
# https://docs.docker.com/reference/dockerfile/#copy---parents
# If this is not available in your Docker version, you can copy each package.json
# file individually. like so:
# COPY ./web/app/package.json ./web/app/package.json
COPY --parents ./web/*/package.json ./

# Install all dependencies (including dev dependencies)
RUN --mount=type=cache,target=/root/.npm npm install

# Copy the rest of the project files and run the build
COPY . .
RUN npm run build

# Stage 2: Production
FROM node:${NODE_VERSION}-alpine AS production

WORKDIR /app

# Copy the built files from the build stage
COPY --from=build /app ./

# Install only production dependencies
RUN --mount=type=cache,target=/root/.npm npm install --omit=dev

# Expose the port
EXPOSE 3042

# Start the application
CMD npm run start
```

### Explanation
- **WORKDIR /app**: Sets the working directory inside the container to /app, where all commands will be executed.
- **COPY package.json .**: Copies the `package.json` file from the local directory to the `/app` directory in the container. It's important to do this for all files in each service. 
- **RUN --mount=type=bind,source=./package.json,target=./package.json**: Installs dependencies for the main application using a [bind mount](https://docs.docker.com/engine/storage/bind-mounts/) for the `package.json` file.
- **--mount=type=cache,target=/root/.npm**: Caches the node_modules in the specified directory to speed up subsequent builds.
- **COPY . .**: Copies all remaining files and folders into the /app directory in the container.
- **RUN npm run build**: Executes the build script defined in the `package.json`, which typically compiles assets and prepares the application for production.
- **EXPOSE 3042**: Exposes port 3042, allowing external access to the application running in the container.
- **CMD npm run start**: Specifies the command to start the application, using the start script defined in the `package.json`.


## Dockerizing TypeScript Watt Application

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

This step automatically compiles your TypeScript files and outputs them to the specified `outDir` during the `npm build` step in the Dockerfile.

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
