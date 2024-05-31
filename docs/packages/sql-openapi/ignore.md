# Ignoring entities and fields

`@platformatic/sql-openapi` allows to selectively ignore entities and fields.

To ignore entities:

```javascript
app.register(require('@platformatic/sql-openapi'), {
  ignore: {
    category: true
  }
})
```

To ignore individual fields:

```javascript
app.register(require('@platformatic/sql-openapi'), {
  ignore: {
    category: {
      name: true
    }
  }
})
```

# Ignoring entity routes

To ignore some of the auto-generated routes for an entity:

```javascript
app.register(require('@platformatic/sql-openapi'), {
  ignoreRoutes: {
    { method: 'GET', path: '/categories' },
    { method: 'GET', path: '/categories/{id}' },
    { method: 'DELETE', path: '/categories/{id}' },
    { method: 'DELETE', path: '/posts/{id}' }
  }
})
```

