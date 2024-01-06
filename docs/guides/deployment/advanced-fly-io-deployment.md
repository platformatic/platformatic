# Advanced Fly.io Deployment

Techniques used in this guide are based on [the Deploy to Fly.io with SQLite](/guides/deployment/deploy-to-fly-io-with-sqlite.md)
deployment guide.

## Adding `sqlite` for debugging

With a combination of Docker and Fly.io, you can create an easy way to debug
your sqlite application without stopping your application or exporting the data.
At the end of this guide, you will be able to run `fly ssh console -C db-cli` to
be dropped into your remote database.

Start by creating a script for launching the database, calling it **db-cli.sh**:

```bash
#!/bin/sh
set -x
# DSN will be defined in the Dockerfile
sqlite3 $DSN
```

Create a new **Dockerfile** which will act as the build and deployment image:

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

COPY platformatic.db.json platformatic.db.json

COPY migrations migrations
# Uncomment if your application is running a plugin
# COPY plugin.js plugin.js

EXPOSE 8080

CMD ["npm", "start"]
```

Add a `start` script to your **package.json**:

```json
{
  "scripts": {
    "start": "platformatic db"
  }
}
```

With Fly, it becomes straightforward to connect directly to the database by
running the following command from your local machine:

```bash
fly ssh console -C db-cli
```
