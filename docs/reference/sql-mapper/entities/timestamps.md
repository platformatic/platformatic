# Timestamps

Timestamps can be used to automatically set the `created_at` and `updated_at` fields on your entities.

Timestamps are enabled by default, but can be disabled by setting the `autoTimestamps` option to `false` in configuration.

## Configuration

To enable timestamps, you need to set the `autoTimestamps` field to `true` in configuration file:

```json
{
...
  "core": {
    "connectionString": "postgres://postgres:postgres@127.0.0.1/postgres",
    "autoTimestamp": true
  },
...
}
```

## Customizing the field names

By default, the `created_at` and `updated_at` fields are used. You can customize the field names by setting the `createdAt` and `updatedAt` options in `autoTimestamp` field in configuration file:

```json
{
...
  "core": {
    "connectionString": "postgres://postgres:postgres@127.0.0.1/postgres",
    "autoTimestamp": {
      "createdAt": "inserted_at",
      "updatedAt": "updated_at"
    }
...
}
```
