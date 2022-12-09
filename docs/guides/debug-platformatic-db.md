# Debug Platformatic DB

## Error: No tables found in the database

- Verify your database connection string is correct in your Platformatic DB configuration
  - Make sure the database name is correct
- Ensure that you have run the migration command `npx platformatic db migrations apply` before starting the server. See the Platformatic DB [Migrations](https://oss.platformatic.dev/docs/reference/db/migrations) documentation for more information on working with migrations.

## Logging SQL queries

You can see all the queries that are being run against your database in your terminal by setting the logger level to trace in your `platformatic.db.json` config file:

```json title="platformatic.db.json"
{
  "server": {
    "logger": {
      "level": "trace"
    }
  }
}
```
