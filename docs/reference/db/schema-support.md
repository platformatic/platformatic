# Schema support

It's possible to specify the schemas where the tables are located (if the database supports schemas).
PlatformaticDB will inspect this schemas to create the entities 

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

The schemas must be specified in configuration in the `schema` section.
Note that if we use schemas and migrations, we must specify the schema in the migrations table as well 
(with postgresql, we assume we use the default `public` schema).

```json
  ...
  "db": {
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

The entities name are then generated in the form `schemaName + entityName`, PascalCase (this is necessary to avoid name collisions in case there are tables with same name in different schemas).
So for instance for the example above we generate the `Test1Movie` and `Test2User` entities.

:::info
***Please pay attention to the entity names when using schema, these are also used to setup authorization rules***
:::
