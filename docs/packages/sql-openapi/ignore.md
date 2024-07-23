# Ignoring Entities and Fields

`@platformatic/sql-openapi` allows to selectively ignore entities and fields in your API

## Ignoring Entities 

To ignore entities, use the following configuration

```js
app.register(require('@platformatic/sql-openapi'), {
  ignore: {
    category: true
  }
})
```

In this example, the `category` entity will be ignored and not included in the API.

## Ignoring Individual Fields

To ignore specific fields within an entity, use the configuration below:

```js
app.register(require('@platformatic/sql-openapi'), {
  ignore: {
    category: {
      name: true
    }
  }
})
```
In this example, the `name` field within the `category` entity will be ignored and not included in the API.

## Ignoring entity routes

You can also ignore specific auto-generated routes for an entity.

```js
app.register(require('@platformatic/sql-openapi'), {
  ignoreRoutes: {
    { method: 'GET', path: '/categories' },
    { method: 'GET', path: '/categories/{id}' },
    { method: 'DELETE', path: '/categories/{id}' },
    { method: 'DELETE', path: '/posts/{id}' }
  }
})
```

Here the routes for `categories` and `posts` will be ignored and not available in the API. 
