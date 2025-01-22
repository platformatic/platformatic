# Using Watt With Node Config

[Node-config](https://www.npmjs.com/package/config) is a popular configuration management package that helps organize settings across different deployment environments in your application. It creates a unified configuration system that works seamlessly with both [Watt](https://platformatic.dev/docs/watt/overview) and other `npm` modules.
When building a Watt application with multiple services, each service can maintain its own independent configuration using `node-config`. This allows different services to use different environment configurations as needed.



## Installation and Setup

First, install `node-config` in the root of your Watt application:

```sh
npm install config
```

Create a `config` directory in your `service` folder and set up your default configuration for each service:

```sh
mkdir config
touch config/default.json
```

In `{service}/config/default.json`, add your base configuration:

```sh
{
  "foo": "bar"
}
```

## Environment-specific configuration 

For development-specific settings, create a separate configuration file:

```sh
touch config/dev.json
```

In `{service}/config/dev.json`, override any default values:

```sh
{
  "foo": "baz"
}
```

## Configuration structure

Instead of using simple key-value pairs, consider organizing your configurations more systematically, below is an example:

```sh
{
  "server": {
    "port": 3000,
    "host": "localhost"
  },
  "api": {
    "endpoint": "http://api.example.com",
    "timeout": 5000
  },
  "database": {
    "url": "mongodb://localhost:27017",
    "name": "myapp"
  }
}
```

:::important
It's important to note that for a secure configuration, use your environment variables for your application  secrets and validate your configuration values when you run your application. 
:::

## Service-Specific Configuration 

You can configure each [service](https://platformatic.dev/docs/service/overview) environment variables in your Watt configuration file:

```json
{
  "services": [
    {
      "id": "service-a",
      "path": "./services/service-a",
      "env": {
        "NODE_CONFIG_DIR": "./services/service-a/config",
        "NODE_ENV": "development"
      }
    },
    {
      "id": "service-b",
      "path": "./services/service-b",
      "env": {
        "NODE_CONFIG_DIR": "./services/service-b/config",
        "NODE_ENV": "production"
      }
    }
  ]
}
```

Platformatic allows you to use `.env` files for managing environment variables, and you can remap one variable to another using its interpolation feature. For example, to remap `SERVICE_A_NODE_ENV` to `NODE_ENV`, create a `.env` file in the `service-a` directory:

1.  Set your service-specific environment variable: 

```sh
SERVICE_A_NODE_ENV=development
```

2.  Use interpolation syntax `${VARIABLE_NAME}` in your Watt configuration to reference it:

```json
{
  "services": [
    {
      "id": "service-a",
      "path": "./services/service-a",
      "env": {
        "NODE_CONFIG_DIR": "./services/service-a/config",
        "NODE_ENV": `${YOUR_SERVICE_NODE_ENV}`
      }
    }
  ]
}
```

You can alsp use this pattern with `env` file:

```env
SERVICE_A_NODE_ENV=development
```

You can also specify environment files per Platformatic service:

```
{
  "services": [
    {
      "id": "service-a",
      "path": "./services/service-a",
      "envfile": "./services/service-a/.env"
    }
  ]
}
```

## Using Configuration Values in Watt Application

Here's how to access your configuration values in a Watt application:

```sh
import { createServer } from 'http';
import config from 'config';

// Access configuration values using config.get()
const configValue = config.get('foo');

const server = createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
// Use configuration values in your application logic
  res.end(config.get('foo'));
});

server.listen(3000);
```

## Running Your Watt Application

When you start your application, `node-config` automatically loads the appropriate configuration based on your `NODE_ENV` environment variable. The values from `default.json` are merged with any environment-specific configurations.

For production mode:

```sh
npm start 
```

For development mode:

```sh
NODE_ENV=development npm start
```

## **Advanced Usage Tips**
`node-config` follows this loading order:

1. `default.json` (base configuration)
2. `{environment}.json` (environment-specific settings)
3. `local.json` (local overrides, should be git-ignored)
4. Environment variables
5. Command line arguments

### **Error Handling**

Always handle configuration access safely:

```sh
try {
  const value = config.get('foo');
} catch (error) {
  console.error('Missing required configuration:', error.message);
  process.exit(1);
}
```

### **Configuration Validation**

We recommend using schema validation libraries like [TypeBox](https://github.com/sinclairzx81/typebox), [Ajv](https://ajv.js.org/), or [Zod](https://zod.dev/) to validate Watt node configurations, ensuring both runtime validation and type safety for your configuration parameters.

## Additional Resources

- For more details on setting up a Watt application, see our [Watt setup guide](https://docs.platformatic.dev/docs/getting-started/quick-start-watt)
- Learn more about configuration patterns in the [node-config documentation](https://www.npmjs.com/package/config)