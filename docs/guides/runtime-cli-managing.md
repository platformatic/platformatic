# Managing runtimes with the CLI

The `@plaformatic/control` npm package provides a CLI tool to manage Platformatic Runtime applications.
With the CLI, you can stop, restart, and debug your applications in a local development environment.

## Enabling runtime management API

Before you can use the CLI to manage your runtime applications, you need to enable
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

You can use the CLI via the `platformatic` command with a `ctl` subcommand or 
by using the `@platformatic/control` npm package directly. To install the package
globally, run the following command:

```bash
npm install -g @platformatic/control
```

In the following sections, we'll use the `platformatic` command to manage runtime applications.

## Platformatic Control commands

To see a list of available commands, run the following command:

```bash
platformatic ctl
```

Here are the available commands for managing runtime applications:

- `ps` - Lists all running runtime applications.
- `stop` - Stops a running runtime application.
- `restart` - Restarts a running runtime application.
- `reload` - Reloads a running runtime application.
- `logs` - Displays logs for a running runtime application.
- `env` - Lists environment variables for a running runtime application.
- `config` - Prints runtime or runtime service config file.
- `inject` - Injects an HTTP request into a running runtime application.
- `services` - Lists all services in a running runtime application.

### Listing running runtime applications

To list all running runtime applications, run the following command:

```bash
platformatic ctl ps
```

This will display a list of all running runtime applications, including their PID,
npm package name, Platformatic version, running time, URL, and working directory.

```
 PID    NAME        PLT     TIME    URL                  PWD                                  
 38898  my-app-foo  1.23.0  1m 52s  http://0.0.0.0:3042  /Users/test-user/foo
 38899  my-app-bar  1.23.0  4m 53s  http://0.0.0.0:3043  /Users/test-user/bar
 ```

### Stopping a running runtime application

To stop a running runtime application, run the following command:

```bash
platformatic ctl stop [-p <PID> | -n <NAME>]
```

You can stop a running runtime application by specifying either its PID or its name.

### Restarting a running runtime application

To restart a running runtime application, run the following command:

```bash
platformatic ctl restart [-p <PID> | -n <NAME>]
```

You can restart a running runtime application by specifying either its PID or its name.
Note that after restarting, the application parent process will be changed to the
current CLI process.


### Reloading a running runtime application

To reload a running runtime application, run the following command:

```bash
platformatic ctl reload [-p <PID> | -n <NAME>]
```

The difference between `reload` and `restart` is that `reload` does not kill
the runtime process. It stops and starts all the runtime services. Some configurations will not be updated.

You can reload a running runtime application by specifying either its PID or its name.

### Displaying logs for a running runtime application

To display logs for a running runtime application, run the following command:

```bash
platformatic ctl logs [-p <PID> | -n <NAME>]
```

You can display logs for a running runtime application by specifying either its PID or its name.

You can filter logs by specifying a log level or service name:

__Display logs for a specific service__

```bash
platformatic ctl logs [-p <PID> | -n <NAME>] -s <service-name>
```

To see the list of services in a running runtime application, you can use the
`platformatic ctl services` subcommand.

__Display logs for a specific log level__

```bash
platformatic ctl logs [-p <PID> | -n <NAME>] -l <log-level>
```

Supported log levels are `trace`, `debug`, `info`, `warn`, `error`, and `fatal`.

### Listing environment variables for a running runtime application

To list environment variables for a running runtime application, run the following command:

```bash
platformatic ctl env [-p <PID> | -n <NAME>]
```

You can list environment variables for a running runtime application by specifying either its PID or its name.

### Printing runtime config file

To print the runtime config file, run the following command:

```bash
platformatic ctl config [-p <PID> | -n <NAME>]
```

To print the runtime service config file, run the following command:

```bash
platformatic ctl config [-p <PID> | -n <NAME>] -s <service-name>
```

You can print the runtime config file for a running runtime application by specifying either its PID or its name.

### Injecting an HTTP request into a running runtime application

To inject an HTTP request into a running runtime application, run the following command:

```bash
platformatic ctl inject [-p <PID> | -n <NAME>] -X <method> -H <header> -d <data> <url>
```

The `platformatic ctl inject` command is designed is a way to be compatible with the `curl` command.
Although it doesn't support all `curl` options, it supports the most common ones.

With the inject command you can make requests not only to endpoints that are exposed by the runtime, but also to internal endpoints
that are not exposed via the runtime entrypoint. To do so, you can use the `-s` option to specify the service name.

__Example:__

```bash
platformatic ctl inject -n my-app-foo -s my-service
  -X POST
  -H "Content-Type: application/json"
  -d '{"foo": "bar"}'
  /api/v1/foo
```

As you can see there is no need to specify a full URL, you can just specify the path of the endpoint you want to call.

### Listing services in a running runtime application

To list all services in a running runtime application, run the following command:

```bash
platformatic ctl services [-p <PID> | -n <NAME>]
```

The list command shows all services that are currently running in the runtime application.

```
 NAME      TYPE      ENTRYPOINT        
 movies    db        no         
 payment   db        no         
 gateway   composer  yes
```

You can list all services in a running runtime application by specifying either its PID or its name.
