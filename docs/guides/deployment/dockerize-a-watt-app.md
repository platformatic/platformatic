# Dockerizing Watt Applications

This guide will walk you through dockerizing a JavaScript Platformatic Watt Application.

## Preparation

Before you start, make sure you have the following setting in your `watt.json` / `platformatic.json` root file:

```json
{
  "server": {
    "hostname": "{PLT_HOSTNAME}",
    "port": "{PORT}"
  }
}
```

For local development, those values can be set in your `.env` file:

```env
PLT_HOSTNAME=127.0.0.1
PORT=3042
```

## Dockerfile for JavaScript/TypeScript Watt Application

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

# We must listen to all network interfaces
ENV PLT_HOSTNAME=0.0.0.0

# Set the environment variable for the port
ENV PORT=3042

# Expose the port
EXPOSE 3042

# Start the application
CMD npm run start
```

### Explanation
- **WORKDIR /app**: Sets the working directory inside the container to /app, where all commands will be executed.
- **COPY package.json .**: Copies the `package.json` file from the local directory to the `/app` directory in the container. It's important to do this for all files in each service. 
- **RUN --mount=type=bind,source=./package.json,target=./package.json**: Installs dependencies for the main application using a [bind mount](https://docs.docker.com/engine/storage/bind-mounts/) for the `package.json` file.
- **--mount=type=cache,target=/root/.npm**: Caches the `node_modules` in the specified directory to speed up subsequent builds.
- **COPY . .**: Copies all remaining files and folders into the `/app` directory in the container.
- **RUN npm run build**: Executes the build script defined in the `package.json`, which typically compiles assets and prepares the application for production. This is usually done with `npx wattpm build`.
- **ENV PLT_HOSTNAME=0.0.0.0**: set the `PLT_HOSTNAME` variable so that it listens to all network interfaces.
- **ENV PORT=3042**: Sets the `PORT` environment variable to 3042, which is the port the application will listen on.
- **EXPOSE 3042**: Exposes port 3042, allowing external access to the application running in the container.
- **CMD npm run start**: Specifies the command to start the application, using the start script defined in the `package.json`.
