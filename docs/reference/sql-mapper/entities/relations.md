# Relations

When Platformatic DB is reading your database schema, it identifies relationships
between tables and stores metadata on them in the entity object's `relations` field.
This is achieved by querying the database's internal metadata.

## Example

Given this PostgreSQL schema:

```sql
CREATE SEQUENCE IF NOT EXISTS categories_id_seq;

CREATE TABLE "categories" (
    "id" int4 NOT NULL DEFAULT nextval('categories_id_seq'::regclass),
    "name" varchar(255) NOT NULL,
    PRIMARY KEY ("id")
);

CREATE SEQUENCE IF NOT EXISTS pages_id_seq;

CREATE TABLE "pages" (
    "id" int4 NOT NULL DEFAULT nextval('pages_id_seq'::regclass),
    "title" varchar(255) NOT NULL,
    "body_content" text,
    "category_id" int4,
    PRIMARY KEY ("id")
);

ALTER TABLE "pages" ADD FOREIGN KEY ("category_id") REFERENCES "categories"("id");
```

When this code is run:

<!-- docs/reference/sql-mapper/examples/relations.js -->
```js
'use strict'
const { connect } = require('@platformatic/sql-mapper')
const { pino } = require('pino')
const pretty = require('pino-pretty')
const logger = pino(pretty())

async function main() {
  const pgConnectionString = 'postgres://postgres:postgres@127.0.0.1/postgres'
  const mapper = await connect({
    connectionString: pgConnectionString,
    log: logger,
  })
  const pageEntity = mapper.entities.page
  console.log(pageEntity.relations)
  await mapper.db.dispose()
}
main()
```

The output will be:

```javascript
[
  {
    constraint_catalog: 'postgres',
    constraint_schema: 'public',
    constraint_name: 'pages_category_id_fkey',
    table_catalog: 'postgres',
    table_schema: 'public',
    table_name: 'pages',
    constraint_type: 'FOREIGN KEY',
    is_deferrable: 'NO',
    initially_deferred: 'NO',
    enforced: 'YES',
    column_name: 'category_id',
    ordinal_position: 1,
    position_in_unique_constraint: 1,
    foreign_table_name: 'categories',
    foreign_column_name: 'id'
  }
]
```

As Platformatic DB supports multiple database engines, the contents of the
`relations` object will vary depending on the database being used.

The following `relations` fields are common to all database engines:

- `column_name` — the column that stores the foreign key
- `foreign_table_name` — the table hosting the related row
- `foreign_column_name` — the column in foreign table that identifies the row
