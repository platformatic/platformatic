# Dockerizing and Deploying Watt Applications to Fly.io

This guide will walk you through three key parts:

1. Dockerizing a JavaScript Platformatic Watt Application.
2. Dockerizing a TypeScript Platformatic Watt Application.
3. Deploying a Multi-Service Platformatic Watt Application to Fly.io.

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
- **CMD npm run start**: Specifies the command to start the application, using the start script defined in the `package.json`.\

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

## Deploying a Multi-Service Watt Application to Fly.io

In this section, you will deploy a Platformatic Watt application with multiple services to Fly.io.

### Fly.io Configuration

Before starting, install the Fly CLI and sign up for an account by following [Fly.io’s official guide](https://fly.io/docs/getting-started/launch-demo/).

#### Setting Up Fly.io 

1. **Initialize your Fly.io application**: Run the following command from your project root:

  ```sh 
    fly launch --no-deploy --generate-name --region lhr --org personal --path .
  ```

2. **Fly Configuration (fly.toml)**: The Fly CLI will generate a fly.toml configuration file for your application.

Ensure your fly.toml has the following settings for database volumes and builds:

```toml
[build]
  builder = "heroku/buildpacks:20"

[mounts]
  source = "data"
  destination = "/app/.platformatic/data"
```

3. **Database Volume**: Create a persistent volume for your database storage:
   
```sh
fly volumes create data --size 3 --region lhr
```

4. **Fly Environment Variables**: Ensure your environment variables from your .env file are also present in fly.toml:

```toml
[env]
  PORT = 8080
  PLT_SERVER_HOSTNAME = "0.0.0.0"
  PLT_SERVER_LOGGER_LEVEL = "info"
  DATABASE_URL = "sqlite:///app/.platformatic/data/db.sqlite"
```
It's important to note that your `env` PORT must match the `PORT` in your `fly.toml` file. Navigate to your `watt.json` file and update the hostname and port to match the following:

```json
"server": {
    "hostname": "0.0.0.0",
    "port": "{PORT}"
  },
```

### Deploying to Fly.io

Now that the configuration is complete, deploy your Platformatic application to Fly.io:

```sh
fly deploy
```

Fly.io will build the image, start the app, and ensure all services are running.


