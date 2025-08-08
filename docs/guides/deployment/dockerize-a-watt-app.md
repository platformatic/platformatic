# How to Dockerize Your Watt Application

## Problem

You need to containerize your Platformatic Watt application for production deployment or to ensure consistent environments across development, staging, and production.

## Solution Overview

This guide shows you how to create a multi-stage Docker build that optimizes your Watt application for production deployment. You'll create a Dockerfile that:
- Efficiently handles workspace dependencies
- Optimizes build caching
- Produces a minimal production image
- Properly configures networking for containers

## Prerequisites

- Docker installed on your system
- A Platformatic Watt application ready to containerize
- Basic understanding of Docker concepts

## Step 1: Configure Your Application for Containers

Ensure your `watt.json` or `platformatic.json` uses environment variables for hostname and port:

```json
{
  "server": {
    "hostname": "{HOSTNAME}",
    "port": "{PORT}"
  }
}
```

In your development `.env` file:

```env
HOSTNAME=127.0.0.1
PORT=3042
```

**Why this matters:** Containers need to bind to all network interfaces (`0.0.0.0`) to accept external connections, while development typically uses `127.0.0.1`.

## Step 2: Create Your Dockerfile

Create a `Dockerfile` in your project root with this multi-stage build configuration:

```dockerfile
# syntax=docker/dockerfile:1.7-labs

# Stage 1: Build
ARG NODE_VERSION=22
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
ENV HOSTNAME=0.0.0.0

# Set the environment variable for the port
ENV PORT=3042

# Expose the port
EXPOSE ${PORT}

# Start the application
CMD npm run start
```

## Step 3: Build and Run Your Container

Build your Docker image:

```bash
docker build -t my-watt-app .
```

Run the container:

```bash
docker run -p 3042:3042 --env-file .env my-watt-app
```

**Verification:** Open `http://localhost:3042` to confirm your application is running.

## Understanding the Dockerfile

### Multi-Stage Build Benefits

**Build Stage:**
- Installs all dependencies (including dev dependencies for building)
- Runs build processes that may require dev tools
- Creates optimized production assets

**Production Stage:**
- Copies only the built application files
- Installs only production dependencies  
- Results in a smaller, more secure final image

### Key Configuration Points

**Network Binding:**
```dockerfile
ENV HOSTNAME=0.0.0.0
```
Containers must bind to all interfaces (`0.0.0.0`) to accept external traffic, not just localhost.

**Dependency Caching:**
```dockerfile
RUN --mount=type=cache,target=/root/.npm npm install
```
Caches npm downloads between builds, significantly speeding up subsequent builds.

**Workspace Handling:**
```dockerfile
COPY --parents ./web/*/package.json ./
```
Preserves the workspace structure when copying package.json files from subdirectories.

## Troubleshooting

**Container exits immediately:**
- Check that your `npm start` script exists in package.json
- Verify your application doesn't try to connect to localhost services

**Cannot reach application:**
- Ensure you're using `HOSTNAME=0.0.0.0` in the container
- Verify port mapping: `-p 3042:3042`

**Build failures:**
- Check that all necessary files are copied before running build
- Verify workspace dependencies are properly handled

## Next Steps

- [Deploy to Kubernetes](./k8s-readiness-liveness.md)
- [Set up monitoring in production](../monitoring.md)
- [Configure logging for containers](../logging.md)
