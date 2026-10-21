# Scheduled Jobs (Cron) in Platformatic Watt

Watt includes a built-in scheduler for running automated tasks at specified intervals using cron expressions.

---

## Basic Configuration

Add a `scheduler` array at the runtime root, or under `runtime` in a standalone
capability's `watt.json`. Jobs run in each runtime replica; use deliberate ownership
or idempotent handlers to prevent duplicate effects across replicas.

```json
{
  "scheduler": [
    {
      "name": "my-scheduled-job",
      "cron": "*/5 * * * *",
      "callbackUrl": "http://localhost:3042/api/task",
      "method": "GET"
    }
  ]
}
```

---

## Job Configuration Options

| Option | Type | Required | Default | Description |
|--------|------|----------|---------|-------------|
| `name` | String | Yes | - | Unique job identifier |
| `cron` | String | Yes | - | Cron expression for scheduling |
| `callbackUrl` | String | Yes | - | URL to invoke when job runs |
| `enabled` | Boolean | No | `true` | Set `false` to disable job |
| `method` | String | No | `GET` | HTTP method (GET, POST, PUT, DELETE) |
| `headers` | Object | No | - | Custom HTTP headers |
| `body` | String/Object | No | - | Request payload for POST/PUT |
| `maxRetries` | Number | No | `3` | Retry attempts on failure |

---

## Cron Expression Format

Standard cron format with optional seconds field:

```
┌────────────── second (0-59) [optional]
│ ┌──────────── minute (0-59)
│ │ ┌────────── hour (0-23)
│ │ │ ┌──────── day of month (1-31)
│ │ │ │ ┌────── month (1-12)
│ │ │ │ │ ┌──── day of week (0-7, 0 and 7 = Sunday)
│ │ │ │ │ │
* * * * * *
```

### Common Examples

| Expression | Description |
|------------|-------------|
| `*/1 * * * * *` | Every second |
| `0 */5 * * * *` | Every 5 minutes |
| `0 0 * * * *` | Every hour |
| `0 */30 * * * *` | Every 30 minutes |
| `0 0 12 * * *` | Daily at noon |
| `0 0 0 * * *` | Daily at midnight |
| `0 0 0 * * 1` | Every Monday at midnight |
| `0 0 9-17 * * 1-5` | Hourly 9am-5pm, weekdays |
| `0 0 0 1 * *` | First day of every month |

Use [crontab.guru](https://crontab.guru/) for help with expressions.

---

## Examples

### Simple Health Check

```json
{
  "scheduler": [
    {
      "name": "health-check",
      "cron": "*/5 * * * *",
      "callbackUrl": "http://api.plt.local/health",
      "method": "GET"
    }
  ]
}
```

### Send Notifications

```json
{
  "scheduler": [
    {
      "name": "send-daily-report",
      "cron": "0 0 9 * * *",
      "callbackUrl": "http://notification.plt.local/send-report",
      "method": "POST",
      "headers": {
        "Content-Type": "application/json"
      },
      "body": {
        "type": "daily-report",
        "recipients": ["team@example.com"]
      }
    }
  ]
}
```

### Database Cleanup

```json
{
  "scheduler": [
    {
      "name": "cleanup-old-sessions",
      "cron": "0 0 3 * * *",
      "callbackUrl": "http://db-api.plt.local/cleanup/sessions",
      "method": "DELETE",
      "headers": {
        "Authorization": "Bearer {INTERNAL_API_KEY}"
      },
      "maxRetries": 5
    }
  ]
}
```

### Multiple Jobs

```json
{
  "scheduler": [
    {
      "name": "sync-inventory",
      "cron": "0 */15 * * * *",
      "callbackUrl": "http://inventory.plt.local/sync",
      "method": "POST"
    },
    {
      "name": "generate-sitemap",
      "cron": "0 0 2 * * *",
      "callbackUrl": "http://seo.plt.local/generate-sitemap",
      "method": "POST"
    },
    {
      "name": "expire-tokens",
      "cron": "0 */10 * * * *",
      "callbackUrl": "http://auth.plt.local/expire-tokens",
      "method": "POST"
    }
  ]
}
```

### Disabled Job (for maintenance)

```json
{
  "scheduler": [
    {
      "name": "heavy-processing",
      "cron": "0 0 4 * * *",
      "callbackUrl": "http://worker.plt.local/process",
      "method": "POST",
      "enabled": false
    }
  ]
}
```

---

## Inter-Service Communication

Use Watt's internal mesh network to call other services:

```json
{
  "scheduler": [
    {
      "name": "trigger-api",
      "cron": "0 */5 * * * *",
      "callbackUrl": "http://api.plt.local/cron/task",
      "method": "POST"
    }
  ]
}
```

Internal hostnames follow the pattern: `http://{service-id}.plt.local`

---

## Handling Scheduled Requests

Create an endpoint in your service to handle the scheduled call:

### Express

```javascript
app.post('/cron/daily-task', async (req, res) => {
  try {
    await performDailyTask()
    res.json({ success: true })
  } catch (error) {
    console.error('Daily task failed:', error)
    res.status(500).json({ error: error.message })
  }
})
```

### Fastify

```javascript
fastify.post('/cron/daily-task', async (request, reply) => {
  await performDailyTask()
  return { success: true }
})
```

---

## Error Handling

- Jobs retry up to `maxRetries` times on failure (default: 3)
- Non-2xx responses are treated as failures
- Network errors trigger retries
- Logs show job execution status

---

## Important Notes

1. **In-memory only**: Scheduler state does not persist between restarts. Missed jobs during downtime are not recovered.

2. **Single instance**: In clustered deployments, ensure only one instance runs scheduled jobs to avoid duplicates.

3. **Idempotency**: Design job handlers to be idempotent (safe to run multiple times).

4. **Timeouts**: For long-running work, acknowledge only after durable enqueueing.
   Fire-and-forget work can be lost when the application stops.

5. **Monitoring**: Log job completions and failures for observability.

---

## Best Practices

1. **Use descriptive names**: Make job names clear and searchable
2. **Start with longer intervals**: Test with less frequent runs first
3. **Add authentication**: Use headers for internal API keys
4. **Handle failures gracefully**: Return proper error codes
5. **Log everything**: Track when jobs run and their results
6. **Use internal URLs**: Prefer `*.plt.local` for inter-service calls

---

## Resources

- [Platformatic Scheduler Guide](https://docs.platformatic.dev/docs/guides/scheduler)
- [Crontab Guru](https://crontab.guru/) - Cron expression helper
