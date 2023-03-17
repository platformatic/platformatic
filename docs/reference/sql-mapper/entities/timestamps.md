# Timestamps

Timestamps can be used to automatically set the `created_at` and `updated_at` fields on your entities.

Timestamps are enabled by default

## Configuration

To disable timestamps, you need to set the `autoTimestamp` field to `false` in configuration file:

```json
{
...
  "db": {
    "connectionString": "postgres://postgres:postgres@127.0.0.1/postgres",
    "autoTimestamp": false
  },
...
}
```

## Customizing the field names

By default, the `created_at` and `updated_at` fields are used. You can customize the field names by setting the `createdAt` and `updatedAt` options in `autoTimestamp` field in configuration file:

```json
{
...
  "db": {
    "connectionString": "postgres://postgres:postgres@127.0.0.1/postgres",
    "autoTimestamp": {
      "createdAt": "inserted_at",
      "updatedAt": "updated_at"
    }
...
}
```
