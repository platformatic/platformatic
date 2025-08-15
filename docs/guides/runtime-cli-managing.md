# Managing runtimes with the CLI

Watt provides several commands to manage Platformatic Runtime applications.
You can stop, restart, and debug your applications in a local development environment.

## Enabling runtime management API

Before you can Watt to manage your runtime applications, you need to enable
the runtime management API in your application's configuration file. This will
allow the CLI to communicate with your application.

To enable the runtime management API, add the following configuration to your runtime
application's `platformatic.json` file:

```json
{
  "managementApi": true
}
```

## Installing

You can install Watt by running the following command:

```bash
npm install -g wattpm
```

### Listing running runtime applications

To list all running runtime applications, run the following command:

```bash
wattpm ps
```

This will display a list of all running runtime applications, including their PID,
npm package name, Platformatic version, running time, URL, and working directory.

```
PID    NAME        Version Uptime  URL                  Directory
38898  my-app-foo  1.23.0  1m 52s  http://0.0.0.0:3042  /Users/test-user/foo
38899  my-app-bar  1.23.0  4m 53s  http://0.0.0.0:3043  /Users/test-user/bar
```

### Stopping a running runtime application

To stop a running runtime application, run the following command:

```bash
wattpm stop [<PID> | <NAME>]
```

You can stop a running runtime application by specifying either its PID or its name.

### Restarting a running runtime application

To restart a running runtime application, run the following command:

```bash
wattpm restart [<PID> | <NAME>]
```

You can restart a running runtime application by specifying either its PID or its name.
Note that after restarting, the application parent process will be changed to the
current CLI process.

### Reloading a running runtime application

To reload a running runtime application, run the following command:

```bash
wattpm reload [<PID> | <NAME>]
```

The difference between `reload` and `restart` is that `reload` does not kill
the runtime process. It stops and starts all the runtime services. Some configurations will not be updated.

You can reload a running runtime application by specifying either its PID or its name.

### Displaying logs for a running runtime application

To display logs for a running runtime application, run the following command:

```bash
wattpm logs [<PID> | <NAME>]
```

You can display logs for a running runtime application by specifying either its PID or its name.

You can filter logs by specifying a log level or service name:

**Display logs for a specific service**

```bash
wattpm logs [<PID> | <NAME>] <SERVICE>
```

To see the list of services in a running runtime application, you can use the
`wattpm services` subcommand.

**Display logs for a specific log level**

```bash
wattpm logs [<PID> | <NAME>] -l <LEVEL>
```

Supported log levels are `trace`, `debug`, `info`, `warn`, `error`, and `fatal`.

### Listing environment variables for a running runtime application

To list environment variables for a running runtime application, run the following command:

```bash
wattpm env [<PID> | <NAME>]
```

You can list environment variables for a running runtime application by specifying either its PID or its name.

### Printing runtime config file

To print the runtime config file, run the following command:

```bash
wattpm config [<PID> | <NAME>]
```

To print the runtime service config file, run the following command:

```bash
wattpm config [<PID> | <NAME>] <SERVICE>
```

You can print the runtime config file for a running runtime application by specifying either its PID or its name.

### Injecting an HTTP request into a running runtime application

To inject an HTTP request into a running runtime application, run the following command:

```bash
wattpm inject [<PID> | <NAME>] [<SERVICE>] -m <method> -p <URL> -H <header> -d <data>
```

With the inject command you can make requests not only to endpoints that are exposed by the runtime, but also to internal endpoints
that are not exposed via the runtime entrypoint. To do so, you can append the service name before URL arguments.

**Example:**

```bash
wattpm inject my-app-foo my-service
  -m POST
  -H "Content-Type: application/json"
  -d '{"foo": "bar"}'
  -p /api/v1/foo
```

As you can see there is no need to specify a full URL, you can just specify the path of the endpoint you want to call.

### Listing services in a running runtime application

To list all services in a running runtime application, run the following command:

```bash
wattpm services [<PID> | <NAME>]
```

The list command shows all services that are currently running in the runtime application.

```
NAME      Workers   Type      Entrypoint
movies    1         db        no
payment   1         db        no
gateway   1         composer  yes
```

You can list all services in a running runtime application by specifying either its PID or its name.
