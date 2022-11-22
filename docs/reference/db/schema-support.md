# Schema support

It's possible to specify the schemas where the tables are located (if the database supports schemas).

```typescript

_Example_

```sql
CREATE SCHEMA IF NOT EXISTS "test1";
CREATE TABLE IF NOT EXISTS test1.movies (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL
);

CREATE SCHEMA IF NOT EXISTS "test2";
CREATE TABLE IF NOT EXISTS test2.users (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL
);
```

Schemas must be specified in configuration. These are then automatically set in the postgres `search path` for the connection (see [here](https://www.postgresql.org/docs/current/ddl-schemas.html#DDL-SCHEMAS-PATH) for more info).
Note that if we use schemas and migrations, we must specify the schema in the migrations table as well.

```json
  ...
  "core": {
    "connectionString": "(...)",
    "schema": [
      "test1", "test2"
    ],
    "ignore": {
      "versions": true
    }
  },
  "migrations": {
    "dir": "migrations",
    "table": "test1.versions"
  },

  ...
```

:::danger
If two tables with the same name are present in different schemas, an error is thrown.
Tables with the same name in different schema are not supported.
:::


