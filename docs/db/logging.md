import Issues from '../getting-started/issues.md';

# Logging

Platformatic DB uses a low overhead logger named [Pino](https://github.com/pinojs/pino)
to output structured log messages, which are efficient and easy to parse both programmatically and visually.

## Logger output level

The default logging level is set to `info`. This means that all log messages from `info` level and above (`warn`, `error`, `fatal`) will be displayed. To override the logger output, add a `logger` object in the `server` configuration settings:

```json title="platformatic.json"
{
  "server": {
    "logger": {
      "level": "error"
    },
   ...
  },
  ...
}
```

For a full list of log levels and their meanings, see the [Pino documentation](https://github.com/pinojs/pino/blob/main/docs/api.md#level-string).


## Log formatting

Logs are automatically pretty-printed by [pino-pretty](https://github.com/pinojs/pino-pretty) to improve readability when running Platformatic DB in a terminal environment where standard out [stdout](https://en.wikipedia.org/wiki/Standard_streams#Standard_output_(stdout)) supports [TTY](https://en.wikipedia.org/wiki/Tty_(Unix))

```bash
$ npx platformatic db start
[11:20:33.466] INFO (337606): server listening
  url: "http://127.0.0.1:3042"
```

In non-TTY environments, such as when logs are redirected to a file or a log management system, logs are formatted as newline-delimited JSON for easier parsing:

```bash
$ npx platformatic db start | head
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
