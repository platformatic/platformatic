import Issues from '../../getting-started/issues.md';

# Logging

Configures the `logger`, see the [runtime](../runtime/configuration.md#logger) documentation.

## Query Logging

Enable detailed query logging by setting the log level to `trace`. This is especially useful during development for monitoring the queries executed against the database:

```bash
[12:09:13.810] INFO (platformatic-db/9695): incoming request
[12:09:13.819] TRACE (platformatic-db/9695): query
  query: {
    "text": "SELECT \"id\", \"title\"\n FROM \"movies\"\nLIMIT ?"
  }
[12:09:13.820] INFO (platformatic-db/9695): request completed
  responseTime: 10.350167274475098
```

:::info
Note extensive logging, especially at the `trace` level, can impact performance and should be used judiciously in production environments.
:::

<Issues />
