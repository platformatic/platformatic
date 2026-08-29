# Learning Environment Variables with Watt

**What you'll learn:** How to configure your Watt applications using environment variables for different deployment environments, following the twelve-factor app methodology.

**By the end of this tutorial, you'll be able to:**

- Read environment variables from a Watt configuration file
- Use `.env` files for local development
- Set up different configurations for development, staging, and production
- Decide, per setting, what happens when a variable is not set

**Time to complete:** 15 minutes

## Why Environment Variables Matter

Applications built with Watt follow [the twelve-factor app methodology](https://12factor.net/), which recommends storing configuration in environment variables. This approach:

- **Separates configuration from code** - keeping sensitive data out of your repository
- **Enables different environments** - development, staging, production with different settings
- **Improves security** - database passwords and API keys aren't hardcoded
- **Simplifies deployment** - same code runs everywhere with different configuration

## Step 1: Reading a variable

A Watt configuration file is a module, so it reads `process.env` the way any other module does:

```ts config
import { defineConfig } from 'wattpm'
import { node } from '@platformatic/node'

export default defineConfig({
  logger: { level: 'info' },
  application: {
    config: node({
      server: {
        port: Number(process.env.PORT ?? 3042),
        hostname: process.env.HOSTNAME ?? '127.0.0.1'
      }
    })
  }
})
```

**How it works:**

- The file is evaluated when Watt starts, with `.env` already loaded
- Every setting is an ordinary expression, so the fallback is written where the value is
- A setting that wants a number gets a number — `port` is `Number(...)`, not the string the environment holds

:::note
Earlier versions interpolated `{PORT}` placeholders into JSON configuration files. There are no
placeholders in Watt 4: the file reads the variable itself. See
[Migrating a v3 runtime](../../guides/migrate-runtime-v4.md).
:::

## Step 2: Using .env Files for Local Development

Watt loads `.env` files before evaluating the configuration file.

Create a `.env` file in your project root:

```plaintext title=".env"
PORT=3042
HOSTNAME=localhost
LOG_LEVEL=info
DATABASE_URL=sqlite://./dev.db
```

**Where Watt looks:** every directory from the configuration file's own up to the project root
contributes its `.env`, nearest first. An application under `web/api` therefore sees its own `.env`
layered over the project's, without naming either.

**What wins:** a variable already set in the real environment outranks every file. Exporting
`PORT=4042` in your shell beats any `.env`.

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

Each directory contributes four files rather than one, most specific first:

1. `.env.<mode>.local`
2. `.env.<mode>`
3. `.env.local`
4. `.env`

The mode is `development` under `wattpm dev` and `production` under `wattpm start`, and `--mode`
overrides it. So these files are read automatically, with no flag:

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

The `.local` variants are for values that stay on your machine — add them to `.gitignore`.

To read one specific file and nothing else, pass `--env`:

```bash
npx wattpm start --env .env.staging
```

`--env` replaces the whole set: no directory contributes, and a missing file is an error rather than
a silent skip.

## Step 5: Common Configuration Patterns

### Database Configuration

```ts config
import { db } from '@platformatic/db'

export default db({
  db: {
    connectionString: process.env.DATABASE_URL ?? 'sqlite://./dev.db',
    poolSize: Number(process.env.DB_POOL_SIZE ?? 10)
  }
})
```

```plaintext title=".env"
DATABASE_URL=postgresql://localhost:5432/myapp
DB_POOL_SIZE=10
```

### Requiring a variable

A default is a choice, not an obligation. Where a missing value should stop the boot, say so:

```ts config env=DATABASE_URL=postgres://localhost:5432/myapp
import { db } from '@platformatic/db'

function requiredEnv (name: string): string {
  const value = process.env[name]

  if (!value) {
    throw new Error(`${name} is required but is not set`)
  }

  return value
}

export default db({
  db: {
    connectionString: requiredEnv('DATABASE_URL')
  }
})
```

The error names the variable and appears before anything starts.

## Success Criteria

**You've successfully learned environment variables when you can:**

✅ Read configuration values from `process.env` in a configuration file  
✅ Create and use `.env` files for local development  
✅ Set up different configurations for different environments  
✅ Override variables from the command line  
✅ Decide, per setting, whether a missing variable defaults or fails

## What's Next?

Now that you understand environment variables, you might want to:

- **[Learn database configuration](/docs/reference/db/overview)** - Apply environment variables to database setup
- **[Explore deployment guides](/docs/guides/deployment/dockerize-a-watt-app)** - Use environment variables in production
- **[Build a full application](/docs/learn/beginner/crud-application)** - Practice with a complete example

## Troubleshooting

**Value not what you expected?**

- Remember the real environment outranks every `.env` file: check `echo $VARIABLE_NAME`
- Check which file you edited — the nearest directory's `.env` wins over the project root's
- `undefined` reaches a setting when nothing sets the variable; the `??` beside it is what decides

**Environment-specific file not loading?**

- `.env.development` is read under `wattpm dev` and `.env.production` under `wattpm start`; use `--mode` to pick another
- With `--env`, only that file is read — the rest are ignored on purpose
- Verify the file exists: `ls -la .env.production`
