# Deploy to Fly.io

Requirements:

1. Dockerfile with access to `platformatic` CLI
2. A fly.io account
3. A platformatic app that works locally

## On Fly.io

1. Need a fly.io account and the CLI tool: https://fly.io/docs/hands-on/
2. Navigate to your project on your local machine
1. Create a **Dockerfile**:
    ```dockerfile
    FROM platformatic/platformatic:latest

    USER root

    WORKDIR /opt/<app-name>
    COPY migrations migrations
    COPY platformatic.db.json platformatic.db.json

    EXPOSE 3042

    CMD ["platformatic", "db"]
    ```
1. Create an app on fly: `fly launch --no-deploy --generate-name --org personal --region mad`
    * or just `fly launch` and follow the prompts
    * if there is no database at this point, `--no-deploy` can be removed
4. Expose the correct port, matching **platformatic.db.json** and **Dockerfile**:
    ```diff
    [[services]]
      http_checks = []
    - internal_port = 8080
    + internal_port = 3042
      processes = ["app"]
      protocol = "tcp"
      script_checks = []
    ```
9. Now deploy: `fly deploy`

### With sqlite

1. Follow steps above, skipping deployment until the end
2. Create a volume for database storage: `fly volumes create data`
    * will create storage in the same region as application
    * defaults to 3GB size, use `-s` to change: `-s 10` is 10GB
3. Update mount in **fly.toml**, replacing `<app-name>`:
    ```toml
    [mounts]
      source = "data"
      destination = "/opt/<app-name>/.platformatic/data"
    ```
4. Create directory in project, this will be where the sqlite database goes:
    ```bash
    mkdir -p .platformatic/data
    touch .platformatic/data/.gitkeep
    ```
5. Make sure sqlite databases are ignored to avoid inconsistencies in
   deployment:
    ```bash
    echo "*.db" >> .gitignore
    ```
6. Update connection string to the sqlite database, replacing `<app-name>`:
    ```json
    {
      "core": {
        "connectionString": "sqlite://.platformatic/data/<app-name>.db"
      }
    }
    ```
7. Add migrations folder, migrations, and configuration. _Note_ app will not run
   if there is a migrations folder and no migrations.
    1. Create folder and simple migration if not already available:
        ```bash
        mkdir migrations
        echo "CREATE TABLE demo (id uuid PRIMARY KEY);" > migrations/001.do.sql
        ```
    2. Update configuration:
        ```json
        {
          "migrations": {
            "dir": "./migrations"
          }
        }
        ```
8. Optionally, [add `sqlite` to the **Dockerfile** to help with debugging](#adding-sqlite-for-debugging)
10. Deploy the app `fly deploy`

#### Adding `sqlite` for debugging

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

With fly.io, it becomes easy to boot directly into the database by running the
following command from the local machine:

```bash
fly ssh console -C db-cli
```
