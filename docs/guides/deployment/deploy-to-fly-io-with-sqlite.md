# Deploy to Fly.io with SQLite

To follow this how-to guide, you'll first need to install the Fly CLI and create
an account by [following this official guide](https://fly.io/docs/hands-on/).
You will also need an existing [Platformatic DB](../../db/overview.md) project, please check out our
[getting started guide](../../getting-started/quick-start-guide.md) if needed.

Navigate to your Platformatic DB project in the terminal on your local machine.
Run `fly launch` and follow the prompts. When it asks if you want to deploy
now, say "no" as there are a few things that you'll need to configure first.

You can also create the fly application with one line. This will create your
application in London (`lhr`):

```sh
fly launch --no-deploy --generate-name --region lhr --org personal --path .
```

The `fly` CLI should have created a `fly.toml` file in your project
directory.

## Explicit Builder

The `fly.toml` file may be missing an explicit builder setting. To have consistent builds, it is best to add a `build` section:

```toml
[build]
  builder = "heroku/buildpacks:20"
```

## Database Storage

Create a volume for database storage, naming it `data`:

```bash
fly volumes create data
```

This will create storage in the same region as the application. The volume defaults to 3GB size, use  `-s` to change the size. For example, `-s 10` is 10GB.

Add a `mounts` section in `fly.toml`:

```toml
[mounts]
  source = "data"
  destination = "/app/.platformatic/data"
```

Create a directory in your project where your SQLite database will be created:

```bash
mkdir -p .platformatic/data

touch .platformatic/data/.gitkeep
```

The `.gitkeep` file ensures that this directory will always be created when your application is deployed.

You should also ensure that your SQLite database is ignored by Git. This helps avoid inconsistencies when your application is deployed:

```bash
echo "*.db" >> .gitignore
```

The command above assumes that your SQLite database file ends with the extension `.db` — if the extension is different then you must change the command to match.

Update your  `platformatic.json` configuration file to use environment variables for the database connection and server settings:

```json
{
  "db": {
    "connectionString": "{DATABASE_URL}"
  },
  "migrations": {
    "dir": "./migrations",
    "autoApply": true
  },
  "server": {
    "logger": {
      "level": "{PLT_SERVER_LOGGER_LEVEL}"
    },
    "hostname": "{PLT_SERVER_HOSTNAME}",
    "port": "{PORT}"
  }
}
```

## Configure Environment

Start with your local environment, create a `.env` file and put the following:

```sh
PORT=3042
PLT_SERVER_HOSTNAME=127.0.0.1
PLT_SERVER_LOGGER_LEVEL=debug
DATABASE_URL=sqlite://.platformatic/data/movie-quotes.db
```

Avoid accidental leaks by ignoring your `.env` file:

```bash
echo ".env" >> .gitignore
```

This same configuration needs to added to `fly.toml`:

```toml
[env]
  PORT = 8080
  PLT_SERVER_HOSTNAME = "0.0.0.0"
  PLT_SERVER_LOGGER_LEVEL = "info"
  DATABASE_URL = "sqlite:///app/.platformatic/data/movie-quotes.db"
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

## Deploy application

A valid `package.json` will be needed so if you do not have one, generate one by running `npm init`.

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

Finally, deploy the application to Fly by running:

```sh
fly deploy
```
