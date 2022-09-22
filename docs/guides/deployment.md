# Deployment

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

#### Adding Litestream and S3 for backups

This requires an AWS account and the appropriate setup in AWS. Follow the
[Litestream guide for configuring an AWS user](https://litestream.io/guides/s3/) and then come back here to
integrate with Platformatic and Fly.

Once AWS is setup, store the credentials on Fly:
```bash
fly secrets set \
  AWS_ACCESS_KEY_ID=some-access-key \
  AWS_SECRET_ACCESS_KEY=some-access-secret
```

Update **fly.toml** with the bucket name:
```toml
[env]
  AWS_BACKUP_BUCKET = "bucket-name"
```

Configuration of Litestream will be done through the standard yaml file, create
a **litestream.yml** file in the project with the following contents:
```yml
dbs:
  # make sure to replace <app-name>
  - path: /opt/<app-name>/.platformatic/data/<app-name>.db
    replicas:
      - url: s3://${AWS_BACKUP_BUCKET}
        access-key-id: ${AWS_ACCESS_KEY_ID}
        secret-access-key: ${AWS_SECRET_ACCESS_KEY}
```

To get automatic database replication and restoration, a small Bash script is
used as the **Dockerfile** `CMD`:
```bash
#!/bin/bash

if [ ! -f "$DSN" ]
then
    echo "Restoring database"
    litestream restore -v "$DSN"
fi

# TODO change <app-name>
echo "Starting Litestream & application"
litestream replicate -exec "platformatic db --config /opt/<app-name>/platformatic.db.json"
```

Finally, the existing Dockerfile needs a number of changes. Start with the
Litestream base image:

```dockerfile
FROM litestream/litestream:0.3.9 AS litestream

FROM registry.fly.io/platformatic-private:latest
```

Copy Litestream into the platformatic image:
```dockerfile
USER root
COPY --from=litestream /usr/local/bin/litestream /usr/local/bin/litestream
```

Copy the runner and configuration:
```dockerfile
COPY run.sh /run.sh
COPY litestream.yml /etc/litestream.yml
```

Last of all, run from **run.sh**:
```dockerfile
CMD /run.sh
```

With Litestream and the database tools, the final image should look something
like this:
```dockerfile
FROM litestream/litestream:0.3.9 AS litestream

FROM registry.fly.io/platformatic-private:latest

USER root
COPY --from=litestream /usr/local/bin/litestream /usr/local/bin/litestream

RUN apk add sqlite bash ca-certificates curl

# Set environment variables.
ENV DSN "/opt/<app-name>/.platformatic/data/<app-name>.db"
COPY image/db-cli /usr/local/bin/db-cli
RUN chmod +x /usr/local/bin/db-cli

EXPOSE 3042

ADD litestream.yml /etc/litestream.yml
ADD run.sh /run.sh

# Application specific files
WORKDIR /opt/<app-name>
COPY migrations migrations
COPY platformatic.db.json platformatic.db.json

CMD /run.sh
```
