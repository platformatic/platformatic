# Using Environment Variables with Platformatic

Applications built with Platformatic loosely follows [the twelve factor app methodology](https://12factor.net/).
This guide will show how to make your application [configurable](https://12factor.net/config), while
keeping your deployment environments as close as possible.

## Environment Variables replacement

In any Platformatic configuration file, you can always interpolate an environment variable inside a value:

```json
{
  ...
  "server": {
    "port": "{PORT}"
  }
  ...
}
```

The replacement is done via [`pupa`](http://npm.im/pupa), after the JSON file is parsed.

All Platformatic configuration files support Environment Variables replacement.

### dotenv support

[`dotenv`](http://npm.im/dotenv) is built in inside Platformatic, allowing you to create an envfile with
all your environment variables, that is loaded automatically by Platformatic at startup.
If a `.env` file exists it will automatically be loaded by Platformatic using
[`dotenv`](https://github.com/motdotla/dotenv). For example:

```plaintext title=".env"
PORT=3000
```

The `.env` file must be located in the same folder as the Platformatic configuration
file or in the current working directory.

Environment variables can also be set directly on the command line, for example:

```bash
PORT=4042 npx wattpm start
```
