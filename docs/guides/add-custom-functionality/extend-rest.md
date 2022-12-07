# Extend REST API

We will follow same examples implemented in [GraphQL examples](./extend-graphql): a sum function and an API to get pages by title.

## Sum Function

Copy and paste this code into `./sample-plugin.js` file

```js
'use strict'
module.exports = async(app, opts) => {
  app.post('/sum', async(req, reply) => {
    const { x, y } = req.body
    return { sum: (x + y)}
  })
}
```

You don't need to reload the server, since it will watch this file and hot-reload itself.

Let's make a `POST /sum` request to the server with the following body

```json
{
  "x": 1,
  "y": 2
}
```

You can use `curl` command to run this query

```
$ curl --location --request POST 'http://localhost:3042/sum' \
--header 'Content-Type: application/json' \
--data-raw '{
    "x": 1,
    "y": 2
}'
```

You will get this output, with the sum.

```json
{
  "sum": 3
}
```

## Extend Entities API

Let's implement a `/page-by-title` endpoint, using Entities API

```js
'use strict'
module.exports = async(app, opts) => {
  app.get('/page-by-title', async(req, reply) => {
    const { title } = req.query
    const res = await app.platformatic.entities.page.find({
      where: {
        title: {
          eq: title
        }
      }
    })
    if (res) {
      return res[0]
    }
    return null
  })
}
```
We will make a `GET /page-by-title?title=First%20Page` request, and we expect a single page as output.

You can use `curl` command to run this query
```
$ curl --location --request GET 'http://localhost:3042/page-by-title?title=First Page'

```

You will get an output similar to this

```json
{
    "id": "1",
    "title": "First Page",
    "body": "This is the first sample page"
}
```

