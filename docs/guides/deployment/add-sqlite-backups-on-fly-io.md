# Add SQLite Backups on Fly.io

This guide shows you how to configure SQLite backups on Fly.io with Litestream and S3.
It assumes you have followed the [Deploy to Fly.io](./deploy-to-fly-io.md) guide
first.

This guide requires an AWS account and the appropriate setup in AWS. Follow the
[Litestream guide for configuring an AWS user](https://litestream.io/guides/s3/)
and then come back here to integrate with Platformatic and Fly.

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

# TODO Change <app-name>
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

# Set environment variables
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
