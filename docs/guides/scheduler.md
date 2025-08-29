# Scheduler

This guide explains how to configure and use Platformatic's built-in scheduler.
The scheduler allows you to run periodic tasks by making HTTP requests at scheduled intervals
using cron expressions. Note that the scheduler is in-memory only, so no information is
persisted between restarts.

## Overview

The Platformatic scheduler enables you to configure automated HTTP requests that run according
to a specified schedule. This feature is useful for:

- Periodic data synchronization
- Scheduled maintenance tasks
- Recurring API calls
- Implementing workflows that need to run at specific times

## Configuration

The scheduler is configured using an array of job definitions in your Platformatic configuration file.

Here's a basic example:

```json
//...
  "scheduler": [
    {
      "name": "my-scheduled-job",
      "cron": "*/5 * * * *",
      "callbackUrl": "http://localhost:3042/my-endpoint",
      "method": "GET"
    }
  ]

//...
```

## Job Configuration Options

Each job in the scheduler can include the following options:

| Option        | Type            | Required                | Description                                         |
| ------------- | --------------- | ----------------------- | --------------------------------------------------- |
| `name`        | String          | Yes                     | A unique identifier for the job                     |
| `cron`        | String          | Yes                     | A cron expression defining the schedule             |
| `callbackUrl` | String          | Yes                     | The URL to call when the job is triggered           |
| `enabled`     | Boolean         | No (defaults to `true`) | If `false`, the job is disabled.                    |
| `method`      | String          | No (defaults to 'GET')  | HTTP method to use (`GET`, `POST`, `PUT`, `DELETE`) |
| `headers`     | Object          | No                      | HTTP headers to include in the request              |
| `body`        | String / Object | No                      | Request body (for POST/PUT requests)                |
| `maxRetries`  | Number          | No (defaults to 3)      | Number of retries attempts                          |

## Cron Expression Format

The scheduler uses standard cron expressions with an optional seconds field.
Examples:

- `*/1 * * * * *` - Every second
- `0 */5 * * * *` - Every 5 minutes
- `0 0 * * * *` - Every hour
- `0 0 12 * * *` - Every day at noon
- `0 0 0 * * 1` - Every Monday at midnight

See [crontab.guru](https://crontab.guru/) for more examples.

## Example: call application in the mesh network

It is possible (and useful) to call also applications in the platformatic mesh network.
Here's an example configuring a job that sends a POST request every minute to an
internal `notification` application (so exposed as `http://notification.plt.local` in the mesh network).

```json
//...
  "scheduler": [
      {
        "name": "send-message",
        "cron": "0 */1 * * * *",
        "callbackUrl": "http://notification.plt.local/message",
        "method": "POST",
        "headers": {
          "content-type": "application/json",
        },
        "body": {
          "message": "Scheduled notification",
          "type": "info"
        }
      }
    ]
  //..
```
