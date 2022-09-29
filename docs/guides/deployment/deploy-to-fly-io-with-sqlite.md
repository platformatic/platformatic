# Deploy to Fly.io with SQLite

:::note

To follow this how-to guide, you'll first need to install the Fly CLI and create
an account by [following this official guide](https://fly.io/docs/hands-on/).

:::note

Navigate to your Platformatic DB project in the terminal on your local machine.
Run `fly launch` and follow the prompts. When it asks if you want to deploy
now, say "no" as there are a few things that you'll need to configure first.

<!-- TODO: Could probably put a command here to launch the app in non-interactive mode -->

Create a volume for database storage:

```bash
fly volumes create data
```

This will create storage in the same region as the application. The volume
defaults to 3GB size, use  `-s` to change the size. For example, `-s 10` is 10GB.

Add a `mounts` section in **fly.toml**, replacing `<app-name>` with the name
of your application:

<!-- TODO: Check this mount path, probably not correct now we're not using Docker -->

```toml
[mounts]
  source = "data"
  destination = "/opt/<app-name>/.platformatic/data"
```

Create a directory in your project where your SQLite database will be created:

```bash
mkdir -p .platformatic/data

touch .platformatic/data/.gitkeep
```

The `.gitkeep` file ensures that this directory will always be created when
your application is deployed.

You should also ensure that your SQLite database is ignored by Git. This helps
avoid inconsistencies when your application is deployed:

```bash
echo "*.db" >> .gitignore
```

The command above assumes that your SQLite database file ends with the extension
`.db` — if the extension is different then you must change the command to match.

<!-- TODO: This should be done by setting a `DATABASE_URL` environment variable in `fly.toml` -->

Update the connection string to point to the SQLite database, replacing `<app-name>`:

```json
{
  "core": {
    "connectionString": "sqlite://.platformatic/data/<app-name>.db"
  }
}
```

Deploy the application to Fly by running:

```bash
fly deploy
```

<!-- TODO: This section probably should be moved to its own how-to guide  -->

## Adding `sqlite` for debugging

Create a script for launching the database, call it **db-cli.sh**:

```bash
#!/bin/sh
set -x
# DSN will be defined in the Dockerfile
sqlite3 $DSN
```

Add the following snippet to the **Dockerfile**:

```dockerfile
# Setup sqlite viewer
# Replace <app-name> with your app name
RUN apk add sqlite
ENV DSN "/opt/<app-name>/.platformatic/data/demo.db"
COPY db-cli.sh /usr/local/bin/db-cli
RUN chmod +x /usr/local/bin/db-cli
```

With Fly, it becomes straightforward to connect directly to the database by
running the following command from your local machine:

```bash
fly ssh console -C db-cli
```
