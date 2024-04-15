# Example

Given this PostgreSQL SQL schema:

```sql
CREATE TABLE "categories" (
    "id" int4 NOT NULL DEFAULT nextval('categories_id_seq'::regclass),
    "name" varchar(255) NOT NULL,
    PRIMARY KEY ("id")
);

CREATE TABLE "pages" (
    "id" int4 NOT NULL DEFAULT nextval('pages_id_seq'::regclass),
    "title" varchar(255) NOT NULL,
    "category_id" int4,
    "user_id" int4,
    PRIMARY KEY ("id")
);

ALTER TABLE "pages" ADD FOREIGN KEY ("category_id") REFERENCES "categories"("id");
```

`app.platformatic.entities` will contain this mapping object:

```json
{
    "category": {
        "name": "Category",
        "singularName": "category",
        "pluralName": "categories",
        "primaryKey": "id",
        "table": "categories",
        "fields": {
            "id": {
                "sqlType": "int4",
                "isNullable": false,
                "primaryKey": true,
                "camelcase": "id"
            },
            "name": {
                "sqlType": "varchar",
                "isNullable": false,
                "camelcase": "name"
            }
        },
        "camelCasedFields": {
            "id": {
                "sqlType": "int4",
                "isNullable": false,
                "primaryKey": true,
                "camelcase": "id"
            },
            "name": {
                "sqlType": "varchar",
                "isNullable": false,
                "camelcase": "name"
            }
        },
        "relations": [],
        "reverseRelationships": [
            {
                "sourceEntity": "Page",
                "relation": {
                    "constraint_catalog": "postgres",
                    "constraint_schema": "public",
                    "constraint_name": "pages_category_id_fkey",
                    "table_catalog": "postgres",
                    "table_schema": "public",
                    "table_name": "pages",
                    "constraint_type": "FOREIGN KEY",
                    "is_deferrable": "NO",
                    "initially_deferred": "NO",
                    "enforced": "YES",
                    "column_name": "category_id",
                    "ordinal_position": 1,
                    "position_in_unique_constraint": 1,
                    "foreign_table_name": "categories",
                    "foreign_column_name": "id"
                }
            }
        ]
    },
    "page": {
        "name": "Page",
        "singularName": "page",
        "pluralName": "pages",
        "primaryKey": "id",
        "table": "pages",
        "fields": {
            "id": {
                "sqlType": "int4",
                "isNullable": false,
                "primaryKey": true,
                "camelcase": "id"
            },
            "title": {
                "sqlType": "varchar",
                "isNullable": false,
                "camelcase": "title"
            },
            "category_id": {
                "sqlType": "int4",
                "isNullable": true,
                "foreignKey": true,
                "camelcase": "categoryId"
            },
            "user_id": {
                "sqlType": "int4",
                "isNullable": true,
                "camelcase": "userId"
            }
        },
        "camelCasedFields": {
            "id": {
                "sqlType": "int4",
                "isNullable": false,
                "primaryKey": true,
                "camelcase": "id"
            },
            "title": {
                "sqlType": "varchar",
                "isNullable": false,
                "camelcase": "title"
            },
            "categoryId": {
                "sqlType": "int4",
                "isNullable": true,
                "foreignKey": true,
                "camelcase": "categoryId"
            },
            "userId": {
                "sqlType": "int4",
                "isNullable": true,
                "camelcase": "userId"
            }
        },
        "relations": [
            {
                "constraint_catalog": "postgres",
                "constraint_schema": "public",
                "constraint_name": "pages_category_id_fkey",
                "table_catalog": "postgres",
                "table_schema": "public",
                "table_name": "pages",
                "constraint_type": "FOREIGN KEY",
                "is_deferrable": "NO",
                "initially_deferred": "NO",
                "enforced": "YES",
                "column_name": "category_id",
                "ordinal_position": 1,
                "position_in_unique_constraint": 1,
                "foreign_table_name": "categories",
                "foreign_column_name": "id"
            }
        ],
        "reverseRelationships": []
    }
}
```

