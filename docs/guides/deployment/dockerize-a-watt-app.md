---
title: Dockerize a Watt Application
label: Dockerize a Watt Application
---


# Dockerizing Watt Applications

This guide will walk you through dockerizing a JavaScript Platformatic Watt Application.

## Dockerfile for JavaScript Watt Application

Below is an example of a multi-build Dockerfile for a Platformatic JavaScript Watt application with a frontend, composer and DB service:

```dockerfile
# Stage 1: Build
ARG NODE_VERSION=20
FROM node:${NODE_VERSION}-alpine AS build

WORKDIR /app

# Copy all package.json files
COPY package.json ./
COPY ./web/composer/package.json ./web/composer/package.json  
COPY ./web/db/package.json ./web/db/package.json 
COPY ./web/frontend/package.json ./web/frontend/package.json 

# Install all dependencies (including dev dependencies)
RUN --mount=type=cache,target=/root/.npm npm install

# Copy the rest of the project files and run the build
COPY . .
RUN npm run build

# Stage 2: Production
FROM node:${NODE_VERSION}-alpine AS production

WORKDIR /app

# Copy only production dependencies
COPY package.json ./
COPY ./web/composer/package.json ./web/composer/package.json  
COPY ./web/db/package.json ./web/db/package.json 
COPY ./web/frontend/package.json ./web/frontend/package.json 

# Install only production dependencies
RUN --mount=type=cache,target=/root/.npm npm install --production

# Copy the built files from the build stage
COPY --from=build /app ./

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


