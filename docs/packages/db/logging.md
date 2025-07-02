import Issues from '../../getting-started/issues.md';

# Logging

Configures the `logger`, see the [runtime](../../runtime/configuration.md#logger) documentation.

## Log formatting

Logs are automatically pretty-printed by [pino-pretty](https://github.com/pinojs/pino-pretty) to improve readability when running Platformatic DB in a terminal environment where standard out [stdout](https://en.wikipedia.org/wiki/Standard_streams#Standard_output_(stdout)) supports [TTY](https://en.wikipedia.org/wiki/Tty_(Unix))

```bash
[11:20:33.466] INFO (337606): server listening
  url: "http://127.0.0.1:3042"
```

In non-TTY environments, such as when logs are redirected to a file or a log management system, logs are formatted as newline-delimited JSON for easier parsing:

```bash
{"level":30,"time":1665566628973,"pid":338365,"hostname":"darkav2","url":"http://127.0.0.1:3042","msg":"server listening"}
```

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
