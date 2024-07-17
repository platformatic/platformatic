# Advanced Fly.io Deployment

This guide builds on [the Deploy to Fly.io with SQLite](/guides/deployment/deploy-to-fly-io-with-sqlite.md) deployment guide.

## Adding `sqlite` for Debugging

You can debug your SQLite application on Fly.io without stopping your application or exporting data. By the end of this guide, you will be able to run `fly ssh console -C db-cli` to access your remote database.

### Step-by-Step Guide 

1. **Create a Script for Launching the database**
   
  Create a file named `db-cli.sh`:

```sh
#!/bin/sh
set -x
# DSN will be defined in the Dockerfile
sqlite3 $DSN
```

2. **Create a Dockerfile for Build and Deployment**
   
  Create a new Dockerfile:

```dockerfile
FROM node:18-alpine

# Setup sqlite viewer
RUN apk add sqlite
ENV DSN "/app/.platformatic/data/app.db"
COPY db-cli.sh /usr/local/bin/db-cli
RUN chmod +x /usr/local/bin/db-cli

WORKDIR /app
COPY package.json package.json
COPY package-lock.json package-lock.json

RUN npm ci --omit=dev

COPY platformatic.json platformatic.json

COPY migrations migrations
# Uncomment if your application is running a plugin
# COPY plugin.js plugin.js

EXPOSE 8080

CMD ["npm", "start"]
```

3. **Update `package.json`**
  
  Add a `start` script to your `package.json`:

```json 
{
  "scripts": {
    "start": "platformatic start"
  }
}
```

4. **Connecting to the Database**
   
git branUse the following command from your local machine to connect directly to the database:

```sh
fly ssh console -C db-cli
```

## TypeScript Compilation for Deployment

To compile your TypeScript files before deployment, update your `platformatic.json` to include TypeScript settings:
  
```json 
{
  "plugins": {
    "paths": [{
      "path": "plugins",
      "encapsulate": false
    }, "routes"],
    "typescript": {
      "enabled": "{PLT_TYPESCRIPT}",
      "outDir": "dist"
    }
  }
}
```

Ensure `PLT_TYPESCRIPT=true` in your `.env` file for local development. For deployment, set `PLT_TYPESCRIPT=false` to avoid compiling TypeScript at runtime.

Compile your TypeScript source files with:

```sh 
plt service compile 
```

This compiles your TypeScript files and outputs them to the specified `outDir`.

## Deploy Application 

A valid `package.json` will be needed. If you do not have one, generate one by running `npm init`.

In your `package.json`, make sure there is a `start` script to run your application:

```json 
{
  "scripts": {
    "start": "platformatic start"
  }
}
```

Before deploying, make sure a `.dockerignore` file is created:

```sh 
cp .gitignore .dockerignore
```

Finally, deploy the application to Fly.io by running:

```sh
fly deploy
```





