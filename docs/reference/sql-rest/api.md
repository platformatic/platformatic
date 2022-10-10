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

