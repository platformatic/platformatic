# Learning Environment Variables with Watt

**What you'll learn:** How to configure your Watt applications using environment variables for different deployment environments, following the twelve-factor app methodology.

**By the end of this tutorial, you'll be able to:**

- Configure Watt applications using environment variables
- Use `.env` files for local development
- Set up different configurations for development, staging, and production
- Understand when and why to use environment variables for configuration

**Time to complete:** 15 minutes

## Why Environment Variables Matter

Applications built with Watt follow [the twelve-factor app methodology](https://12factor.net/), which recommends storing configuration in environment variables. This approach:

- **Separates configuration from code** - keeping sensitive data out of your repository
- **Enables different environments** - development, staging, production with different settings
- **Improves security** - database passwords and API keys aren't hardcoded
- **Simplifies deployment** - same code runs everywhere with different configuration

## Step 1: Understanding Variable Replacement

In any Watt configuration file, you can interpolate environment variables using curly braces:

```json
{
  "server": {
    "port": "{PORT}",
    "hostname": "{HOSTNAME}"
  },
  "runtime": {
    "logger": {
      "level": "{LOG_LEVEL}"
    }
  }
}
```

**How it works:**

- The replacement happens after JSON parsing
- All Watt configuration files support this syntax
- Variables are resolved at startup time

## Step 2: Using .env Files for Local Development

Watt has built-in [`dotenv`](http://npm.im/dotenv) support, automatically loading environment variables from `.env` files.

Create a `.env` file in your project root:

```plaintext title=".env"
PORT=3042
HOSTNAME=localhost
LOG_LEVEL=info
DATABASE_URL=sqlite://./dev.db
```

**Where to place .env files:**

- Same folder as your Watt configuration file
- Or in the current working directory
- Watt automatically finds and loads them

## Step 3: Setting Variables from Command Line

You can override environment variables directly when starting your application:

```bash
PORT=4042 LOG_LEVEL=debug npx wattpm dev
```

**This is useful for:**

- Quick testing with different values
- CI/CD pipeline overrides
- One-off debugging sessions

## Step 4: Environment-Specific Configuration

Create different `.env` files for different environments:

```plaintext title=".env.development"
PORT=3042
LOG_LEVEL=debug
DATABASE_URL=sqlite://./dev.db
```

```plaintext title=".env.production"
PORT=3000
LOG_LEVEL=warn
DATABASE_URL=postgresql://user:pass@prod-db:5432/myapp
```

**Load specific environments:**

```bash
# Development
NODE_ENV=development npx wattpm start

# Production
NODE_ENV=production npx wattpm start
```

## Step 5: Common Configuration Patterns

### Database Configuration

```json
{
  "db": {
    "connectionString": "{DATABASE_URL}",
    "pool": {
      "max": "{DB_POOL_SIZE}"
    }
  }
}
```

```plaintext title=".env"
DATABASE_URL=postgresql://localhost:5432/myapp
DB_POOL_SIZE=10
```

### Application Configuration

```json
{
  "server": {
    "port": "{PORT}",
    "hostname": "{HOSTNAME}"
  },
  "cors": {
    "origin": "{CORS_ORIGIN}"
  }
}
```

```plaintext title=".env"
PORT=3042
HOSTNAME=0.0.0.0
CORS_ORIGIN=http://localhost:3000
```

## Success Criteria

**You've successfully learned environment variables when you can:**

✅ Replace hardcoded values in configuration files with environment variables  
✅ Create and use `.env` files for local development  
✅ Set up different configurations for different environments  
✅ Override variables from the command line  
✅ Understand why this approach improves security and deployment flexibility

## What's Next?

Now that you understand environment variables, you might want to:

- **[Learn database configuration](/docs/guides/databases/)** - Apply environment variables to database setup
- **[Explore deployment guides](/docs/guides/deployment/)** - Use environment variables in production
- **[Build a full application](/docs/learn/beginner/crud-application)** - Practice with a complete example

## Troubleshooting

**Variable not being replaced?**

- Check curly brace syntax: `{VARIABLE_NAME}` not `${VARIABLE_NAME}`
- Ensure the variable is set: `echo $VARIABLE_NAME`
- Verify `.env` file location (same folder as config file)

**Environment-specific file not loading?**

- Check `NODE_ENV` value: `echo $NODE_ENV`
- Ensure file naming: `.env.development`, `.env.production`
- Remember: command line variables override `.env` files
