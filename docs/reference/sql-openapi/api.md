# API

Each table is mapped to an `entity` named after table's name. 

In the following reference we'll use some placeholders, but let's see an example

_Example_

Given this SQL executed against your database:

```sql
CREATE TABLE pages (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  body TEXT NOT NULL
);
```

- `[PLURAL_ENTITY_NAME]` is `pages`
- `[SINGULAR_ENTITY_NAME]` is `page`
- `[PRIMARY_KEY]` is `id`
- `fields` are `id`, `title`, `body`

## GET and POST parameters

Some APIs needs the `GET` method, where parameters must be defined in the URL, or `POST/PUT` methods, where parameters can be defined in the http request payload.

## Fields

Every API can define a `fields` parameter, representing the entity fields you want to get back for each row of the table. If not specified all fields are returned.


`fields` parameter are always sent in query string, even for `POST`, `PUT` and `DELETE` requests, as a comma separated value.

<a name="plural"></a>
## `GET /[PLURAL_ENTITY_NAME]`

Return all entities matching `where` clause

### Where clause

You can define many `WHERE` clauses in REST API, each clause includes a **field**, an **operator** and a **value**.

The **field** is one of the fields found in the schema.

The **operator** follows this table:

| Platformatic operator | SQL operator |
|--- | ---|
| eq | `'='` |
| in | `'IN'` |
| nin | `'NOT IN'` |
| neq | `'<>'` |
| gt | `'>'` |
| gte | `'>='` |
| lt | `'<'` |
| lte | `'<='` |

The **value** is the value you want to compare the field to.

For GET requests all these clauses are specified in the query string using the format `where.[FIELD].[OPERATOR]=[VALUE]`

_Example_

If you want to get the `title` and the `body` of every `page` where `id < 15` you can make an HTTP request like this:

```bash
$ curl -X 'GET' \
  'http://localhost:3042/pages/?fields=body,title&where.id.lt=15' \
  -H 'accept: application/json'
```

## OrderBy clause

You can define the ordering of the returned rows within your REST API calls with the `orderby` clause using the following pattern:

`?orderby.[field]=[asc | desc]`

The **field** is one of the fields found in the schema.
The **value** can be `asc` or `desc`.

_Example_

If you want to get the `pages` ordered alphabetically by their `titles` you can make an HTTP request like this:

```bash
$ curl -X 'GET' \
  'http://localhost:3042/pages?orderby.title=asc' \
  -H 'accept: application/json'
```

### Total Count

If `totalCount` boolean is `true` in query, the GET returns the total number of elements in the `X-Total-Count` header ignoring `limit` and `offset` (if specified).

```bash
$ curl -v -X 'GET' \
  'http://localhost:3042/pages/?limit=2&offset=0&totalCount=true' \
  -H 'accept: application/json'

 (...)
> HTTP/1.1 200 OK
> x-total-count: 18
 (...)

[{"id":1,"title":"Movie1"},{"id":2,"title":"Movie2"}]%
```


## `POST [PLURAL_ENTITY_NAME]`

Creates a new row in table. Expects fields to be sent in a JSON formatted request body.

_Example_

```
$ curl -X 'POST' \
  'http://localhost:3042/pages/' \
  -H 'accept: application/json' \
  -H 'Content-Type: application/json' \
  -d '{
  "title": "Hello World",
  "body": "Welcome to Platformatic!"
}'

{
  "id": 1,
  "title": "Hello World",
  "body": "Welcome to Platformatic"
}
```

## `GET [PLURAL_ENTITY_NAME]/[PRIMARY_KEY]`

Returns a single row, identified by `PRIMARY_KEY`.

_Example_

```
$ curl -X 'GET' 'http://localhost:3042/pages/1?fields=title,body

{
  "title": "Hello World",
  "body": "Welcome to Platformatic"
}
```

## `POST [PLURAL_ENTITY_NAME]/[PRIMARY_KEY]`

Updates a row identified by `PRIMARY_KEY`. 

_Example_

```
$ curl -X 'POST' \
  'http://localhost:3042/pages/1' \
  -H 'accept: application/json' \
  -H 'Content-Type: application/json' \
  -d '{
  "title": "Hello Platformatic!",
  "body": "Welcome to Platformatic!"
}'

{
  "id": 1,
  "title": "Hello Platformatic!",
  "body": "Welcome to Platformatic"
}
```
## `PUT [PLURAL_ENTITY_NAME]/[PRIMARY_KEY]`

Same as `POST [PLURAL_ENTITY_NAME]/[PRIMARY_KEY]`.

<a name="put-plural"></a>
## `PUT [PLURAL_ENTITY_NAME]`

Updates all entities matching `where` clause

_Example_

```
$ curl -X 'PUT' \
  'http://localhost:3042/pages?where.id.in=1,2' \
  -H 'accept: application/json' \
  -H 'Content-Type: application/json' \
  -d '{
  "title": "Updated title!",
  "body": "Updated body!"
}'

[{
  "id": 1,
  "title": "Updated title!",
  "body": "Updated body!"
},{
  "id": 2,
  "title": "Updated title!",
  "body": "Updated body!"
}]
```

## `DELETE [PLURAL_ENTITY_NAME]/[PRIMARY_KEY]`

Deletes a row identified by the `PRIMARY_KEY`.

_Example_

```
$ curl -X 'DELETE' 'http://localhost:3042/pages/1?fields=title'

{
  "title": "Hello Platformatic!"
}
```

## Nested Relationships

Let's consider the following SQL:

```sql
CREATE TABLE IF NOT EXISTS movies (
  movie_id INTEGER PRIMARY KEY,
  title TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS quotes (
  id INTEGER PRIMARY KEY,
  quote TEXT NOT NULL,
  movie_id INTEGER NOT NULL REFERENCES movies(movie_id)
);
```

And:
- `[P_PARENT_ENTITY]` is `movies`
- `[S_PARENT_ENTITY]` is `movie`
- `[P_CHILDREN_ENTITY]` is `quotes`
- `[S_CHILDREN_ENTITY]` is `quote`

In this case, more APIs are available:

### `GET [P_PARENT_ENTITY]/[PARENT_PRIMARY_KEY]/[P_CHILDREN_ENTITY]`

Given a 1-to-many relationship, where a parent entity can have many children, you can query for the children directly.

```
$ curl -X 'GET' 'http://localhost:3042/movies/1/quotes?fields=quote

[
  {
    "quote": "I'll be back"
  },
  {
    "quote": "Hasta la vista, baby"
  }
]
```

### `GET [P_CHILDREN_ENTITY]/[CHILDREN_PRIMARY_KEY]/[S_PARENT_ENTITY]`

You can query for the parent directly, e.g.:

```
$ curl -X 'GET' 'http://localhost:3042/quotes/1/movie?fields=title

{
  "title": "Terminator"
}
```

## Many-to-Many Relationships

Many-to-Many relationship lets you relate each row in one table to many rows in
another table and vice versa. 

Many-to-many relationship are implemented in SQL via a "join table", a table whose **primary key**
is composed by the identifier of the two parts of the many-to-many relationship.

Platformatic DB fully support many-to-many relationships on all supported database.

Let's consider the following SQL:

```SQL
CREATE TABLE pages (
  id INTEGER PRIMARY KEY,
  the_title VARCHAR(42)
);

CREATE TABLE users (
  id INTEGER PRIMARY KEY,
  username VARCHAR(255) NOT NULL
);

CREATE TABLE editors (
  page_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  role VARCHAR(255) NOT NULL,
  CONSTRAINT fk_editor_pages FOREIGN KEY (page_id) REFERENCES pages(id),
  CONSTRAINT fk_editor_users FOREIGN KEY (user_id) REFERENCES users(id),
  PRIMARY KEY (page_id, user_id)
);
```

And:
- `[P_ENTITY]` is `editors`
- `[P_REL_1]` is `pages`
- `[S_REL_1]` is `page`
- `[KEY_REL_1]` is `pages` PRIMARY KEY: `pages(id)`
- `[P_REL_2]` is `users`
- `[S_REL_2]` is `user`
- `[KEY_REL_2]` is `users` PRIMARY KEY: `users(id)`

In this case, here the APIs that are available for the join table:

### `GET [P_ENTITY]/[S_REL_1]/[KEY_REL_1]/[S_REL_2]/[KEY_REL_2]`

This returns the entity in the "join table", e.g. `GET /editors/user/1/page1`.

### `POST [P_ENTITY]/[S_REL_1]/[KEY_REL_1]/[S_REL_2]/[KEY_REL_2]`

Creates a new entity in the "join table", e.g. `POST /editors/user/1/page1`.

### `PUT [P_ENTITY]/[S_REL_1]/[KEY_REL_1]/[S_REL_2]/[KEY_REL_2]`

Updates an entity in the "join table", e.g. `PUT /editors/user/1/page1`.

### `DELETE [P_ENTITY]/[S_REL_1]/[KEY_REL_1]/[S_REL_2]/[KEY_REL_2]`

Delete the entity in the "join table", e.g. `DELETE /editors/user/1/page1`.

## `GET /[P_ENTITY]`

See the [above](#plural).
