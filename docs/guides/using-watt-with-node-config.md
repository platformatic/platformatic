# How to Use Watt with Node Config

## Problem

You need sophisticated configuration management for your Watt application that:
- Organizes settings across multiple environments (dev, staging, production)
- Supports complex configuration hierarchies and inheritance
- Validates configuration values at startup
- Allows per-application configuration in multi-application applications

**When to use this solution:**
- Applications with complex configuration requirements
- Multi-environment deployments with different settings
- Team environments where configuration consistency is critical
- Applications requiring configuration validation and type safety

## Solution Overview

[Node-config](https://www.npmjs.com/package/config) provides hierarchical configuration management that works seamlessly with Watt. This guide shows you how to:
1. Set up node-config in your Watt application
2. Create environment-specific configurations
3. Configure individual applications with their own settings
4. Validate and access configuration values safely



## Installation and Setup

First, install `node-config` in the root of your Watt application:

```sh
npm install config
```

Create a `config` directory in your `application` folder and set up your default configuration for each application:

```sh
mkdir config
touch config/default.json
```

In `{application}/config/default.json`, add your base configuration:

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

In `{application}/config/dev.json`, override any default values:

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

## Application-Specific Configuration 

You can configure each [application](https://platformatic.dev/docs/service/overview) environment variables in your Watt configuration file:

```json
{
  "applications": [
    {
      "id": "application-a",
      "path": "./applications/application-a",
      "env": {
        "NODE_CONFIG_DIR": "./applications/application-a/config",
        "NODE_ENV": "development"
      }
    },
    {
      "id": "application-b",
      "path": "./applications/application-b",
      "env": {
        "NODE_CONFIG_DIR": "./applications/application-b/config",
        "NODE_ENV": "production"
      }
    }
  ]
}
```

Platformatic allows you to use `.env` files for managing environment variables, and you can remap one variable to another using its interpolation feature. For example, to remap `SERVICE_A_NODE_ENV` to `NODE_ENV`, create a `.env` file in the `application-a` directory:

1.  Set your application-specific environment variable: 

```sh
APPLICATION_A_NODE_ENV=development
```

2.  Use interpolation syntax `${VARIABLE_NAME}` in your Watt configuration to reference it:

```json
{
  "applications": [
    {
      "id": "application-a",
      "path": "./applications/application-a",
      "env": {
        "NODE_CONFIG_DIR": "./applications/application-a/config",
        "NODE_ENV": `${YOUR_SERVICE_NODE_ENV}`
      }
    }
  ]
}
```

You can alsp use this pattern with `env` file:

```env
APPLICATION_A_NODE_ENV=development
```

You can also specify environment files per Platformatic application:

```
{
  "applications": [
    {
      "id": "application-a",
      "path": "./applications/application-a",
      "envfile": "./applications/application-a/.env"
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

## Verification and Testing

### Test Configuration Loading

**1. Create a test script to verify configuration:**
```js
// test-config.js
import config from 'config'

console.log('Configuration loaded successfully:')
console.log('Environment:', process.env.NODE_ENV || 'default')
console.log('Server config:', config.get('server'))
console.log('Database config:', config.get('database'))

// Test configuration validation
try {
  const apiTimeout = config.get('api.timeout')
  if (apiTimeout < 1000) {
    console.warn('API timeout is very low:', apiTimeout)
  }
} catch (error) {
  console.error('Configuration error:', error.message)
}
```

**2. Test different environments:**
```bash
# Test default configuration
node test-config.js

# Test development environment
NODE_ENV=development node test-config.js

# Test production environment  
NODE_ENV=production node test-config.js
```

### Verify Service-Specific Configuration

**Test that each application loads its own configuration:**
```bash
# Start your Watt application
npm run dev

# Check application logs for configuration loading
# Each application should show its specific config values
```

## Troubleshooting

### Configuration Not Loading

**Problem:** Config values are undefined or using defaults

**Solutions:**
- Verify `NODE_CONFIG_DIR` points to correct directory
- Check configuration file naming (`default.json`, `development.json`, etc.)
- Ensure JSON syntax is valid
- Verify environment variable `NODE_ENV` is set correctly

### Service Configuration Conflicts

**Problem:** Services are using wrong configuration

**Solutions:**
- Check that each application has its own `NODE_CONFIG_DIR` environment variable
- Verify application-specific configuration files exist
- Ensure no configuration file naming conflicts
- Review application startup logs for configuration loading messages

### Environment Variable Issues

**Problem:** Environment variables not being interpolated

**Solutions:**
- Verify environment variables are set before starting application
- Check interpolation syntax: `${VARIABLE_NAME}`
- Ensure variables exist in current shell environment
- Test variable substitution with simple values first

## Next Steps

Now that you have sophisticated configuration management:

- **[Set up monitoring](/docs/guides/monitoring)** - Monitor configuration across environments
- **[Deploy with multiple environments](/docs/guides/deployment/)** - Production deployment patterns
- **[Add configuration validation](/docs/guides/validation/)** - Ensure configuration correctness
- **[Implement feature flags](/docs/guides/feature-flags/)** - Dynamic configuration management

## Additional Resources

- [Watt Setup Guide](/docs/getting-started/quick-start-watt) - Basic Watt application setup
- [Node-config Documentation](https://www.npmjs.com/package/config) - Complete configuration patterns and options
- [Environment Variables Guide](/docs/learn/beginner/environment-variables) - Basic environment variable usage with Watt