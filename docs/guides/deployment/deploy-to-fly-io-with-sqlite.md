# Deploy a Multi-Service Watt Application to Fly.io

In this section, you will deploy a Platformatic Watt application with multiple services to Fly.io. It's important to note that you need to [dockerize your Platformatic application](./dockerize-a-watt-app.md) before deploying it to Fly.io.

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

Check out the demo application with multiple services deployed on Fly.io [here](https://github.com/platformatic/Watt-examples/blob/main/watt-movie-quotes).